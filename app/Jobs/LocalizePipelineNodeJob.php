<?php

namespace App\Jobs;

use App\Ai\Support\AiConfigOverride;
use App\Ai\Support\AiRequestContext;
use App\Ai\Support\AiRequestError;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use App\Services\ConceptLocalizeService;
use App\Services\ConceptPipeline\ConceptPipelineDispatchService;
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

    public const SOFT_DEADLINE_MARGIN_SECONDS = 60;

    public bool $failOnTimeout = true;

    public int $tries = 3;

    public function backoff(): array
    {
        return [30, 90];
    }

    public function __construct(public int $nodeId, public string $locale) {}

    public function handle(
        ConceptLocalizeService $service,
        ConceptPipelineDispatchService $pipeline,
    ): void {
        $node = $this->node();
        $run = $node->run;
        if (! $run instanceof ConceptGraphRun) {
            throw new RuntimeException("Pipeline run missing for node {$this->nodeId}.");
        }

        $trackingKey = "pipeline-node-{$this->nodeId}-localize-{$this->locale}";

        if (in_array($node->localize_status, [
            ConceptPipelineNode::STATUS_SKIPPED,
            ConceptPipelineNode::STATUS_FAILED,
        ], true)) {
            return;
        }

        $node->markStage(ConceptPipelineNode::STAGE_LOCALIZE, ConceptPipelineNode::STATUS_PROCESSING);

        $fromLocale = ConceptLocale::default();
        $targets = $pipeline->targetLocales($run);
        $isLast = $targets === [] || $this->locale === $targets[array_key_last($targets)];

        if ($node->concept_id === null || $this->locale === '' || $this->locale === $fromLocale) {
            $node->markStage(
                ConceptPipelineNode::STAGE_LOCALIZE,
                ConceptPipelineNode::STATUS_SKIPPED,
                $node->concept_id === null
                    ? 'No concept to localise.'
                    : 'No target locales for this run.'
            );

            return;
        }

        AiConfigOverride::run($run->provider, $run->model, function () use ($service, $node, $run, $fromLocale, $isLast, $trackingKey): void {
            AiRequestContext::using($run->run_uuid, $trackingKey, function () use ($service, $node, $run, $fromLocale, $isLast, $trackingKey): void {
                try {
                    $deadlineAt = time() + max(30, $this->timeout - self::SOFT_DEADLINE_MARGIN_SECONDS);

                    $service->localize(
                        fromLocale: $fromLocale,
                        toLocale: $this->locale,
                        limit: null,
                        missingOnly: true,
                        batchSize: ConceptLocalizeService::DEFAULT_BATCH_SIZE,
                        agent: null,
                        conceptIds: [(int) $node->concept_id],
                        deadlineAt: $deadlineAt,
                    );

                    if ($isLast) {
                        $node->markStage(
                            ConceptPipelineNode::STAGE_LOCALIZE,
                            ConceptPipelineNode::STATUS_SUCCEEDED
                        );
                    }

                    Log::info('LocalizePipelineNodeJob succeeded', [
                        'run_uuid' => $run->run_uuid,
                        'node_id' => $node->id,
                        'job_key' => $trackingKey,
                        'locale' => $this->locale,
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
                        'locale' => $this->locale,
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
