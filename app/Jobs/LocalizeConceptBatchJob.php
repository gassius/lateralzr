<?php

namespace App\Jobs;

use App\Ai\Support\AiRequestError;
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
            $service->localize(
                fromLocale: $this->fromLocale,
                toLocale: $this->toLocale,
                limit: null,
                missingOnly: $this->missingOnly,
                batchSize: max(1, count($this->conceptIds)),
                agent: null,
                conceptIds: $this->conceptIds,
            );

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

            Log::info('LocalizeConceptBatchJob succeeded', [
                'run_uuid' => $this->runUuid,
                'job_key' => $this->jobKey,
                'seconds' => round(microtime(true) - $startedAt, 2),
                'attempt' => $this->attempts(),
                'count' => count($this->conceptIds),
                'provider' => $this->provider,
                'model' => $this->model,
            ]);
        } catch (Throwable $e) {
            $mapped = AiRequestError::displayMessage($e, $this->provider, $this->model);
            $retryable = AiRequestError::isRetryable($e);
            $willRetry = $retryable && $this->attempts() < $this->tries;

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
            ? AiRequestError::displayMessage($exception, $this->provider, $this->model)
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
}
