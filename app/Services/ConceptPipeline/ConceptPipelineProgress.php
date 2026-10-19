<?php

namespace App\Services\ConceptPipeline;

use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use Illuminate\Support\Collection;

class ConceptPipelineProgress
{
    public const POLL_INTERVAL = '5s';

    /**
     * @var list<string>
     */
    public const STATUSES = [
        ConceptPipelineNode::STATUS_PENDING,
        ConceptPipelineNode::STATUS_PROCESSING,
        ConceptPipelineNode::STATUS_SUCCEEDED,
        ConceptPipelineNode::STATUS_FAILED,
        ConceptPipelineNode::STATUS_SKIPPED,
    ];

    /**
     * @var Collection<int, ConceptPipelineNode>
     */
    protected Collection $nodes;

    public function __construct(protected ConceptGraphRun $run)
    {
        $this->nodes = $run->pipelineNodes
            ->sortBy([
                ['depth', 'asc'],
                ['id', 'asc'],
            ])
            ->values();
    }

    public static function for(ConceptGraphRun $run): self
    {
        $run->loadMissing('pipelineNodes');

        return new self($run);
    }

    public function run(): ConceptGraphRun
    {
        return $this->run;
    }

    /**
     * @return array<string, array<string, int>>
     */
    public function stageCounts(): array
    {
        $empty = array_fill_keys(self::STATUSES, 0);
        $counts = [];

        foreach (ConceptPipelineNode::STAGES as $stage) {
            $counts[$stage] = $empty;
        }

        foreach ($this->nodes as $node) {
            foreach (ConceptPipelineNode::STAGES as $stage) {
                $status = $node->statusFor($stage);
                if (! array_key_exists($status, $counts[$stage])) {
                    $counts[$stage][$status] = 0;
                }
                $counts[$stage][$status]++;
            }
        }

        return $counts;
    }

    /**
     * @return array<int, list<array{id: int, name: string, depth: int, stages: array<string, array{status: string, error: string|null}>}>>
     */
    public function nodesByDepth(): array
    {
        $grouped = [];

        foreach ($this->nodes as $node) {
            $depth = (int) $node->depth;
            $stages = [];
            foreach (ConceptPipelineNode::STAGES as $stage) {
                $stages[$stage] = [
                    'status' => $node->statusFor($stage),
                    'error' => $node->errorFor($stage),
                ];
            }

            $grouped[$depth][] = [
                'id' => (int) $node->id,
                'name' => (string) $node->seed_term,
                'depth' => $depth,
                'stages' => $stages,
            ];
        }

        ksort($grouped);

        return $grouped;
    }

    /**
     * @return list<array{node_id: int, name: string, depth: int, stage: string, error: string|null}>
     */
    public function failures(): array
    {
        $failures = [];

        foreach ($this->nodes as $node) {
            foreach (ConceptPipelineNode::STAGES as $stage) {
                if ($node->statusFor($stage) !== ConceptPipelineNode::STATUS_FAILED) {
                    continue;
                }

                $failures[] = [
                    'node_id' => (int) $node->id,
                    'name' => (string) $node->seed_term,
                    'depth' => (int) $node->depth,
                    'stage' => $stage,
                    'error' => $node->errorFor($stage),
                ];
            }
        }

        return $failures;
    }

    public function completedStageCount(): int
    {
        $completed = 0;

        foreach ($this->nodes as $node) {
            foreach (ConceptPipelineNode::STAGES as $stage) {
                if (ConceptPipelineNode::isTerminalStatus($node->statusFor($stage))) {
                    $completed++;
                }
            }
        }

        return $completed;
    }

    public function totalStageCount(): int
    {
        return $this->nodes->count() * count(ConceptPipelineNode::STAGES);
    }

    public function percent(): float
    {
        $total = $this->totalStageCount();
        if ($total === 0) {
            return 0.0;
        }

        return round(100 * $this->completedStageCount() / $total, 1);
    }

    public function averageFinishedNodeDurationSeconds(): ?int
    {
        $durations = [];

        foreach ($this->nodes as $node) {
            $duration = $node->finishedDurationSeconds();
            if ($duration === null) {
                continue;
            }

            $durations[] = $duration;
        }

        if ($durations === []) {
            return null;
        }

        return (int) round(array_sum($durations) / count($durations));
    }

    public function unfinishedNodeCount(): int
    {
        return $this->nodes->filter(fn (ConceptPipelineNode $node): bool => ! $node->isFinished())->count();
    }

    public function estimatedRemainingSeconds(): ?int
    {
        if (! $this->isActive()) {
            return null;
        }

        $average = $this->averageFinishedNodeDurationSeconds();
        if ($average === null) {
            return null;
        }

        return $average * $this->unfinishedNodeCount();
    }

    public function isActive(): bool
    {
        return $this->nodes->contains(fn (ConceptPipelineNode $node): bool => $node->hasActiveStage());
    }

    public function pollingInterval(): ?string
    {
        return $this->isActive() ? self::POLL_INTERVAL : null;
    }
}
