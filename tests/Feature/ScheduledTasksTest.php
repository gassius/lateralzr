<?php

namespace Tests\Feature;

use App\Jobs\CompleteConceptInfoBatchJob;
use App\Jobs\CompleteInfoPipelineNodeJob;
use App\Jobs\GeneratePipelineNodeJob;
use App\Jobs\LocalizeConceptBatchJob;
use App\Jobs\LocalizePipelineNodeJob;
use App\Models\Concept;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Models\ScheduledTask;
use App\Models\ScheduledTaskRun;
use App\Services\ScheduledTasks\ScheduledTaskCatalog;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Queue;
use Tests\Feature\Concerns\InteractsWithFilamentAdmin;
use Tests\TestCase;

class ScheduledTasksTest extends TestCase
{
    use InteractsWithFilamentAdmin;
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_migration_seeds_disabled_daily_tasks(): void
    {
        $keys = ScheduledTask::query()->orderBy('id')->pluck('key')->all();
        $this->assertSame([ScheduledTaskCatalog::GROW_SPARSE, ScheduledTaskCatalog::FILL_MISSING], $keys);

        foreach (ScheduledTask::query()->get() as $task) {
            $this->assertFalse($task->enabled);
            $this->assertSame('daily', $task->cadence);
            $this->assertNull($task->last_run_at);
            $this->assertNull($task->next_run_at);
            $this->assertGreaterThanOrEqual(1, $task->per_run_cap);
        }
    }

    public function test_dispatcher_skips_disabled_tasks_even_when_next_run_is_past(): void
    {
        Carbon::setTestNow('2026-10-19 12:00:00');
        Bus::fake();
        Queue::fake();

        $this->makeSparseConcept('silence');

        ScheduledTask::query()->where('key', ScheduledTaskCatalog::GROW_SPARSE)->update([
            'enabled' => false,
            'next_run_at' => now()->subHour(),
        ]);

        $this->artisan('concepts:schedule:dispatch')
            ->expectsOutputToContain('No due scheduled tasks')
            ->assertSuccessful();

        $this->assertDatabaseCount('scheduled_task_runs', 0);
        $this->assertDatabaseCount('concept_graph_runs', 0);
        Bus::assertNothingDispatched();
        Queue::assertNothingPushed();
    }

    public function test_dispatcher_skips_enabled_tasks_that_are_not_due(): void
    {
        Carbon::setTestNow('2026-10-19 12:00:00');
        Bus::fake();
        Queue::fake();

        $this->makeSparseConcept('silence');

        $this->artisan('concepts:schedule:enable', ['task' => 'grow-sparse'])->assertSuccessful();
        ScheduledTask::query()->where('key', 'grow-sparse')->update([
            'next_run_at' => now()->addDay(),
        ]);

        $this->artisan('concepts:schedule:dispatch')
            ->expectsOutputToContain('No due scheduled tasks')
            ->assertSuccessful();

        $this->assertDatabaseCount('scheduled_task_runs', 0);
        Bus::assertNothingDispatched();
    }

    public function test_enabling_a_due_task_runs_through_the_scheduler_and_advances_daily_cadence(): void
    {
        Carbon::setTestNow('2026-10-19 12:00:00');
        Bus::fake();
        Queue::fake();

        $this->makeSparseConcept('silence');

        $this->artisan('concepts:schedule:enable', ['task' => 'grow-sparse'])->assertSuccessful();

        $this->artisan('concepts:schedule:dispatch')
            ->expectsOutputToContain('Ran 1 scheduled task')
            ->assertSuccessful();

        $task = ScheduledTask::query()->where('key', 'grow-sparse')->first();
        $this->assertNotNull($task);
        $this->assertSame('2026-10-19 12:00:00', $task->last_run_at?->toDateTimeString());
        $this->assertSame('2026-10-20 12:00:00', $task->next_run_at?->toDateTimeString());

        $history = ScheduledTaskRun::query()->first();
        $this->assertNotNull($history);
        $this->assertSame(ScheduledTaskRun::TRIGGER_SCHEDULED, $history->trigger);
        $this->assertSame(ScheduledTaskRun::STATUS_SUCCEEDED, $history->status);
        $this->assertSame(1, $history->items_processed);
        $this->assertNotNull($history->pipeline_run_uuid);

        $run = ConceptGraphRun::query()->where('run_uuid', $history->pipeline_run_uuid)->first();
        $this->assertNotNull($run);
        $this->assertSame(ConceptGraphRun::TYPE_PIPELINE, $run->type);

        Bus::assertChained([
            GeneratePipelineNodeJob::class,
            LocalizePipelineNodeJob::class,
            CompleteInfoPipelineNodeJob::class,
        ]);

        $this->artisan('concepts:schedule:dispatch')
            ->expectsOutputToContain('No due scheduled tasks')
            ->assertSuccessful();
        $this->assertSame(1, ScheduledTaskRun::query()->count());

        Carbon::setTestNow('2026-10-20 12:00:00');
        $this->artisan('concepts:schedule:dispatch')->assertSuccessful();
        $this->assertSame(2, ScheduledTaskRun::query()->count());
    }

    public function test_grow_sparse_respects_per_run_cap_and_relationship_threshold(): void
    {
        Carbon::setTestNow('2026-10-19 12:00:00');
        Bus::fake();

        $sparseA = $this->makeSparseConcept('silence');
        $sparseB = $this->makeSparseConcept('harbor');
        $this->makeSparseConcept('origami');
        $this->makeDensePair('alpha', 'beta');

        $this->artisan('concepts:schedule:set', [
            'task' => 'grow-sparse',
            '--cap' => 2,
        ])->assertSuccessful();

        $this->artisan('concepts:schedule:run', ['task' => 'grow-sparse'])->assertSuccessful();

        $history = ScheduledTaskRun::query()->first();
        $this->assertSame(2, $history?->items_processed);
        $this->assertSame(ScheduledTaskRun::TRIGGER_MANUAL, $history?->trigger);
        $this->assertSame(2, ConceptPipelineNode::query()->count());

        $keys = ConceptPipelineNode::query()->pluck('canonical_key')->all();
        $this->assertContains($sparseA->canonical_key, $keys);
        $this->assertContains($sparseB->canonical_key, $keys);
        $this->assertNotContains('alpha', $keys);
        $this->assertNotContains('beta', $keys);
        $this->assertNotContains('origami', $keys);
    }

    public function test_fill_missing_enqueues_localize_and_complete_info_up_to_the_cap(): void
    {
        Carbon::setTestNow('2026-10-19 12:00:00');
        Queue::fake();

        $missingLocale = $this->makeConcept('silence', 'silence');
        $this->makeConcept('harbor', 'harbor');
        $this->makeConcept('origami', 'origami');
        $imaged = $this->makeConcept('pattern', 'pattern', mediaUrl: 'https://example.com/p.jpg');
        ConceptTerm::query()->create([
            'concept_id' => $imaged->id,
            'locale' => 'es',
            'term' => 'patrón',
            'normalized_term' => 'patron',
            'media_url' => 'https://example.com/p.jpg',
            'complexity' => 3,
            'is_preferred' => true,
        ]);

        $this->artisan('concepts:schedule:set', [
            'task' => 'fill-missing',
            '--cap' => 2,
        ])->assertSuccessful();

        $this->artisan('concepts:schedule:run', ['task' => 'fill-missing'])
            ->expectsOutputToContain('status=succeeded')
            ->assertSuccessful();

        $history = ScheduledTaskRun::query()->where('task_key', 'fill-missing')->first();
        $this->assertNotNull($history);
        $this->assertSame(2, $history->items_processed);
        $this->assertSame(2, (int) data_get($history->details, 'locale_count'));
        $this->assertSame(0, (int) data_get($history->details, 'media_count'));

        Queue::assertPushed(LocalizeConceptBatchJob::class, function (LocalizeConceptBatchJob $job) use ($missingLocale) {
            return $job->fromLocale === 'en'
                && $job->toLocale === 'es'
                && in_array($missingLocale->id, $job->conceptIds, true)
                && count($job->conceptIds) === 2;
        });
        Queue::assertNotPushed(CompleteConceptInfoBatchJob::class);

        $this->assertTrue(
            ConceptGraphRun::query()->where('type', ConceptGraphRun::TYPE_LOCALIZE)->exists()
        );
        $this->assertFalse(
            ConceptGraphRun::query()->where('type', ConceptGraphRun::TYPE_COMPLETE_INFO)->exists()
        );
    }

    public function test_fill_missing_uses_remaining_cap_for_images(): void
    {
        Queue::fake();

        $this->makeConcept('harbor', 'harbor', mediaUrl: 'https://example.com/h.jpg');
        $imageOnly = $this->makeConcept('pattern', 'pattern');
        ConceptTerm::query()->create([
            'concept_id' => $imageOnly->id,
            'locale' => 'es',
            'term' => 'patrón',
            'normalized_term' => 'patron',
            'complexity' => 3,
            'is_preferred' => true,
        ]);

        $this->artisan('concepts:schedule:set', [
            'task' => 'fill-missing',
            '--cap' => 2,
        ])->assertSuccessful();

        $this->artisan('concepts:schedule:run', ['task' => 'fill-missing'])->assertSuccessful();

        $history = ScheduledTaskRun::query()->where('task_key', 'fill-missing')->first();
        $this->assertNotNull($history);
        $this->assertSame(1, (int) data_get($history->details, 'locale_count'));
        $this->assertSame(1, (int) data_get($history->details, 'media_count'));
        $this->assertSame(2, $history->items_processed);

        Queue::assertPushed(LocalizeConceptBatchJob::class);
        Queue::assertPushed(CompleteConceptInfoBatchJob::class);
    }

    public function test_manual_run_records_history_while_disabled(): void
    {
        Bus::fake();
        $this->makeSparseConcept('silence');

        $task = ScheduledTask::query()->where('key', 'grow-sparse')->first();
        $this->assertFalse((bool) $task?->enabled);

        $this->artisan('concepts:schedule:run', ['task' => 'grow-sparse'])->assertSuccessful();

        $this->assertDatabaseHas('scheduled_task_runs', [
            'task_key' => 'grow-sparse',
            'trigger' => ScheduledTaskRun::TRIGGER_MANUAL,
            'status' => ScheduledTaskRun::STATUS_SUCCEEDED,
        ]);
        $this->assertFalse((bool) $task?->fresh()?->enabled);
    }

    public function test_commands_list_enable_disable_and_set(): void
    {
        Carbon::setTestNow('2026-10-19 12:00:00');

        $this->artisan('concepts:schedule:list')
            ->expectsOutputToContain('grow-sparse')
            ->expectsOutputToContain('fill-missing')
            ->assertSuccessful();

        $this->artisan('concepts:schedule:enable', ['task' => 'fill-missing'])->assertSuccessful();
        $this->assertTrue((bool) ScheduledTask::query()->where('key', 'fill-missing')->value('enabled'));

        $this->artisan('concepts:schedule:set', [
            'task' => 'fill-missing',
            '--cadence' => 'hourly',
            '--cap' => 7,
        ])->assertSuccessful();

        $task = ScheduledTask::query()->where('key', 'fill-missing')->first();
        $this->assertSame('hourly', $task?->cadence);
        $this->assertSame(7, $task?->per_run_cap);

        $this->artisan('concepts:schedule:disable', ['task' => 'fill-missing'])->assertSuccessful();
        $this->assertFalse((bool) ScheduledTask::query()->where('key', 'fill-missing')->value('enabled'));

        $this->artisan('concepts:schedule:enable', ['task' => 'nope'])
            ->expectsOutputToContain('Unknown scheduled task')
            ->assertFailed();
    }

    public function test_schedule_registers_dispatch_every_minute_without_overlapping(): void
    {
        $this->artisan('schedule:list')
            ->expectsOutputToContain('concepts:schedule:dispatch')
            ->assertSuccessful();

        $event = collect(app(Schedule::class)->events())
            ->first(function ($event) {
                $haystack = implode(' ', array_filter([
                    $event->command ?? null,
                    $event->description ?? null,
                ]));

                return str_contains($haystack, 'concepts:schedule:dispatch');
            });

        $this->assertNotNull($event);
        $this->assertSame('* * * * *', $event->expression);
        $this->assertTrue($event->withoutOverlapping);
        $this->assertTrue($event->onOneServer);
    }

    public function test_empty_run_still_writes_history(): void
    {
        Bus::fake();
        Queue::fake();

        $this->artisan('concepts:schedule:run', ['task' => 'grow-sparse'])->assertSuccessful();

        $this->assertDatabaseHas('scheduled_task_runs', [
            'task_key' => 'grow-sparse',
            'status' => ScheduledTaskRun::STATUS_SUCCEEDED,
            'items_processed' => 0,
        ]);
        $this->assertDatabaseCount('concept_graph_runs', 0);
    }

    protected function makeSparseConcept(string $term): Concept
    {
        return $this->makeConcept($term, $term);
    }

    protected function makeDensePair(string $from, string $to): void
    {
        $a = $this->makeConcept($from, $from);
        $b = $this->makeConcept($to, $to);

        ConceptRelationship::query()->create([
            'from_concept_id' => $a->id,
            'to_concept_id' => $b->id,
            'strength' => 0.5,
        ]);
        ConceptRelationship::query()->create([
            'from_concept_id' => $b->id,
            'to_concept_id' => $a->id,
            'strength' => 0.5,
        ]);
    }
}
