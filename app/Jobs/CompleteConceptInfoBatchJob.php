<?php

namespace App\Jobs;

use App\Models\ConceptGraphRun;
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
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

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

            if ($this->runUuid) {
                $status = $deferred > 0 ? 'partial' : 'succeeded';
                $message = $deferred > 0
                    ? "Stopped {$deferred} term(s) to stay under the worker timeout; remaining IDs were re-queued".($followKey ? " as {$followKey}" : '').'.'
                    : null;

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
        } catch (Throwable $e) {
            $willRetry = $this->attempts() < $this->tries;

            if ($this->runUuid) {
                ConceptGraphRunJob::query()
                    ->where('run_uuid', $this->runUuid)
                    ->where('seed', $this->jobKey)
                    ->update([
                        'status' => $willRetry ? 'processing' : 'failed',
                        'attempts' => (int) (($this->attempts() ?? 0)),
                        'finished_at' => $willRetry ? null : now(),
                        'error_message' => $e->getMessage(),
                    ]);
            }

            throw $e;
        }
    }

    public function failed(?Throwable $exception): void
    {
        if (! $this->runUuid) {
            return;
        }

        $message = $exception?->getMessage() ?: 'Job failed or timed out.';

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
     * @param  list<int>  $termIds
     */
    protected function requeueDeferred(array $termIds): ?string
    {
        $followKey = $this->nextDeferredJobKey();
        if ($followKey === null) {
            Log::warning('CompleteConceptInfoBatchJob: not re-queuing deferred terms (follow-up depth cap)', [
                'run_uuid' => $this->runUuid,
                'job_key' => $this->jobKey,
                'deferred' => count($termIds),
            ]);

            return null;
        }

        if ($this->runUuid) {
            $run = ConceptGraphRun::query()->where('run_uuid', $this->runUuid)->first();
            if ($run instanceof ConceptGraphRun) {
                $seeds = is_array($run->seeds) ? $run->seeds : [];
                $batches = is_array($seeds['batches'] ?? null) ? $seeds['batches'] : [];
                $batches[$followKey] = $termIds;
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
            termIds: $termIds,
            mode: $this->mode,
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
}
