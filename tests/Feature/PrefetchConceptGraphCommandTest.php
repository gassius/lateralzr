<?php

namespace Tests\Feature;

use App\Jobs\GenerateConceptGraphJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PrefetchConceptGraphCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_help_lists_openrouter_provider(): void
    {
        $this->artisan('concepts:prefetch', ['--help'])
            ->expectsOutputToContain('openrouter')
            ->assertSuccessful();
    }

    public function test_rejects_unknown_provider(): void
    {
        $this->artisan('concepts:prefetch', [
            '--starts' => 'creativity',
            '--provider' => 'not-a-provider',
        ])
            ->expectsOutputToContain('Unknown AI provider [not-a-provider]')
            ->assertFailed();
    }

    public function test_enqueues_jobs_with_openrouter_provider(): void
    {
        Queue::fake();

        $this->artisan('concepts:prefetch', [
            '--starts' => 'creativity',
            '--count' => 10,
            '--batch-size' => 10,
            '--provider' => 'openrouter',
        ])->assertSuccessful();

        $this->assertDatabaseHas('concept_graph_runs', [
            'type' => 'graph',
            'provider' => 'openrouter',
            'model' => 'openai/gpt-4o-mini',
        ]);

        Queue::assertPushed(GenerateConceptGraphJob::class, function (GenerateConceptGraphJob $job) {
            return $job->provider === 'openrouter' && $job->model === 'openai/gpt-4o-mini';
        });
    }
}
