<?php

namespace App\Jobs;

use App\Ai\Support\AiRequestError;
use App\Models\ConceptGraphRunJob;
use App\Services\ConceptGraphStore;
use App\Services\ConceptRelationshipService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class GenerateConceptGraphJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * LLM graph generation can exceed Laravel's default 60-second worker timeout.
     * Wiki and media enrichment is not part of this job.
     */
    public int $timeout = 300;

    public bool $failOnTimeout = true;

    /**
     * Limited retries for transient OpenRouter timeouts/429/5xx. Permanent
     * errors (invalid model, invalid schema, auth) fail immediately.
     */
    public int $tries = 3;

    public function backoff(): array
    {
        return [30, 90];
    }

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
        $startedAt = microtime(true);
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
                        'error_message' => null,
                    ]);
            }

            Log::info('GenerateConceptGraphJob succeeded', [
                'run_uuid' => $this->runUuid,
                'job_key' => $trackingKey,
                'seconds' => round(microtime(true) - $startedAt, 2),
                'attempt' => $this->attempts(),
                'provider' => $this->provider,
                'model' => $this->model,
            ]);
        } catch (Throwable $e) {
            $retryable = AiRequestError::isRetryable($e);
            $willRetry = $retryable && $this->attempts() < $this->tries;
            $mapped = AiRequestError::displayMessage($e, $this->provider, $this->model, $willRetry);

            Log::warning('GenerateConceptGraphJob failed', [
                'run_uuid' => $this->runUuid,
                'job_key' => $trackingKey,
                'seconds' => round(microtime(true) - $startedAt, 2),
                'attempt' => $this->attempts(),
                'retryable' => $retryable,
                'will_retry' => $willRetry,
                'provider' => $this->provider,
                'model' => $this->model,
                'error' => $mapped,
            ]);

            if ($this->runUuid && $trackingKey) {
                ConceptGraphRunJob::query()
                    ->where('run_uuid', $this->runUuid)
                    ->where('seed', $trackingKey)
                    ->update([
                        'status' => $willRetry ? 'processing' : 'failed',
                        'attempts' => (int) (($this->attempts() ?? 0)),
                        'finished_at' => $willRetry ? null : now(),
                        'error_message' => $mapped,
                    ]);
            }

            if (! $retryable) {
                $this->fail(new RuntimeException($mapped, 0, $e));

                return;
            }

            throw $e;
        } finally {
            config()->set('ai.default', $previousProvider);
            config()->set('ai.models.text', $previousModel);
        }
    }

    public function failed(?Throwable $exception): void
    {
        $trackingKey = $this->jobKey ?? $this->seed;

        if (! $this->runUuid || ! $trackingKey) {
            return;
        }

        $message = $exception
            ? AiRequestError::displayMessage($exception, $this->provider, $this->model, false)
            : 'Job failed or timed out.';

        ConceptGraphRunJob::query()
            ->where('run_uuid', $this->runUuid)
            ->where('seed', $trackingKey)
            ->update([
                'status' => 'failed',
                'attempts' => max(1, (int) (($this->attempts() ?? 0))),
                'finished_at' => now(),
                'error_message' => $message,
            ]);
    }
}
