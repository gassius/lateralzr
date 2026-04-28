<?php

namespace Tests\Feature;

use App\Jobs\GenerateConceptGraphJob;
use App\Models\ConceptGraphRunJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class GenerateConceptGraphJobStatusTest extends TestCase
{
    use RefreshDatabase;

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

        $this->assertDatabaseHas('concept_graph_run_jobs', [
            'run_uuid' => $runUuid,
            'seed' => 'innovation#1',
            'status' => 'failed',
            'error_message' => 'Worker timed out.',
        ]);
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
