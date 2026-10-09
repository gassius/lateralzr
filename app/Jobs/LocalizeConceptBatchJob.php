<?php

namespace App\Jobs;

use App\Ai\Support\AiConfigOverride;
use App\Ai\Support\AiRequestError;
use App\Jobs\Concerns\DeferredBatchFollowUp;
use App\Models\ConceptGraphRunJob;
use App\Services\ConceptLocalizeService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class LocalizeConceptBatchJob implements ShouldQueue
{
    use DeferredBatchFollowUp, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Structured LLM translation for a batch of terms. Wiki/media lookup is
     * not part of this job (`concepts:complete-info`).
     */
    public int $timeout = 300;

    public bool $failOnTimeout = true;

    public int $tries = 3;

    public function backoff(): array
    {
        return [30, 90];
    }

    /**
     * @param  list<int>  $conceptIds
     */
    public function __construct(
        public array $conceptIds,
        public string $fromLocale,
        public string $toLocale,
        public bool $missingOnly,
        public ?string $provider,
        public ?string $model,
        public ?string $runUuid,
        public string $jobKey,
    ) {}

    public function handle(ConceptLocalizeService $service): void
    {
        $startedAt = microtime(true);

        ConceptGraphRunJob::mark($this->runUuid, $this->jobKey, [
            'status' => 'processing',
            'attempts' => (int) $this->attempts(),
            'started_at' => now(),
            'error_message' => null,
        ]);

        AiConfigOverride::run($this->provider, $this->model, function () use ($service, $startedAt): void {
            try {
                // Leave a margin under $timeout so a slow LLM call fail-softs
                // (remaining concept IDs are re-queued) instead of a worker SIGKILL.
                $deadlineAt = time() + max(30, $this->timeout - 60);

                $stats = $service->localize(
                    fromLocale: $this->fromLocale,
                    toLocale: $this->toLocale,
                    limit: null,
                    missingOnly: $this->missingOnly,
                    batchSize: ConceptLocalizeService::DEFAULT_BATCH_SIZE,
                    agent: null,
                    conceptIds: $this->conceptIds,
                    deadlineAt: $deadlineAt,
                );

                $deferredIds = array_values(array_map('intval', $stats['deferredConceptIds'] ?? []));
                $deferred = count($deferredIds);
                $followKey = null;
                if ($deferred > 0) {
                    $followKey = $this->requeueDeferred($deferredIds);
                }

                [$status, $message] = $this->deferredOutcome($deferred, $followKey);

                ConceptGraphRunJob::mark($this->runUuid, $this->jobKey, [
                    'status' => $status,
                    'attempts' => (int) $this->attempts(),
                    'finished_at' => now(),
                    'error_message' => $message,
                ]);

                Log::info('LocalizeConceptBatchJob succeeded', [
                    'run_uuid' => $this->runUuid,
                    'job_key' => $this->jobKey,
                    'seconds' => round(microtime(true) - $startedAt, 2),
                    'attempt' => $this->attempts(),
                    'count' => count($this->conceptIds),
                    'stats' => $stats,
                    'follow_key' => $followKey,
                    'provider' => $this->provider,
                    'model' => $this->model,
                ]);
            } catch (Throwable $e) {
                $retryable = AiRequestError::isRetryable($e);
                $willRetry = $retryable && $this->attempts() < $this->tries;
                $mapped = AiRequestError::displayMessage($e, $this->provider, $this->model, $willRetry);

                Log::warning('LocalizeConceptBatchJob failed', [
                    'run_uuid' => $this->runUuid,
                    'job_key' => $this->jobKey,
                    'seconds' => round(microtime(true) - $startedAt, 2),
                    'attempt' => $this->attempts(),
                    'retryable' => $retryable,
                    'will_retry' => $willRetry,
                    'provider' => $this->provider,
                    'model' => $this->model,
                    'error' => $mapped,
                ]);

                ConceptGraphRunJob::mark($this->runUuid, $this->jobKey, [
                    'status' => $willRetry ? 'processing' : 'failed',
                    'attempts' => (int) $this->attempts(),
                    'finished_at' => $willRetry ? null : now(),
                    'error_message' => $mapped,
                ]);

                if (! $retryable) {
                    $this->fail(new RuntimeException($mapped, 0, $e));

                    return;
                }

                throw $e;
            }
        });
    }

    public function failed(?Throwable $exception): void
    {
        if (! $this->runUuid) {
            return;
        }

        $message = $exception
            ? AiRequestError::displayMessage($exception, $this->provider, $this->model, false)
            : 'Job failed or timed out.';

        ConceptGraphRunJob::mark($this->runUuid, $this->jobKey, [
            'status' => 'failed',
            'attempts' => max(1, (int) $this->attempts()),
            'finished_at' => now(),
            'error_message' => $message,
        ]);
    }

    /**
     * @param  list<int>  $ids
     */
    protected function dispatchFollowUp(array $ids, string $followKey): void
    {
        self::dispatch(
            conceptIds: $ids,
            fromLocale: $this->fromLocale,
            toLocale: $this->toLocale,
            missingOnly: $this->missingOnly,
            provider: $this->provider,
            model: $this->model,
            runUuid: $this->runUuid,
            jobKey: $followKey,
        )->onQueue($this->queue ?? 'default');
    }

    protected function deferredDepthCapLogMessage(): string
    {
        return 'LocalizeConceptBatchJob: not re-queuing deferred concepts (follow-up depth cap)';
    }

    protected function deferredUnitLabel(): string
    {
        return 'concept(s)';
    }
}
