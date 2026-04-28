<?php

namespace App\Jobs;

use App\Models\ConceptGraphRunJob;
use App\Services\ConceptGraphStore;
use App\Services\ConceptRelationshipService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class GenerateConceptGraphJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * LLM generation plus URL enrichment regularly exceeds Laravel's default
     * 60-second worker timeout, especially when Wikimedia lookups are cold.
     */
    public int $timeout = 300;

    public bool $failOnTimeout = true;

    public function __construct(
        public ?string $seed,
        public ?int $count,
        public int $complexity,
        public ?string $provider,
        public ?string $model,
        public ?string $runUuid,
        public ?string $jobKey = null,
    ) {}

    public function handle(ConceptRelationshipService $service, ConceptGraphStore $store): void
    {
        $trackingKey = $this->jobKey ?? $this->seed;

        if ($this->runUuid && $trackingKey) {
            ConceptGraphRunJob::query()
                ->where('run_uuid', $this->runUuid)
                ->where('seed', $trackingKey)
                ->update([
                    'status' => 'processing',
                    'attempts' => (int) (($this->attempts() ?? 0)),
                    'started_at' => now(),
                    'error_message' => null,
                ]);
        }

        $previousProvider = config('ai.default');
        $previousModel = config('ai.models.text');

        if ($this->provider) {
            config()->set('ai.default', $this->provider);
        }
        if ($this->model) {
            config()->set('ai.models.text', $this->model);
        }

        try {
            $result = $service->generateRelationships(
                startConcept: $this->seed,
                count: $this->count,
                agent: null,
                complexity: $this->complexity
            );

            $store->storeGraph(
                concepts: $result['concepts'] ?? [],
                edges: $result['edges'] ?? [],
                complexity: (int) ($result['complexity'] ?? $this->complexity),
                provider: $this->provider ?? $previousProvider,
                model: $this->model ?? $previousModel,
                runUuid: $this->runUuid
            );

            if ($this->runUuid && $trackingKey) {
                ConceptGraphRunJob::query()
                    ->where('run_uuid', $this->runUuid)
                    ->where('seed', $trackingKey)
                    ->update([
                        'status' => 'succeeded',
                        'attempts' => (int) (($this->attempts() ?? 0)),
                        'finished_at' => now(),
                    ]);
            }
        } catch (\Throwable $e) {
            if ($this->runUuid && $trackingKey) {
                ConceptGraphRunJob::query()
                    ->where('run_uuid', $this->runUuid)
                    ->where('seed', $trackingKey)
                    ->update([
                        'status' => 'failed',
                        'attempts' => (int) (($this->attempts() ?? 0)),
                        'finished_at' => now(),
                        'error_message' => $e->getMessage(),
                    ]);
            }

            throw $e;
        } finally {
            config()->set('ai.default', $previousProvider);
            config()->set('ai.models.text', $previousModel);
        }
    }

    public function failed(?\Throwable $exception): void
    {
        $trackingKey = $this->jobKey ?? $this->seed;

        if (! $this->runUuid || ! $trackingKey) {
            return;
        }

        ConceptGraphRunJob::query()
            ->where('run_uuid', $this->runUuid)
            ->where('seed', $trackingKey)
            ->update([
                'status' => 'failed',
                'attempts' => max(1, (int) (($this->attempts() ?? 0))),
                'finished_at' => now(),
                'error_message' => $exception?->getMessage() ?? 'Job failed or timed out.',
            ]);
    }
}
