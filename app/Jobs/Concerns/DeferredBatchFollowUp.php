<?php

namespace App\Jobs\Concerns;

use App\Models\ConceptGraphRun;
use App\Models\ConceptGraphRunJob;
use Illuminate\Support\Facades\Log;

trait DeferredBatchFollowUp
{
    /**
     * @param  list<int>  $ids
     */
    protected function requeueDeferred(array $ids): ?string
    {
        $followKey = $this->nextDeferredJobKey();
        if ($followKey === null) {
            Log::warning($this->deferredDepthCapLogMessage(), [
                'run_uuid' => $this->runUuid,
                'job_key' => $this->jobKey,
                'deferred' => count($ids),
            ]);

            return null;
        }

        if ($this->runUuid) {
            $run = ConceptGraphRun::query()->where('run_uuid', $this->runUuid)->first();
            if ($run instanceof ConceptGraphRun) {
                $seeds = is_array($run->seeds) ? $run->seeds : [];
                $batches = is_array($seeds['batches'] ?? null) ? $seeds['batches'] : [];
                $batches[$followKey] = $ids;
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

        $this->dispatchFollowUp($ids, $followKey);

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

        $unit = $this->deferredUnitLabel();

        if ($followKey !== null) {
            return [
                'partial',
                "Stopped {$deferred} {$unit} to stay under the worker timeout; remaining IDs were re-queued as {$followKey}.",
            ];
        }

        return [
            $this->deferredCapStatus(),
            "Stopped {$deferred} {$unit} to stay under the worker timeout; remaining IDs were not re-queued (follow-up depth cap).",
        ];
    }

    /**
     * @param  list<int>  $ids
     */
    abstract protected function dispatchFollowUp(array $ids, string $followKey): void;

    abstract protected function deferredDepthCapLogMessage(): string;

    abstract protected function deferredUnitLabel(): string;

    /**
     * Status when remainder IDs are dropped at the follow-up depth cap.
     *
     * Use partial: earlier hops (and possibly this one) already persisted work;
     * only the deferred remainder was not re-queued. failed is reserved for
     * exceptions and worker timeouts. Filament Retry batch is offered for both
     * statuses; the dashboard error metric and failed-job column count failed only.
     */
    protected function deferredCapStatus(): string
    {
        return 'partial';
    }
}
