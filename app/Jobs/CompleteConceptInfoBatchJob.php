<?php

namespace App\Jobs;

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
            // (remaining terms stay blank and can be picked up by a later run)
            // instead of a worker SIGKILL that marks the batch failed.
            $deadlineAt = time() + max(30, $this->timeout - 60);

            $stats = $service->complete(
                termIds: $this->termIds,
                mode: $this->mode,
                deadlineAt: $deadlineAt,
            );

            Log::info('CompleteConceptInfoBatchJob succeeded', [
                'run_uuid' => $this->runUuid,
                'job_key' => $this->jobKey,
                'mode' => $this->mode,
                'count' => count($this->termIds),
                'stats' => $stats,
            ]);

            if ($this->runUuid) {
                ConceptGraphRunJob::query()
                    ->where('run_uuid', $this->runUuid)
                    ->where('seed', $this->jobKey)
                    ->update([
                        'status' => 'succeeded',
                        'attempts' => (int) (($this->attempts() ?? 0)),
                        'finished_at' => now(),
                        'error_message' => null,
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
}
