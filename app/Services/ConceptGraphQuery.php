<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Support\ConceptLocale;

class ConceptGraphQuery
{
    /**
     * Fetch a graph-shaped neighborhood from the prefetched DB graph.
     *
     * @return array{start:array{id:int,label:string},nodes:array<int,array<string,mixed>>,edges:array<int,array<string,mixed>>,meta:array<string,mixed>}|null
     */
    public function getGraph(
        ?string $startConcept,
        int $limit = 100,
        int $depth = 2,
        float $minStrength = 0.0,
        ?string $locale = null
    ): ?array {
        $limit = max(1, min(500, $limit));
        $depth = max(1, min(5, $depth));
        $minStrength = max(0.0, min(1.0, $minStrength));
        $locale = ConceptLocale::resolve($locale);

        $start = $this->resolveStart($startConcept, $locale);
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
                ->with(['fromConcept.terms', 'toConcept.terms'])
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

        $startTerm = $start->termForLocale($locale, fallback: false);
        if ($startTerm === null) {
            // Never surface a start concept that lacks a term in the requested locale.
            return null;
        }

        $nodes = Concept::query()
            ->with('terms')
            ->whereIn('id', array_keys($nodeIds))
            ->get()
            ->map(fn (Concept $concept) => $this->formatNode($concept, $locale))
            ->filter()
            ->values()
            ->all();

        $keptIds = array_fill_keys(
            array_map(static fn (array $node): int => (int) $node['id'], $nodes),
            true
        );

        // Drop edges that touch concepts omitted for lacking a locale-local term.
        $edges = collect($edgeMap)
            ->filter(function (ConceptRelationship $edge) use ($keptIds) {
                return isset($keptIds[$edge->from_concept_id], $keptIds[$edge->to_concept_id]);
            })
            ->map(fn (ConceptRelationship $edge) => $this->formatEdge($edge))
            ->values()
            ->all();

        if ($edges === []) {
            return null;
        }

        return [
            'start' => [
                'id' => (int) $start->id,
                'label' => (string) $startTerm->term,
            ],
            'nodes' => $nodes,
            'edges' => $edges,
            'meta' => [
                'depth' => $depth,
                'limit' => $limit,
                'minStrength' => $minStrength,
                'hasMore' => $hasMore,
                'locale' => $locale,
            ],
        ];
    }

    protected function resolveStart(?string $startConcept, string $locale): ?Concept
    {
        if ($startConcept !== null && trim($startConcept) !== '') {
            $normalized = ConceptTerm::normalizeTerm($startConcept);

            // Prefer an exact match in the requested locale.
            $concept = Concept::query()
                ->with('terms')
                ->whereHas('terms', function ($q) use ($locale, $normalized) {
                    $q->where('locale', $locale)->where('normalized_term', $normalized);
                })
                ->first();

            if ($concept !== null) {
                return $concept;
            }

            // Fall back to any-locale seed match, but only if that concept also has a
            // term in the requested locale (never start a cross-locale display graph).
            $concept = Concept::query()
                ->with('terms')
                ->whereHas('terms', function ($q) use ($normalized) {
                    $q->where('normalized_term', $normalized);
                })
                ->first();

            if ($concept !== null && $concept->termForLocale($locale, fallback: false) !== null) {
                return $concept;
            }

            return null;
        }

        // Prefer concepts that have edges and a term in the requested locale.
        $startId = ConceptRelationship::query()
            ->whereHas('fromConcept.terms', function ($q) use ($locale) {
                $q->where('locale', $locale);
            })
            ->inRandomOrder()
            ->value('from_concept_id');

        if ($startId) {
            return Concept::query()->with('terms')->find($startId);
        }

        // No prefetched graph yet for this locale.
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

    /**
     * @return array<string, mixed>|null Null when the concept has no term in `$locale`
     *                                   (never fall back to another locale for display).
     */
    protected function formatNode(Concept $concept, string $locale): ?array
    {
        $term = $concept->termForLocale($locale, fallback: false);
        if ($term === null) {
            return null;
        }

        return [
            'id' => (int) $concept->id,
            'label' => (string) $term->term,
            'shortDescription' => (string) ($term->short_description ?? ''),
            'complexity' => (int) ($term->complexity ?? config('concepts.default_complexity', 2)),
            'wikiUrl' => $term->wiki_url,
            'mediaUrl' => $term->media_url,
            'locale' => $locale,
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
