<?php

namespace Tests\Feature;

use App\Jobs\GenerateConceptGraphJob;
use App\Models\ConceptGraphRunJob;
use App\Services\ConceptGraphStore;
use App\Services\ConceptRelationshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class GenerateConceptGraphJobStatusTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_failed_callback_records_error_on_run_job(): void
    {
        $runUuid = (string) Str::uuid();

        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'innovation#1',
            'status' => 'processing',
            'attempts' => 0,
            'started_at' => now()->subMinute(),
        ]);

        $job = new GenerateConceptGraphJob(
            seed: 'innovation',
            count: 10,
            complexity: 2,
            provider: 'ollama',
            model: 'phi3.5:latest',
            runUuid: $runUuid,
            jobKey: 'innovation#1',
        );

        $job->failed(new RuntimeException('Worker timed out.'));

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'innovation#1')
            ->first();

        $this->assertNotNull($record);
        $this->assertSame('failed', $record->status);
        $this->assertStringContainsString('timed out', (string) $record->error_message);
    }

    public function test_failed_callback_maps_openrouter_404_model_error(): void
    {
        $runUuid = (string) Str::uuid();

        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'innovation#1',
            'status' => 'processing',
            'attempts' => 1,
            'started_at' => now()->subMinute(),
        ]);

        $job = new GenerateConceptGraphJob(
            seed: 'innovation',
            count: 10,
            complexity: 2,
            provider: 'openrouter',
            model: 'deepseek/deepseek-v4-flash-0731',
            runUuid: $runUuid,
            jobKey: 'innovation#1',
        );

        $job->failed(new RuntimeException('HTTP 404 for model deepseek/deepseek-v4-flash-0731'));

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'innovation#1')
            ->first();

        $this->assertSame('failed', $record?->status);
        $this->assertStringContainsString('rejected model', (string) $record?->error_message);
        $this->assertStringContainsString('openai/gpt-4o-mini', (string) $record?->error_message);
    }

    public function test_handle_fails_immediately_on_invalid_schema(): void
    {
        $runUuid = (string) Str::uuid();

        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'innovation#1',
            'status' => 'pending',
            'attempts' => 0,
        ]);

        $service = Mockery::mock(ConceptRelationshipService::class);
        $service->shouldReceive('generateRelationships')->once()->andThrow(new RuntimeException(
            "OpenRouter Bad Request: Invalid schema for response_format 'schema_definition': In context=('properties', 'concepts'), array schema missing items."
        ));

        $store = Mockery::mock(ConceptGraphStore::class);
        $store->shouldReceive('storeGraph')->never();

        $job = new GenerateConceptGraphJob(
            seed: 'innovation',
            count: 10,
            complexity: 2,
            provider: 'openrouter',
            model: 'openai/gpt-4o-mini',
            runUuid: $runUuid,
            jobKey: 'innovation#1',
        );
        $job->withFakeQueueInteractions();
        $job->handle($service, $store);
        $job->assertFailed();

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'innovation#1')
            ->first();

        $this->assertSame('failed', $record?->status);
        $this->assertStringContainsString('structured output schema', (string) $record?->error_message);
    }

    public function test_handle_rethrows_timeouts_for_limited_retry(): void
    {
        $runUuid = (string) Str::uuid();

        ConceptGraphRunJob::query()->create([
            'run_uuid' => $runUuid,
            'seed' => 'innovation#1',
            'status' => 'pending',
            'attempts' => 0,
        ]);

        $service = Mockery::mock(ConceptRelationshipService::class);
        $service->shouldReceive('generateRelationships')->once()->andThrow(new RuntimeException(
            'cURL error 28: Operation timed out after 60001 milliseconds'
        ));

        $store = Mockery::mock(ConceptGraphStore::class);
        $store->shouldReceive('storeGraph')->never();

        $job = new GenerateConceptGraphJob(
            seed: 'innovation',
            count: 10,
            complexity: 2,
            provider: 'openrouter',
            model: 'openai/gpt-4o-mini',
            runUuid: $runUuid,
            jobKey: 'innovation#1',
        );
        $job->withFakeQueueInteractions();

        try {
            $job->handle($service, $store);
            $this->fail('Timeout should be rethrown for retry.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('timed out', $e->getMessage());
        }

        $record = ConceptGraphRunJob::query()
            ->where('run_uuid', $runUuid)
            ->where('seed', 'innovation#1')
            ->first();

        $this->assertSame('processing', $record?->status);
        $this->assertStringContainsString('timed out', (string) $record?->error_message);
    }

    public function test_stale_processing_job_exposes_timeout_hint(): void
    {
        $runJob = ConceptGraphRunJob::query()->create([
            'run_uuid' => (string) Str::uuid(),
            'seed' => 'innovation#1',
            'status' => 'processing',
            'attempts' => 1,
            'started_at' => now()->subMinutes(6),
        ]);

        $this->assertStringContainsString(
            'probably a legacy timeout',
            $runJob->fresh()->display_error
        );
        $this->assertSame('timed_out', $runJob->fresh()->display_status);
    }
}
