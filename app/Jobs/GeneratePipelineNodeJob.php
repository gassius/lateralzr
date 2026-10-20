<?php

namespace App\Jobs;

use App\Ai\Agents\ConceptsOnlyAgent;
use App\Ai\Support\AiConfigOverride;
use App\Ai\Support\AiRequestContext;
use App\Ai\Support\AiRequestError;
use App\Models\Concept;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use App\Models\ConceptTerm;
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
                $reserved = 0;
                try {
                    $deadlineAt = time() + max(30, $this->timeout - self::SOFT_DEADLINE_MARGIN_SECONDS);

                    if ($this->secondsUntilDeadline($deadlineAt) < ConceptsOnlyAgent::HTTP_TIMEOUT_SECONDS + self::PERSIST_BUDGET_SECONDS) {
                        $this->failGenerate(
                            $node,
                            'Not enough time to start the LLM before the worker timeout.'
                        );

                        return;
                    }

                    $reserved = $pipeline->reserveConceptBudget($run, $count);
                    if ($reserved <= 0) {
                        $node->markStage(
                            ConceptPipelineNode::STAGE_GENERATE,
                            ConceptPipelineNode::STATUS_SKIPPED,
                            'Concept budget for this run is exhausted.'
                        );

                        return;
                    }

                    $result = $service->generateRelationships(
                        startConcept: $node->seed_term,
                        count: $reserved,
                        agent: null,
                        complexity: $complexity
                    );

                    if ($this->secondsUntilDeadline($deadlineAt) < self::PERSIST_BUDGET_SECONDS) {
                        $pipeline->settleConceptBudget($run, $reserved, 0);
                        $reserved = 0;
                        $this->failGenerate(
                            $node,
                            'LLM finished too close to the worker timeout; graph was not persisted.'
                        );

                        return;
                    }

                    $provider = AiRequestContext::lastSentProvider() ?? $run->provider;
                    $model = AiRequestContext::lastSentModel() ?? $run->model;

                    [$kept] = $pipeline->limitNewConcepts(
                        is_array($result['concepts'] ?? null) ? $result['concepts'] : [],
                        $node->canonical_key,
                        $reserved
                    );
                    $preIds = $this->existingConceptIds($kept);

                    $resolved = $store->storeGraph(
                        concepts: $kept,
                        edges: $result['edges'] ?? [],
                        complexity: (int) ($result['complexity'] ?? $complexity),
                        provider: $provider,
                        model: $model,
                        runUuid: $run->run_uuid
                    );
                    $created = $this->countNewConcepts($resolved, $preIds);
                    $pipeline->settleConceptBudget($run, $reserved, $created);
                    $reserved = 0;

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
                    if ($reserved > 0) {
                        // Release unused reservation so retries and sibling nodes can use the budget.
                        $pipeline->settleConceptBudget($run, $reserved, 0);
                    }

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

    protected function failGenerate(ConceptPipelineNode $node, string $message): void
    {
        $node->markStage(
            ConceptPipelineNode::STAGE_GENERATE,
            ConceptPipelineNode::STATUS_FAILED,
            $message
        );
        $node->skipPendingStages();
        $this->fail(new RuntimeException($message));
    }

    /**
     * @param  list<array<string, mixed>>  $concepts
     * @return list<int>
     */
    protected function existingConceptIds(array $concepts): array
    {
        $keys = [];
        foreach ($concepts as $concept) {
            $key = ConceptTerm::normalizeTerm((string) ($concept['concept'] ?? ''));
            if ($key !== '') {
                $keys[] = $key;
            }
        }

        if ($keys === []) {
            return [];
        }

        return Concept::query()
            ->whereIn('canonical_key', $keys)
            ->pluck('id')
            ->merge(
                ConceptTerm::query()
                    ->whereIn('normalized_term', $keys)
                    ->pluck('concept_id')
            )
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, Concept>  $resolved
     * @param  list<int>  $preIds
     */
    protected function countNewConcepts(array $resolved, array $preIds): int
    {
        $pre = array_fill_keys($preIds, true);
        $seen = [];
        $created = 0;

        foreach ($resolved as $concept) {
            $id = (int) $concept->id;
            if (isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            if (! isset($pre[$id])) {
                $created++;
            }
        }

        return $created;
    }

    protected function secondsUntilDeadline(int $deadlineAt): int
    {
        return $deadlineAt - time();
    }
}
