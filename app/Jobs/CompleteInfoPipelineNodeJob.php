<?php

namespace App\Jobs;

use App\Models\ConceptPipelineNode;
use App\Models\ConceptTerm;
use App\Services\ConceptCompleteInfoService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class CompleteInfoPipelineNodeJob implements ShouldQueue
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

    public function handle(ConceptCompleteInfoService $service): void
    {
        $node = $this->node();
        $node->markStage(ConceptPipelineNode::STAGE_COMPLETE_INFO, ConceptPipelineNode::STATUS_PROCESSING);

        if ($node->concept_id === null) {
            $node->markStage(
                ConceptPipelineNode::STAGE_COMPLETE_INFO,
                ConceptPipelineNode::STATUS_SKIPPED,
                'No concept to complete.'
            );

            return;
        }

        $termIds = ConceptTerm::query()
            ->where('concept_id', $node->concept_id)
            ->orderBy('id')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($termIds === []) {
            $node->markStage(
                ConceptPipelineNode::STAGE_COMPLETE_INFO,
                ConceptPipelineNode::STATUS_SKIPPED,
                'Concept has no terms to complete.'
            );

            return;
        }

        try {
            $deadlineAt = time() + max(30, $this->timeout - 60);
            $stats = $service->complete(
                termIds: $termIds,
                mode: 'both',
                deadlineAt: $deadlineAt,
            );

            $failed = (int) ($stats['failed'] ?? 0);

            if ($failed > 0 && (int) ($stats['wikiUpdated'] ?? 0) === 0 && (int) ($stats['mediaUpdated'] ?? 0) === 0) {
                $node->markStage(
                    ConceptPipelineNode::STAGE_COMPLETE_INFO,
                    ConceptPipelineNode::STATUS_FAILED,
                    'Complete-info failed for this concept.'
                );

                return;
            }

            $node->markStage(
                ConceptPipelineNode::STAGE_COMPLETE_INFO,
                ConceptPipelineNode::STATUS_SUCCEEDED
            );

            Log::info('CompleteInfoPipelineNodeJob finished', [
                'run_uuid' => $node->run_uuid,
                'node_id' => $node->id,
                'stats' => $stats,
                'attempt' => $this->attempts(),
            ]);
        } catch (Throwable $e) {
            Log::warning('CompleteInfoPipelineNodeJob failed', [
                'run_uuid' => $node->run_uuid,
                'node_id' => $node->id,
                'attempt' => $this->attempts(),
                'error' => $e->getMessage(),
            ]);

            $node->markStage(
                ConceptPipelineNode::STAGE_COMPLETE_INFO,
                ConceptPipelineNode::STATUS_FAILED,
                $e->getMessage()
            );

            throw $e;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $node = ConceptPipelineNode::query()->find($this->nodeId);
        if (! $node instanceof ConceptPipelineNode) {
            return;
        }

        if ($node->complete_info_status === ConceptPipelineNode::STATUS_FAILED) {
            return;
        }

        $node->markStage(
            ConceptPipelineNode::STAGE_COMPLETE_INFO,
            ConceptPipelineNode::STATUS_FAILED,
            $exception?->getMessage() ?: 'Job failed or timed out.'
        );
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
