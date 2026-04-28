<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptRelationship;

class ConceptGraphQuery
{
    /**
     * Fetch a graph-shaped neighborhood from the prefetched DB graph.
     *
     * @return array{start:array{id:int,label:string},nodes:array<int,array<string,mixed>>,edges:array<int,array<string,mixed>>,meta:array<string,mixed>}|null
     */
    public function getGraph(?string $startConcept, int $limit = 100, int $depth = 2, float $minStrength = 0.0): ?array
    {
        $limit = max(1, min(500, $limit));
        $depth = max(1, min(5, $depth));
        $minStrength = max(0.0, min(1.0, $minStrength));

        $start = $this->resolveStart($startConcept);
        if ($start === null) {
            return null;
        }

        $edgeMap = [];
        $nodeIds = [$start->id => true];
        $visited = [$start->id => true];
        $frontier = [$start->id];
        $hasMore = false;

        for ($hop = 1; $hop <= $depth && $frontier !== [] && count($edgeMap) < $limit; $hop++) {
            $remaining = $limit - count($edgeMap);
            $edges = ConceptRelationship::query()
                ->with(['fromConcept.preferredTerm', 'toConcept.preferredTerm'])
                ->where('strength', '>=', $minStrength)
                ->where(function ($q) use ($frontier) {
                    $q->whereIn('from_concept_id', $frontier)
                        ->orWhereIn('to_concept_id', $frontier);
                })
                ->orderByDesc('strength')
                ->orderByDesc('llm_occurrences')
                ->limit($remaining + 1)
                ->get();

            if ($edges->count() > $remaining) {
                $hasMore = true;
            }

            $nextFrontier = [];
            foreach ($edges->take($remaining) as $edge) {
                $edgeMap[$edge->id] = $edge;
                $nodeIds[$edge->from_concept_id] = true;
                $nodeIds[$edge->to_concept_id] = true;

                foreach ([$edge->from_concept_id, $edge->to_concept_id] as $candidateId) {
                    if (! isset($visited[$candidateId])) {
                        $visited[$candidateId] = true;
                        $nextFrontier[] = $candidateId;
                    }
                }
            }

            $frontier = array_values(array_unique($nextFrontier));
        }

        if ($edgeMap === []) {
            return null;
        }

        $nodes = Concept::query()
            ->with('preferredTerm')
            ->whereIn('id', array_keys($nodeIds))
            ->get()
            ->map(fn (Concept $concept) => $this->formatNode($concept))
            ->values()
            ->all();

        return [
            'start' => [
                'id' => (int) $start->id,
                'label' => (string) ($start->display_term ?? ''),
            ],
            'nodes' => $nodes,
            'edges' => collect($edgeMap)
                ->map(fn (ConceptRelationship $edge) => $this->formatEdge($edge))
                ->values()
                ->all(),
            'meta' => [
                'depth' => $depth,
                'limit' => $limit,
                'minStrength' => $minStrength,
                'hasMore' => $hasMore,
            ],
        ];
    }

    protected function resolveStart(?string $startConcept): ?Concept
    {
        if ($startConcept !== null && trim($startConcept) !== '') {
            $normalized = \App\Models\ConceptTerm::normalizeTerm($startConcept);

            // Resolve via term in default locale; do not silently swap to a random start.
            $locale = (string) config('concepts.default_locale', 'en');

            return Concept::query()
                ->with('preferredTerm')
                ->whereHas('terms', function ($q) use ($locale, $normalized) {
                    $q->where('locale', $locale)->where('normalized_term', $normalized);
                })
                ->first();
        }

        // Prefer concepts that actually have edges.
        $startId = ConceptRelationship::query()
            ->inRandomOrder()
            ->value('from_concept_id');

        if ($startId) {
            return Concept::query()->with('preferredTerm')->find($startId);
        }

        // No prefetched graph yet.
        return null;
    }

    /**
     * Legacy adapter kept for older tests/callers during the endpoint transition.
     */
    public function getFromDb(?string $seedConcept, ?int $count, int $complexity): ?array
    {
        $graph = $this->getGraph($seedConcept, $count ?? 5, 1);
        if ($graph === null) {
            return null;
        }

        $nodesById = collect($graph['nodes'])->keyBy('id');
        $seed = $nodesById->get($graph['start']['id']);

        return [
            'complexity' => max(1, min(5, $complexity)),
            'seed' => [
                'concept' => (string) ($seed['label'] ?? ''),
                'shortDescription' => (string) ($seed['shortDescription'] ?? ''),
                'wikiUrl' => $seed['wikiUrl'] ?? null,
                'mediaUrl' => $seed['mediaUrl'] ?? null,
            ],
            'related_concepts' => collect($graph['edges'])->map(function (array $edge) use ($nodesById, $graph) {
                $toId = $edge['from'] === $graph['start']['id'] ? $edge['to'] : $edge['from'];
                $node = $nodesById->get($toId);

                return [
                    'concept' => (string) ($node['label'] ?? ''),
                    'shortDescription' => (string) ($node['shortDescription'] ?? ''),
                    'larelality' => (int) ($edge['laterality'] ?? 1),
                    'wikiUrl' => $node['wikiUrl'] ?? null,
                    'mediaUrl' => $node['mediaUrl'] ?? null,
                ];
            })->values()->all(),
        ];
    }

    protected function formatNode(Concept $concept): array
    {
        return [
            'id' => (int) $concept->id,
            'label' => (string) ($concept->display_term ?? ''),
            'shortDescription' => (string) ($concept->display_short_description ?? ''),
            'complexity' => (int) $concept->display_complexity,
            'wikiUrl' => $concept->display_wiki_url,
            'mediaUrl' => $concept->display_media_url,
            'degree' => ConceptRelationship::query()
                ->where('from_concept_id', $concept->id)
                ->orWhere('to_concept_id', $concept->id)
                ->count(),
        ];
    }

    protected function formatEdge(ConceptRelationship $edge): array
    {
        return [
            'id' => (int) $edge->id,
            'from' => (int) $edge->from_concept_id,
            'to' => (int) $edge->to_concept_id,
            'strength' => (float) $edge->strength,
            'laterality' => (int) ($edge->last_laterality ?? 1),
        ];
    }
}
