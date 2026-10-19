<?php

namespace App\Jobs;

use App\Ai\Agents\ConceptsOnlyAgent;
use App\Ai\Support\AiConfigOverride;
use App\Ai\Support\AiRequestContext;
use App\Ai\Support\AiRequestError;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use App\Services\ConceptGraphStore;
use App\Services\ConceptPipeline\ConceptPipelineDispatchService;
use App\Services\ConceptRelationshipService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class GeneratePipelineNodeJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 300;

    public const SOFT_DEADLINE_MARGIN_SECONDS = 60;

    public const PERSIST_BUDGET_SECONDS = 20;

    public bool $failOnTimeout = true;

    public int $tries = 3;

    public function backoff(): array
    {
        return [30, 90];
    }

    public function __construct(public int $nodeId) {}

    public function handle(
        ConceptRelationshipService $service,
        ConceptGraphStore $store,
        ConceptPipelineDispatchService $pipeline,
    ): void {
        $node = $this->node();
        $run = $node->run;
        if (! $run instanceof ConceptGraphRun) {
            throw new RuntimeException("Pipeline run missing for node {$this->nodeId}.");
        }

        $maxDepth = (int) data_get($run->seeds, 'depth', ConceptPipelineDispatchService::DEFAULT_DEPTH);
        $trackingKey = $this->trackingKey();

        $node->markStage(ConceptPipelineNode::STAGE_GENERATE, ConceptPipelineNode::STATUS_PROCESSING);

        if ($node->depth >= $maxDepth) {
            $node->markStage(
                ConceptPipelineNode::STAGE_GENERATE,
                ConceptPipelineNode::STATUS_SKIPPED,
                'Node is at the run max depth; generate is not expanded.'
            );

            return;
        }

        $count = (int) data_get($run->seeds, 'count', ConceptPipelineDispatchService::DEFAULT_COUNT);
        $complexity = (int) $run->complexity;
        $provider = $run->provider;
        $model = $run->model;

        AiConfigOverride::run($provider, $model, function () use ($service, $store, $pipeline, $node, $run, $count, $complexity, $trackingKey): void {
            AiRequestContext::using($run->run_uuid, $trackingKey, function () use ($service, $store, $pipeline, $node, $run, $count, $complexity, $trackingKey): void {
                try {
                    $deadlineAt = time() + max(30, $this->timeout - self::SOFT_DEADLINE_MARGIN_SECONDS);

                    if ($this->secondsUntilDeadline($deadlineAt) < ConceptsOnlyAgent::HTTP_TIMEOUT_SECONDS + self::PERSIST_BUDGET_SECONDS) {
                        $node->markStage(
                            ConceptPipelineNode::STAGE_GENERATE,
                            ConceptPipelineNode::STATUS_FAILED,
                            'Not enough time to start the LLM before the worker timeout.'
                        );
                        $node->skipPendingStages();

                        return;
                    }

                    $result = $service->generateRelationships(
                        startConcept: $node->seed_term,
                        count: $count,
                        agent: null,
                        complexity: $complexity
                    );

                    if ($this->secondsUntilDeadline($deadlineAt) < self::PERSIST_BUDGET_SECONDS) {
                        $node->markStage(
                            ConceptPipelineNode::STAGE_GENERATE,
                            ConceptPipelineNode::STATUS_FAILED,
                            'LLM finished too close to the worker timeout; graph was not persisted.'
                        );
                        $node->skipPendingStages();

                        return;
                    }

                    $provider = AiRequestContext::lastSentProvider() ?? $run->provider;
                    $model = AiRequestContext::lastSentModel() ?? $run->model;

                    $resolved = $store->storeGraph(
                        concepts: $result['concepts'] ?? [],
                        edges: $result['edges'] ?? [],
                        complexity: (int) ($result['complexity'] ?? $complexity),
                        provider: $provider,
                        model: $model,
                        runUuid: $run->run_uuid
                    );

                    $seedConcept = $resolved[$node->canonical_key] ?? null;
                    if ($seedConcept === null && $node->concept_id !== null) {
                        foreach ($resolved as $concept) {
                            if ((int) $concept->id === (int) $node->concept_id) {
                                $seedConcept = $concept;
                                break;
                            }
                        }
                    }

                    $createdIds = [];
                    foreach ($resolved as $key => $concept) {
                        if ($key === $node->canonical_key) {
                            continue;
                        }
                        if ($seedConcept !== null && (int) $concept->id === (int) $seedConcept->id) {
                            continue;
                        }
                        $createdIds[] = (int) $concept->id;
                    }

                    $node->forceFill([
                        'concept_id' => $seedConcept?->id ?? $node->concept_id,
                        'created_concept_ids' => $createdIds,
                    ])->save();

                    $pipeline->enqueueChildren($node, $resolved);

                    $node->markStage(
                        ConceptPipelineNode::STAGE_GENERATE,
                        ConceptPipelineNode::STATUS_SUCCEEDED
                    );

                    Log::info('GeneratePipelineNodeJob succeeded', [
                        'run_uuid' => $run->run_uuid,
                        'node_id' => $node->id,
                        'job_key' => $trackingKey,
                        'attempt' => $this->attempts(),
                        'provider' => $provider,
                        'model' => $model,
                        'created' => count($createdIds),
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

                    Log::warning('GeneratePipelineNodeJob failed', [
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
                            ConceptPipelineNode::STAGE_GENERATE,
                            ConceptPipelineNode::STATUS_PROCESSING,
                            $mapped
                        );

                        throw $e;
                    }

                    $node->markStage(
                        ConceptPipelineNode::STAGE_GENERATE,
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

        if ($node->generate_status === ConceptPipelineNode::STATUS_FAILED) {
            return;
        }

        $run = $node->run;
        $message = $exception
            ? AiRequestError::displayMessage($exception, $run?->provider, $run?->model, false)
            : 'Job failed or timed out.';

        $node->markStage(ConceptPipelineNode::STAGE_GENERATE, ConceptPipelineNode::STATUS_FAILED, $message);
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

    protected function trackingKey(): string
    {
        return "pipeline-node-{$this->nodeId}-generate";
    }

    protected function secondsUntilDeadline(int $deadlineAt): int
    {
        return $deadlineAt - time();
    }
}
