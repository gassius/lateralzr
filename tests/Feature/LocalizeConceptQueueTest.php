<?php

namespace Tests\Feature;

use App\Jobs\LocalizeConceptBatchJob;
use App\Models\Concept;
use App\Models\ConceptGraphRunJob;
use App\Models\ConceptTerm;
use App\Services\ConceptLocalizeService;
use App\Support\ConceptLocale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class LocalizeConceptQueueTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_command_enqueues_localize_batches_by_default(): void
    {
        Queue::fake();

        $concept = Concept::query()->create(['canonical_key' => 'silence']);
        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => 'en',
            'term' => 'silence',
            'normalized_term' => 'silence',
            'short_description' => 'Absence of sound.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        $this->artisan('concepts:localize', [
            '--from' => 'en',
            '--to' => 'es',
            '--batch-size' => 10,
            '--provider' => 'openrouter',
        ])
            ->expectsOutputToContain('Enqueued localize')
            ->assertSuccessful();

        $this->assertDatabaseHas('concept_graph_runs', [
            'type' => 'localize',
            'provider' => 'openrouter',
            'model' => 'openai/gpt-4o-mini',
            'seed_count' => 1,
        ]);

        Queue::assertPushed(LocalizeConceptBatchJob::class, function (LocalizeConceptBatchJob $job) use ($concept) {
            return $job->fromLocale === 'en'
                && $job->toLocale === 'es'
                && $job->conceptIds === [$concept->id]
                && $job->provider === 'openrouter';
        });
    }

    public function test_command_sync_still_runs_inline(): void
    {
        Queue::fake();

        $this->artisan('concepts:localize', [
            '--from' => 'en',
            '--to' => 'es',
            '--sync' => true,
            '--provider' => 'openrouter',
        ])
            ->expectsOutputToContain('sync')
            ->assertSuccessful();

        Queue::assertNothingPushed();
        $this->assertDatabaseMissing('concept_graph_runs', ['type' => 'localize']);
    }

    public function test_batch_job_failed_callback_records_error(): void
    {
        $runUuid = (string) Str::uuid();

        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'localize#1',
            'status' => 'processing',
            'attempts' => 0,
            'started_at' => now()->subMinute(),
        ]);

        $job = new LocalizeConceptBatchJob(
            conceptIds: [1],
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            provider: 'ollama',
            model: 'phi3.5:latest',
            runUuid: $runUuid,
            jobKey: 'localize#1',
        );

        $job->failed(new RuntimeException('Worker timed out.'));

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'localize#1')
            ->first();

        $this->assertSame('failed', $record?->status);
        $this->assertStringContainsString('timed out', (string) $record?->error_message);
    }

    public function test_batch_job_handle_marks_succeeded(): void
    {
        $runUuid = (string) Str::uuid();

        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'localize#1',
            'status' => 'pending',
            'attempts' => 0,
        ]);

        $service = Mockery::mock(ConceptLocalizeService::class);
        $service->shouldReceive('localize')->once()->andReturn([
            'processed' => 1,
            'created' => 1,
            'skipped' => 0,
            'failed' => 0,
        ]);

        $job = new LocalizeConceptBatchJob(
            conceptIds: [42],
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            provider: 'openrouter',
            model: 'openai/gpt-4o-mini',
            runUuid: $runUuid,
            jobKey: 'localize#1',
        );
        $job->withFakeQueueInteractions();
        $job->handle($service);

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'localize#1')
            ->first();

        $this->assertSame('succeeded', $record?->status);
    }

    public function test_service_rethrows_retryable_llm_timeouts(): void
    {
        $concept = Concept::query()->create(['canonical_key' => 'silence-timeout']);
        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => ConceptLocale::default(),
            'term' => 'silence',
            'normalized_term' => 'silence',
            'short_description' => 'Absence of sound.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        $agent = new class
        {
            public function prompt(string $prompt): never
            {
                throw new RuntimeException('cURL error 28: Operation timed out after 90001 milliseconds');
            }
        };

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('timed out');

        app(ConceptLocalizeService::class)->localize(
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            batchSize: 10,
            agent: $agent,
            conceptIds: [$concept->id],
        );
    }

    public function test_service_swallows_permanent_auth_errors(): void
    {
        $concept = Concept::query()->create(['canonical_key' => 'silence-auth']);
        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => ConceptLocale::default(),
            'term' => 'silence',
            'normalized_term' => 'silence',
            'short_description' => 'Absence of sound.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        $agent = new class
        {
            public function prompt(string $prompt): never
            {
                throw new RuntimeException('OpenRouter Authentication Error: 401 invalid api key');
            }
        };

        $stats = app(ConceptLocalizeService::class)->localize(
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            batchSize: 10,
            agent: $agent,
            conceptIds: [$concept->id],
        );

        $this->assertSame(1, $stats['failed']);
        $this->assertSame(0, $stats['created']);
    }

    public function test_batch_job_rethrows_timeouts_for_limited_retry(): void
    {
        $runUuid = (string) Str::uuid();

        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'localize#1',
            'status' => 'pending',
            'attempts' => 0,
        ]);

        $service = Mockery::mock(ConceptLocalizeService::class);
        $service->shouldReceive('localize')->once()->andThrow(new RuntimeException(
            'cURL error 28: Operation timed out after 90001 milliseconds'
        ));

        $job = new LocalizeConceptBatchJob(
            conceptIds: [42],
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            provider: 'openrouter',
            model: 'openai/gpt-4o-mini',
            runUuid: $runUuid,
            jobKey: 'localize#1',
        );
        $job->withFakeQueueInteractions();

        try {
            $job->handle($service);
            $this->fail('Timeout should be rethrown for retry.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('timed out', $e->getMessage());
        }

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'localize#1')
            ->first();

        $this->assertSame('processing', $record?->status);
        $this->assertStringContainsString('timed out', (string) $record?->error_message);
    }
}
