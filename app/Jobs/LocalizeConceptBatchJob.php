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
use RuntimeException;
use Throwable;

class LocalizeConceptBatchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * LLM batch translation plus per-term Wikipedia lookups can exceed the
     * default 60s worker timeout.
     */
    public int $timeout = 300;

    public bool $failOnTimeout = true;

    public int $tries = 3;

    public function backoff(): array
    {
        return [20, 60];
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
        } catch (Throwable $e) {
            $mapped = AiRequestError::displayMessage($e, $this->provider, $this->model);
            $retryable = AiRequestError::isRetryable($e);
            $willRetry = $retryable && $this->attempts() < $this->tries;

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
