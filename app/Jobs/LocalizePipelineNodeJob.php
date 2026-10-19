<?php

namespace App\Jobs;

use App\Ai\Support\AiConfigOverride;
use App\Ai\Support\AiRequestContext;
use App\Ai\Support\AiRequestError;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use App\Services\ConceptLocalizeService;
use App\Support\ConceptLocale;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class LocalizePipelineNodeJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 300;

    public bool $failOnTimeout = true;

    public int $tries = 3;

    public function backoff(): array
    {
        return [30, 90];
    }

    public function __construct(public int $nodeId) {}

    public function handle(ConceptLocalizeService $service): void
    {
        $node = $this->node();
        $run = $node->run;
        if (! $run instanceof ConceptGraphRun) {
            throw new RuntimeException("Pipeline run missing for node {$this->nodeId}.");
        }

        $trackingKey = "pipeline-node-{$this->nodeId}-localize";
        $node->markStage(ConceptPipelineNode::STAGE_LOCALIZE, ConceptPipelineNode::STATUS_PROCESSING);

        $locales = data_get($run->seeds, 'locales', []);
        $locales = is_array($locales) ? array_values(array_filter($locales, 'is_string')) : [];
        $fromLocale = ConceptLocale::default();
        $locales = array_values(array_filter($locales, fn (string $locale): bool => $locale !== $fromLocale));

        if ($node->concept_id === null || $locales === []) {
            $node->markStage(
                ConceptPipelineNode::STAGE_LOCALIZE,
                ConceptPipelineNode::STATUS_SKIPPED,
                $node->concept_id === null
                    ? 'No concept to localise.'
                    : 'No target locales for this run.'
            );

            return;
        }

        AiConfigOverride::run($run->provider, $run->model, function () use ($service, $node, $run, $fromLocale, $locales, $trackingKey): void {
            AiRequestContext::using($run->run_uuid, $trackingKey, function () use ($service, $node, $run, $fromLocale, $locales, $trackingKey): void {
                try {
                    foreach ($locales as $toLocale) {
                        $service->localize(
                            fromLocale: $fromLocale,
                            toLocale: $toLocale,
                            limit: null,
                            missingOnly: true,
                            batchSize: ConceptLocalizeService::DEFAULT_BATCH_SIZE,
                            agent: null,
                            conceptIds: [(int) $node->concept_id],
                        );
                    }

                    $node->markStage(
                        ConceptPipelineNode::STAGE_LOCALIZE,
                        ConceptPipelineNode::STATUS_SUCCEEDED
                    );

                    Log::info('LocalizePipelineNodeJob succeeded', [
                        'run_uuid' => $run->run_uuid,
                        'node_id' => $node->id,
                        'job_key' => $trackingKey,
                        'locales' => $locales,
                        'attempt' => $this->attempts(),
                    ]);
                } catch (Throwable $e) {
                    $retryable = AiRequestError::isRetryable($e);
                    $willRetry = $retryable && $this->attempts() < $this->tries;
                    $mapped = AiRequestError::displayMessage(
                        $e,
                        AiRequestContext::lastSentProvider() ?? $run->provider,
                        AiRequestContext::lastSentModel() ?? $run->model,
                        $willRetry
                    );

                    Log::warning('LocalizePipelineNodeJob failed', [
                        'run_uuid' => $run->run_uuid,
                        'node_id' => $node->id,
                        'job_key' => $trackingKey,
                        'attempt' => $this->attempts(),
                        'retryable' => $retryable,
                        'will_retry' => $willRetry,
                        'error' => $mapped,
                    ]);

                    if ($willRetry) {
                        $node->markStage(
                            ConceptPipelineNode::STAGE_LOCALIZE,
                            ConceptPipelineNode::STATUS_PROCESSING,
                            $mapped
                        );

                        throw $e;
                    }

                    $node->markStage(
                        ConceptPipelineNode::STAGE_LOCALIZE,
                        ConceptPipelineNode::STATUS_FAILED,
                        $mapped
                    );
                    $node->skipPendingStages();

                    $this->fail(new RuntimeException($mapped, 0, $e));
                }
            });
        });
    }

    public function failed(?Throwable $exception): void
    {
        $node = ConceptPipelineNode::query()->find($this->nodeId);
        if (! $node instanceof ConceptPipelineNode) {
            return;
        }

        if ($node->localize_status === ConceptPipelineNode::STATUS_FAILED) {
            return;
        }

        $run = $node->run;
        $message = $exception
            ? AiRequestError::displayMessage($exception, $run?->provider, $run?->model, false)
            : 'Job failed or timed out.';

        $node->markStage(ConceptPipelineNode::STAGE_LOCALIZE, ConceptPipelineNode::STATUS_FAILED, $message);
        $node->skipPendingStages();
    }

    protected function node(): ConceptPipelineNode
    {
        $node = ConceptPipelineNode::query()->find($this->nodeId);
        if (! $node instanceof ConceptPipelineNode) {
            throw new RuntimeException("Pipeline node {$this->nodeId} not found.");
        }

        return $node;
    }
}
