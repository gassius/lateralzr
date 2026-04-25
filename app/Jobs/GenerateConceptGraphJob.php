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

    public function __construct(
        public ?string $seed,
        public ?int $count,
        public int $complexity,
        public ?string $provider,
        public ?string $model,
        public ?string $runUuid
    ) {}

    public function handle(ConceptRelationshipService $service, ConceptGraphStore $store): void
    {
        if ($this->runUuid && $this->seed) {
            ConceptGraphRunJob::query()
                ->where('run_uuid', $this->runUuid)
                ->where('seed', $this->seed)
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
                seedConcept: $this->seed,
                count: $this->count,
                agent: null,
                complexity: $this->complexity
            );

            $store->storeSeedAndRelated(
                seed: $result['seed'],
                related: $result['related_concepts'],
                complexity: (int) $result['complexity'],
                provider: $this->provider ?? $previousProvider,
                model: $this->model ?? $previousModel,
                runUuid: $this->runUuid
            );

            if ($this->runUuid && $this->seed) {
                ConceptGraphRunJob::query()
                    ->where('run_uuid', $this->runUuid)
                    ->where('seed', $this->seed)
                    ->update([
                        'status' => 'succeeded',
                        'attempts' => (int) (($this->attempts() ?? 0)),
                        'finished_at' => now(),
                    ]);
            }
        } catch (\Throwable $e) {
            if ($this->runUuid && $this->seed) {
                ConceptGraphRunJob::query()
                    ->where('run_uuid', $this->runUuid)
                    ->where('seed', $this->seed)
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
}

