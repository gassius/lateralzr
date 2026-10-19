<?php

namespace Tests\Feature;

use App\Filament\Pages\GenerationProgress;
use App\Filament\Resources\ConceptGraphRuns\ConceptGraphRunResource;
use App\Filament\Resources\ScheduledTasks\Pages\EditScheduledTask;
use App\Filament\Resources\ScheduledTasks\Pages\ListScheduledTasks;
use App\Filament\Resources\ScheduledTasks\RelationManagers\RunsRelationManager;
use App\Jobs\CompleteInfoPipelineNodeJob;
use App\Jobs\GeneratePipelineNodeJob;
use App\Jobs\LocalizePipelineNodeJob;
use App\Models\ConceptGraphRun;
use App\Models\ScheduledTask;
use App\Models\ScheduledTaskRun;
use App\Services\ScheduledTasks\ScheduledTaskCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Feature\Concerns\InteractsWithFilamentAdmin;
use Tests\TestCase;

class FilamentScheduledTasksAdminTest extends TestCase
{
    use InteractsWithFilamentAdmin;
    use RefreshDatabase;

    public function test_admin_list_shows_tasks_last_and_next_run(): void
    {
        $this->actingAsAdmin();

        $grow = ScheduledTask::query()->where('key', ScheduledTaskCatalog::GROW_SPARSE)->first();
        $this->assertNotNull($grow);
        $grow->update([
            'last_run_at' => now()->subDay(),
            'next_run_at' => now()->addDay(),
        ]);

        $this->get('/admin/scheduled-tasks')
            ->assertSuccessful()
            ->assertSee('grow-sparse')
            ->assertSee('fill-missing')
            ->assertSee('Grow sparse graph');

        Livewire::test(ListScheduledTasks::class)
            ->assertCanSeeTableRecords([$grow]);
    }

    public function test_admin_can_toggle_and_edit_cadence_cap_and_options(): void
    {
        $this->actingAsAdmin();

        $grow = ScheduledTask::query()->where('key', ScheduledTaskCatalog::GROW_SPARSE)->first();
        $this->assertNotNull($grow);

        Livewire::test(EditScheduledTask::class, ['record' => $grow->getKey()])
            ->assertSuccessful()
            ->assertFormSet([
                'key' => 'grow-sparse',
                'enabled' => false,
                'cadence' => 'daily',
            ])
            ->fillForm([
                'enabled' => true,
                'cadence' => 'hourly',
                'per_run_cap' => 4,
                'options' => [
                    'threshold' => 3,
                    'count' => 8,
                    'complexity' => 2,
                    'depth' => 1,
                ],
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $grow->refresh();
        $this->assertTrue($grow->enabled);
        $this->assertSame('hourly', $grow->cadence);
        $this->assertSame(4, $grow->per_run_cap);
        $this->assertSame(3, (int) $grow->option('threshold'));
        $this->assertNotNull($grow->next_run_at);
    }

    public function test_run_now_action_records_history(): void
    {
        $this->actingAsAdmin();
        Bus::fake();
        $this->makeConcept('silence', 'silence');

        $grow = ScheduledTask::query()->where('key', ScheduledTaskCatalog::GROW_SPARSE)->first();
        $this->assertNotNull($grow);

        Livewire::test(ListScheduledTasks::class)
            ->callTableAction('runNow', $grow)
            ->assertNotified();

        $this->assertDatabaseHas('scheduled_task_runs', [
            'task_key' => 'grow-sparse',
            'trigger' => ScheduledTaskRun::TRIGGER_MANUAL,
            'status' => ScheduledTaskRun::STATUS_SUCCEEDED,
        ]);

        Bus::assertChained([
            GeneratePipelineNodeJob::class,
            LocalizePipelineNodeJob::class,
            CompleteInfoPipelineNodeJob::class,
        ]);
    }

    public function test_history_links_pipeline_runs_to_progress_and_legacy_runs_to_worker_view(): void
    {
        $this->actingAsAdmin();

        $grow = ScheduledTask::query()->where('key', ScheduledTaskCatalog::GROW_SPARSE)->first();
        $this->assertNotNull($grow);

        $pipeline = ConceptGraphRun::query()->create([
            'run_uuid' => (string) Str::uuid(),
            'type' => ConceptGraphRun::TYPE_PIPELINE,
            'provider' => 'openrouter',
            'model' => 'openai/gpt-4o-mini',
            'complexity' => 3,
            'queue' => 'default',
            'seed_count' => 1,
            'seeds' => ['starts' => ['silence'], 'depth' => 1, 'targetCount' => 10],
            'dispatched_at' => now(),
        ]);
        $localize = ConceptGraphRun::query()->create([
            'run_uuid' => (string) Str::uuid(),
            'type' => ConceptGraphRun::TYPE_LOCALIZE,
            'provider' => 'openrouter',
            'model' => 'openai/gpt-4o-mini',
            'complexity' => 3,
            'queue' => 'default',
            'seed_count' => 1,
            'seeds' => ['from' => 'en', 'to' => 'es', 'targetCount' => 1],
            'dispatched_at' => now(),
        ]);

        $pipelineHistory = ScheduledTaskRun::query()->create([
            'scheduled_task_id' => $grow->id,
            'task_key' => $grow->key,
            'trigger' => ScheduledTaskRun::TRIGGER_MANUAL,
            'status' => ScheduledTaskRun::STATUS_SUCCEEDED,
            'items_processed' => 1,
            'pipeline_run_uuid' => $pipeline->run_uuid,
            'started_at' => now(),
            'finished_at' => now(),
        ]);
        $legacyHistory = ScheduledTaskRun::query()->create([
            'scheduled_task_id' => $grow->id,
            'task_key' => $grow->key,
            'trigger' => ScheduledTaskRun::TRIGGER_SCHEDULED,
            'status' => ScheduledTaskRun::STATUS_SUCCEEDED,
            'items_processed' => 1,
            'pipeline_run_uuid' => $localize->run_uuid,
            'started_at' => now(),
            'finished_at' => now(),
        ]);

        $this->assertSame(
            GenerationProgress::getUrl(['record' => $pipeline]),
            $pipelineHistory->urlForGraphRun($pipeline)
        );
        $this->assertSame(
            ConceptGraphRunResource::getUrl('view', ['record' => $localize]),
            $legacyHistory->urlForGraphRun($localize)
        );

        $this->get('/admin/scheduled-tasks/'.$grow->id.'/edit')->assertSuccessful();

        Livewire::test(RunsRelationManager::class, [
            'ownerRecord' => $grow,
            'pageClass' => EditScheduledTask::class,
        ])
            ->assertSee('Progress')
            ->assertSee('Worker run');
    }
}
