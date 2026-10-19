<?php

namespace App\Services\ScheduledTasks;

use App\Models\Concept;
use App\Models\ScheduledTask;
use App\Services\ConceptPipeline\ConceptPipelineDispatchService;

class GrowSparseHandler implements ScheduledTaskHandler
{
    public function __construct(
        protected ConceptPipelineDispatchService $pipeline,
    ) {}

    public function handle(ScheduledTask $task): array
    {
        $threshold = max(0, (int) $task->option('threshold', 2));
        $cap = max(1, (int) $task->per_run_cap);
        $count = max(1, min(100, (int) $task->option('count', ConceptPipelineDispatchService::DEFAULT_COUNT)));
        $complexity = max(1, min(5, (int) $task->option('complexity', ConceptPipelineDispatchService::DEFAULT_COMPLEXITY)));
        $depth = max(1, min(ConceptPipelineDispatchService::MAX_DEPTH, (int) $task->option('depth', ConceptPipelineDispatchService::DEFAULT_DEPTH)));

        $relationshipCountSql = '(select count(*) from concept_relationships where concept_relationships.from_concept_id = concepts.id or concept_relationships.to_concept_id = concepts.id)';

        $concepts = Concept::query()
            ->whereNull('merged_into_concept_id')
            ->with('preferredTerm')
            ->whereRaw("{$relationshipCountSql} < ?", [$threshold])
            ->orderByRaw("{$relationshipCountSql} asc")
            ->orderBy('id')
            ->limit($cap)
            ->get();

        $labels = [];
        foreach ($concepts as $concept) {
            $labels[] = $concept->preferredTerm?->term ?? (string) $concept->canonical_key;
        }

        if ($labels === []) {
            return [
                'items_processed' => 0,
                'pipeline_run_uuid' => null,
                'details' => [
                    'threshold' => $threshold,
                    'concept_ids' => [],
                    'run_uuids' => [],
                ],
            ];
        }

        $run = $this->pipeline->dispatch(
            concepts: $labels,
            count: $count,
            complexity: $complexity,
            depth: $depth,
        );

        return [
            'items_processed' => count($labels),
            'pipeline_run_uuid' => $run->run_uuid,
            'details' => [
                'threshold' => $threshold,
                'concept_ids' => $concepts->pluck('id')->map(fn ($id) => (int) $id)->all(),
                'run_uuids' => [$run->run_uuid],
            ],
        ];
    }
}
