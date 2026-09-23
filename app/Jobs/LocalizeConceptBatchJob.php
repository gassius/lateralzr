<?php

namespace App\Jobs;

use App\Ai\Support\AiRequestError;
use App\Models\ConceptGraphRun;
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
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

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

        if ($this->runUuid) {
            ConceptGraphRunJob::query()
                ->where('run_uuid', $this->runUuid)
                ->where('seed', $this->jobKey)
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

            if ($this->runUuid) {
                [$status, $message] = $this->deferredOutcome($deferred, $followKey);

                ConceptGraphRunJob::query()
                    ->where('run_uuid', $this->runUuid)
                    ->where('seed', $this->jobKey)
                    ->update([
                        'status' => $status,
                        'attempts' => (int) (($this->attempts() ?? 0)),
                        'finished_at' => now(),
                        'error_message' => $message,
                    ]);
            }

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

            if ($this->runUuid) {
                ConceptGraphRunJob::query()
                    ->where('run_uuid', $this->runUuid)
                    ->where('seed', $this->jobKey)
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
        if (! $this->runUuid) {
            return;
        }

        $message = $exception
            ? AiRequestError::displayMessage($exception, $this->provider, $this->model, false)
            : 'Job failed or timed out.';

        ConceptGraphRunJob::query()
            ->where('run_uuid', $this->runUuid)
            ->where('seed', $this->jobKey)
            ->update([
                'status' => 'failed',
                'attempts' => max(1, (int) (($this->attempts() ?? 0))),
                'finished_at' => now(),
                'error_message' => $message,
            ]);
    }

    /**
     * @param  list<int>  $conceptIds
     */
    protected function requeueDeferred(array $conceptIds): ?string
    {
        $followKey = $this->nextDeferredJobKey();
        if ($followKey === null) {
            Log::warning('LocalizeConceptBatchJob: not re-queuing deferred concepts (follow-up depth cap)', [
                'run_uuid' => $this->runUuid,
                'job_key' => $this->jobKey,
                'deferred' => count($conceptIds),
            ]);

            return null;
        }

        if ($this->runUuid) {
            $run = ConceptGraphRun::query()->where('run_uuid', $this->runUuid)->first();
            if ($run instanceof ConceptGraphRun) {
                $seeds = is_array($run->seeds) ? $run->seeds : [];
                $batches = is_array($seeds['batches'] ?? null) ? $seeds['batches'] : [];
                $batches[$followKey] = $conceptIds;
                $seeds['batches'] = $batches;
                $run->seeds = $seeds;
                $run->seed_count = count($batches);
                $run->save();
            }

            ConceptGraphRunJob::query()->create([
                'run_uuid' => $this->runUuid,
                'seed' => $followKey,
                'status' => 'pending',
                'attempts' => 0,
            ]);
        }

        self::dispatch(
            conceptIds: $conceptIds,
            fromLocale: $this->fromLocale,
            toLocale: $this->toLocale,
            missingOnly: $this->missingOnly,
            provider: $this->provider,
            model: $this->model,
            runUuid: $this->runUuid,
            jobKey: $followKey,
        )->onQueue($this->queue ?? 'default');

        return $followKey;
    }

    protected function nextDeferredJobKey(): ?string
    {
        $base = $this->jobKey;
        $suffix = 1;
        if (preg_match('/^(.*)\+(\d+)$/', $this->jobKey, $matches) === 1) {
            $base = $matches[1];
            $suffix = (int) $matches[2] + 1;
        }

        if ($suffix > 20) {
            return null;
        }

        return $base.'+'.$suffix;
    }

    /**
     * @return array{0:string,1:?string}
     */
    protected function deferredOutcome(int $deferred, ?string $followKey): array
    {
        if ($deferred === 0) {
            return ['succeeded', null];
        }

        if ($followKey !== null) {
            return [
                'partial',
                "Stopped {$deferred} concept(s) to stay under the worker timeout; remaining IDs were re-queued as {$followKey}.",
            ];
        }

        return [
            'failed',
            "Stopped {$deferred} concept(s) to stay under the worker timeout; remaining IDs were not re-queued (follow-up depth cap).",
        ];
    }
}
