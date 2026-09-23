<?php

namespace Tests\Feature;

use App\Ai\Support\AiRequestError;
use App\Jobs\LocalizeConceptBatchJob;
use App\Models\Concept;
use App\Models\ConceptGraphRun;
use App\Models\ConceptGraphRunJob;
use App\Models\ConceptTerm;
use App\Services\ConceptLocalizeService;
use App\Support\ConceptLocale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Ai\Responses\StructuredAgentResponse;
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

    public function test_batch_job_succeeds_when_sibling_batch_already_owns_locale_norm(): void
    {
        $owner = Concept::query()->create(['canonical_key' => 'traffic-light-sibling']);
        $retrying = Concept::query()->create(['canonical_key' => 'semaphore-retry']);

        ConceptTerm::query()->create([
            'concept_id' => $owner->id,
            'locale' => 'en',
            'term' => 'traffic light',
            'normalized_term' => 'traffic light',
            'short_description' => 'A signal that controls road traffic.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);
        ConceptTerm::query()->create([
            'concept_id' => $owner->id,
            'locale' => 'es',
            'term' => 'semáforo',
            'normalized_term' => 'semáforo',
            'short_description' => 'Señal de tráfico.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);
        ConceptTerm::query()->create([
            'concept_id' => $retrying->id,
            'locale' => 'en',
            'term' => 'semaphore',
            'normalized_term' => 'semaphore',
            'short_description' => 'A signaling system using flags or lights.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')->andReturn([
            'translations' => [
                [
                    'id' => $retrying->id,
                    'term' => 'semáforo',
                    'shortDescription' => 'Sistema de señales.',
                ],
            ],
        ]);

        $fakeAgent = new class($mockResponse)
        {
            public function __construct(private StructuredAgentResponse $response) {}

            public function prompt(string $prompt): StructuredAgentResponse
            {
                return $this->response;
            }
        };

        $runUuid = (string) Str::uuid();
        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'localize#7',
            'status' => 'pending',
            'attempts' => 1,
        ]);

        $service = Mockery::mock(ConceptLocalizeService::class)->makePartial();
        $service->shouldReceive('localize')->once()->andReturnUsing(function () use ($fakeAgent, $retrying) {
            return app(ConceptLocalizeService::class)->localize(
                fromLocale: 'en',
                toLocale: 'es',
                missingOnly: true,
                batchSize: 10,
                agent: $fakeAgent,
                conceptIds: [$retrying->id],
            );
        });

        $job = new LocalizeConceptBatchJob(
            conceptIds: [$retrying->id],
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            provider: 'openrouter',
            model: 'deepseek/deepseek-v4-flash-0731',
            runUuid: $runUuid,
            jobKey: 'localize#7',
        );
        $job->withFakeQueueInteractions();
        $job->handle($service);

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'localize#7')
            ->first();

        $this->assertSame('succeeded', $record?->status);
        $this->assertNull($record?->error_message);
        $this->assertSame(1, ConceptTerm::query()->where('locale', 'es')->where('normalized_term', 'semáforo')->count());
        $this->assertNull($retrying->fresh()->termForLocale('es', fallback: false));
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

    public function test_service_rethrows_permanent_auth_errors(): void
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

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('401');

        app(ConceptLocalizeService::class)->localize(
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            batchSize: 10,
            agent: $agent,
            conceptIds: [$concept->id],
        );
    }

    public function test_batch_job_fails_immediately_on_permanent_auth_error(): void
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
            'OpenRouter Authentication Error: 401 invalid api key'
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
        $job->handle($service);
        $job->assertFailed();

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'localize#1')
            ->first();

        $this->assertSame('failed', $record?->status);
        $this->assertStringContainsString('401', (string) $record?->error_message);
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
        $this->assertStringContainsString('will retry', (string) $record?->error_message);
    }

    public function test_batch_job_does_not_claim_retry_when_attempts_are_exhausted(): void
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
            'cURL error 28: Operation timed out after 180000 milliseconds'
        ));

        $job = new LocalizeConceptBatchJob(
            conceptIds: [42],
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            provider: 'openrouter',
            model: 'deepseek/deepseek-v4-flash-0731',
            runUuid: $runUuid,
            jobKey: 'localize#1',
        );
        $job->tries = 1;
        $job->withFakeQueueInteractions();

        try {
            $job->handle($service);
            $this->fail('Timeout should still be rethrown on the final attempt.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('timed out', $e->getMessage());
        }

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'localize#1')
            ->first();

        $this->assertTrue(AiRequestError::isRetryable(new RuntimeException(
            'cURL error 28: Operation timed out after 180000 milliseconds'
        )));
        $this->assertSame('failed', $record?->status);
        $this->assertStringContainsString('timed out', (string) $record?->error_message);
        $this->assertStringContainsString('retries exhausted', (string) $record?->error_message);
        $this->assertStringNotContainsString('the job will retry', (string) $record?->error_message);
    }

    public function test_batch_job_failed_callback_does_not_claim_retry(): void
    {
        $runUuid = (string) Str::uuid();

        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'localize#1',
            'status' => 'processing',
            'attempts' => 3,
            'started_at' => now()->subMinutes(4),
        ]);

        $job = new LocalizeConceptBatchJob(
            conceptIds: [1],
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            provider: 'openrouter',
            model: 'deepseek/deepseek-v4-flash-0731',
            runUuid: $runUuid,
            jobKey: 'localize#1',
        );

        $job->failed(new RuntimeException('cURL error 28: Operation timed out after 180000 milliseconds'));

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'localize#1')
            ->first();

        $this->assertSame('failed', $record?->status);
        $this->assertStringContainsString('timed out', (string) $record?->error_message);
        $this->assertStringNotContainsString('the job will retry', (string) $record?->error_message);
    }

    public function test_batch_job_marks_partial_and_requeues_deferred_ids(): void
    {
        Queue::fake();

        $runUuid = (string) Str::uuid();
        ConceptGraphRun::query()->create([
            'run_uuid' => $runUuid,
            'type' => ConceptGraphRun::TYPE_LOCALIZE,
            'complexity' => 2,
            'queue' => 'default',
            'seed_count' => 1,
            'seeds' => [
                'from' => 'en',
                'to' => 'es',
                'missingOnly' => true,
                'batchSize' => 10,
                'batches' => ['localize#1' => [42, 7, 8]],
            ],
            'related_count' => 3,
            'dispatched_at' => now(),
        ]);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'localize#1',
            'status' => 'pending',
            'attempts' => 0,
        ]);

        $service = Mockery::mock(ConceptLocalizeService::class);
        $service->shouldReceive('localize')
            ->once()
            ->withArgs(function (
                string $fromLocale,
                string $toLocale,
                ?int $limit,
                bool $missingOnly,
                int $batchSize,
                ?object $agent,
                ?array $conceptIds,
                ?int $deadlineAt = null,
            ) {
                return $fromLocale === 'en'
                    && $toLocale === 'es'
                    && $conceptIds === [42, 7, 8]
                    && is_int($deadlineAt)
                    && $deadlineAt > time()
                    && $deadlineAt <= time() + 300;
            })
            ->andReturn([
                'processed' => 1,
                'created' => 1,
                'skipped' => 0,
                'failed' => 0,
                'deferred' => 2,
                'deferredConceptIds' => [7, 8],
            ]);

        $job = new LocalizeConceptBatchJob(
            conceptIds: [42, 7, 8],
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

        $this->assertSame('partial', $record?->status);
        $this->assertStringContainsString('re-queued as localize#1+1', (string) $record?->error_message);

        $this->assertDatabaseHas('concept_graph_run_jobs', [
            'run_uuid' => $runUuid,
            'seed' => 'localize#1+1',
            'status' => 'pending',
        ]);

        Queue::assertPushed(LocalizeConceptBatchJob::class, function (LocalizeConceptBatchJob $follow) {
            return $follow->conceptIds === [7, 8]
                && $follow->fromLocale === 'en'
                && $follow->toLocale === 'es'
                && $follow->jobKey === 'localize#1+1';
        });

        $run = ConceptGraphRun::query()->where('run_uuid', $runUuid)->first();
        $this->assertSame([7, 8], data_get($run?->seeds, 'batches.localize#1+1'));
    }

    public function test_batch_job_marks_failed_when_deferred_depth_cap_is_hit(): void
    {
        Queue::fake();

        $runUuid = (string) Str::uuid();
        ConceptGraphRun::query()->create([
            'run_uuid' => $runUuid,
            'type' => ConceptGraphRun::TYPE_LOCALIZE,
            'complexity' => 2,
            'queue' => 'default',
            'seed_count' => 1,
            'seeds' => [
                'from' => 'en',
                'to' => 'es',
                'missingOnly' => true,
                'batchSize' => 10,
                'batches' => ['localize#1+20' => [7, 8]],
            ],
            'related_count' => 2,
            'dispatched_at' => now(),
        ]);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'localize#1+20',
            'status' => 'pending',
            'attempts' => 0,
        ]);

        $service = Mockery::mock(ConceptLocalizeService::class);
        $service->shouldReceive('localize')
            ->once()
            ->andReturn([
                'processed' => 0,
                'created' => 0,
                'skipped' => 0,
                'failed' => 0,
                'deferred' => 2,
                'deferredConceptIds' => [7, 8],
            ]);

        $job = new LocalizeConceptBatchJob(
            conceptIds: [7, 8],
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            provider: 'openrouter',
            model: 'openai/gpt-4o-mini',
            runUuid: $runUuid,
            jobKey: 'localize#1+20',
        );
        $job->withFakeQueueInteractions();
        $job->handle($service);

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'localize#1+20')
            ->first();

        $this->assertSame('failed', $record?->status);
        $this->assertStringContainsString('not re-queued', (string) $record?->error_message);
        $this->assertStringContainsString('depth cap', (string) $record?->error_message);
        $this->assertStringNotContainsString('were re-queued', (string) $record?->error_message);

        $this->assertDatabaseMissing('concept_graph_run_jobs', [
            'run_uuid' => $runUuid,
            'seed' => 'localize#1+21',
        ]);
        Queue::assertNotPushed(LocalizeConceptBatchJob::class);
    }
}
