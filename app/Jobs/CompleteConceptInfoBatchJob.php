<?php

namespace App\Jobs;

use App\Jobs\Concerns\DeferredBatchFollowUp;
use App\Models\ConceptGraphRunJob;
use App\Services\ConceptCompleteInfoService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class CompleteConceptInfoBatchJob implements ShouldQueue
{
    use DeferredBatchFollowUp, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Wikipedia + Wikimedia lookups per term can exceed the default 60s timeout.
     */
    public int $timeout = 300;

    public bool $failOnTimeout = true;

    public int $tries = 3;

    public function backoff(): array
    {
        return [30, 90];
    }

    /**
     * @param  list<int>  $termIds
     * @param  'wiki'|'media'|'both'  $mode
     */
    public function __construct(
        public array $termIds,
        public string $mode,
        public ?string $runUuid,
        public string $jobKey,
    ) {}

    public function handle(ConceptCompleteInfoService $service): void
    {
        $startedAt = microtime(true);

        ConceptGraphRunJob::mark($this->runUuid, $this->jobKey, [
            'status' => 'processing',
            'attempts' => (int) (($this->attempts() ?? 0)),
            'started_at' => now(),
            'error_message' => null,
        ]);

        try {
            // Leave a margin under $timeout so Wikimedia slowness fails soft
            // (remaining terms are re-queued) instead of a worker SIGKILL.
            $deadlineAt = time() + max(30, $this->timeout - 60);

            $stats = $service->complete(
                termIds: $this->termIds,
                mode: $this->mode,
                deadlineAt: $deadlineAt,
            );

            $deferredIds = array_values(array_map('intval', $stats['deferredTermIds'] ?? []));
            $deferred = count($deferredIds);
            $followKey = null;
            if ($deferred > 0) {
                $followKey = $this->requeueDeferred($deferredIds);
            }

            Log::info('CompleteConceptInfoBatchJob finished', [
                'run_uuid' => $this->runUuid,
                'job_key' => $this->jobKey,
                'mode' => $this->mode,
                'count' => count($this->termIds),
                'seconds' => round(microtime(true) - $startedAt, 2),
                'stats' => $stats,
                'follow_key' => $followKey,
            ]);

            [$status, $message] = $this->deferredOutcome($deferred, $followKey);

            ConceptGraphRunJob::mark($this->runUuid, $this->jobKey, [
                'status' => $status,
                'attempts' => (int) (($this->attempts() ?? 0)),
                'finished_at' => now(),
                'error_message' => $message,
            ]);
        } catch (Throwable $e) {
            $willRetry = $this->attempts() < $this->tries;

            ConceptGraphRunJob::mark($this->runUuid, $this->jobKey, [
                'status' => $willRetry ? 'processing' : 'failed',
                'attempts' => (int) (($this->attempts() ?? 0)),
                'finished_at' => $willRetry ? null : now(),
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function failed(?Throwable $exception): void
    {
        if (! $this->runUuid) {
            return;
        }

        $message = $exception?->getMessage() ?: 'Job failed or timed out.';

        ConceptGraphRunJob::mark($this->runUuid, $this->jobKey, [
            'status' => 'failed',
            'attempts' => max(1, (int) (($this->attempts() ?? 0))),
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
            termIds: $ids,
            mode: $this->mode,
            runUuid: $this->runUuid,
            jobKey: $followKey,
        )->onQueue($this->queue ?? 'default');
    }

    protected function deferredDepthCapLogMessage(): string
    {
        return 'CompleteConceptInfoBatchJob: not re-queuing deferred terms (follow-up depth cap)';
    }

    protected function deferredUnitLabel(): string
    {
        return 'term(s)';
    }
}
