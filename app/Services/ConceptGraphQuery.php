<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Support\ConceptLocale;
use Illuminate\Database\Eloquent\Builder;

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
        ?string $locale = null,
        ?string $canonicalStart = null,
        bool $onlyWithMedia = false,
        ?int $complexity = null,
        ?int $laterality = null
    ): ?array {
        $limit = max(1, min(500, $limit));
        $depth = max(1, min(5, $depth));
        $minStrength = max(0.0, min(1.0, $minStrength));
        $locale = ConceptLocale::resolve($locale);
        $complexity = $this->normalizeComplexity($complexity);
        $laterality = $laterality === null ? null : max(1, min(5, $laterality));

        $start = $this->resolveStart($startConcept, $locale, $canonicalStart, $onlyWithMedia, $complexity);
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
            $edgesQuery = ConceptRelationship::query()
                ->with(['fromConcept.terms', 'toConcept.terms'])
                ->where('strength', '>=', $minStrength)
                ->where(function ($q) use ($frontier) {
                    $q->whereIn('from_concept_id', $frontier)
                        ->orWhereIn('to_concept_id', $frontier);
                });

            if ($onlyWithMedia) {
                $this->constrainRelationshipToMedia($edgesQuery, $locale);
            }

            $edges = $this->orderNeighborhoodEdges($edgesQuery, $laterality)
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

        $startTerm = $this->selectTerm($start, $locale, $complexity);
        if ($startTerm === null) {
            // Never surface a start concept that lacks a term in the requested locale.
            return null;
        }

        $nodes = Concept::query()
            ->with('terms')
            ->whereIn('id', array_keys($nodeIds))
            ->get()
            ->map(fn (Concept $concept) => $this->formatNode($concept, $locale, $onlyWithMedia, $complexity))
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
                ...($complexity !== null ? ['complexity' => $complexity] : []),
                ...($laterality !== null ? ['laterality' => $laterality] : []),
            ],
        ];
    }

    protected function resolveStart(
        ?string $startConcept,
        string $locale,
        ?string $canonicalStart = null,
        bool $onlyWithMedia = false,
        ?int $complexity = null
    ): ?Concept {
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
                return $this->acceptResolvedStart($concept, $locale, $onlyWithMedia);
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
                return $this->acceptResolvedStart($concept, $locale, $onlyWithMedia);
            }

            return null;
        }

        if ($canonicalStart !== null && trim($canonicalStart) !== '') {
            $normalized = ConceptTerm::normalizeTerm($canonicalStart);
            $concept = Concept::query()
                ->with('terms')
                ->where('canonical_key', $normalized)
                ->first();

            if ($concept !== null && $concept->termForLocale($locale, fallback: false) !== null) {
                return $this->acceptResolvedStart($concept, $locale, $onlyWithMedia);
            }

            return null;
        }

        // Prefer concepts that have edges and a term in the requested locale.
        $startId = $this->randomStartId($locale, $onlyWithMedia, $complexity);
        if ($startId === null && $complexity !== null) {
            $startId = $this->randomStartId($locale, $onlyWithMedia, null);
        }

        if ($startId) {
            return Concept::query()->with('terms')->find($startId);
        }

        // No prefetched graph yet for this locale.
        return null;
    }

    protected function randomStartId(string $locale, bool $onlyWithMedia, ?int $complexity): ?int
    {
        $startQuery = ConceptRelationship::query()
            ->whereHas('fromConcept.terms', function ($q) use ($locale, $onlyWithMedia, $complexity) {
                $q->where('locale', $locale);
                if ($complexity !== null) {
                    $q->where('complexity', $complexity);
                }
                if ($onlyWithMedia) {
                    $this->constrainMediaUrl($q);
                }
            });

        if ($onlyWithMedia) {
            $startQuery->whereHas('toConcept.terms', function ($q) use ($locale, $complexity) {
                $q->where('locale', $locale);
                if ($complexity !== null) {
                    $q->where('complexity', $complexity);
                }
                $this->constrainMediaUrl($q);
            });
        }

        $startId = $startQuery
            ->inRandomOrder()
            ->value('from_concept_id');

        return $startId !== null ? (int) $startId : null;
    }

    protected function acceptResolvedStart(Concept $concept, string $locale, bool $onlyWithMedia): ?Concept
    {
        if ($onlyWithMedia && ! $this->conceptHasMedia($concept, $locale)) {
            return null;
        }

        return $concept;
    }

    /**
     * Prefer edges whose laterality is closer to the requested grade.
     * Omitted laterality keeps the existing strength-first walk (backward compatible).
     *
     * @param  Builder<ConceptRelationship>  $query
     * @return Builder<ConceptRelationship>
     */
    protected function orderNeighborhoodEdges(Builder $query, ?int $laterality): Builder
    {
        if ($laterality !== null) {
            $query->orderByRaw('ABS(COALESCE(last_laterality, 3) - ?) ASC', [$laterality]);
        }

        return $query
            ->orderByDesc('strength')
            ->orderByDesc('llm_occurrences');
    }

    /**
     * @param  Builder<ConceptRelationship>  $query
     */
    protected function constrainRelationshipToMedia(Builder $query, string $locale): void
    {
        $query
            ->whereHas('fromConcept.terms', function ($q) use ($locale) {
                $q->where('locale', $locale);
                $this->constrainMediaUrl($q);
            })
            ->whereHas('toConcept.terms', function ($q) use ($locale) {
                $q->where('locale', $locale);
                $this->constrainMediaUrl($q);
            });
    }

    /**
     * @param  Builder<ConceptTerm>  $query
     */
    protected function constrainMediaUrl(Builder $query): void
    {
        $query->whereNotNull('media_url')->where('media_url', '!=', '');
    }

    protected function conceptHasMedia(Concept $concept, string $locale): bool
    {
        return $this->termHasMedia($concept->termForLocale($locale, fallback: false));
    }

    protected function termHasMedia(?ConceptTerm $term): bool
    {
        if ($term === null) {
            return false;
        }

        return is_string($term->media_url) && trim($term->media_url) !== '';
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
    protected function normalizeComplexity(?int $complexity): ?int
    {
        if ($complexity === null) {
            return null;
        }

        return max(1, min(5, $complexity));
    }

    protected function selectTerm(Concept $concept, string $locale, ?int $complexity): ?ConceptTerm
    {
        if ($complexity === null) {
            return $concept->termForLocale($locale, fallback: false);
        }

        $terms = $concept->relationLoaded('terms')
            ? $concept->terms
            : $concept->terms()->get();

        $localized = $terms
            ->where('locale', $locale)
            ->values();

        if ($localized->isEmpty()) {
            return null;
        }

        $exact = $localized->first(
            static fn (ConceptTerm $term): bool => (int) $term->complexity === $complexity
        );
        if ($exact !== null) {
            return $exact;
        }

        return $localized
            ->sortBy(function (ConceptTerm $term) use ($complexity) {
                return [
                    abs((int) ($term->complexity ?? 2) - $complexity),
                    $term->is_preferred ? 0 : 1,
                ];
            })
            ->first();
    }

    protected function formatNode(Concept $concept, string $locale, bool $onlyWithMedia = false, ?int $complexity = null): ?array
    {
        $term = $this->selectTerm($concept, $locale, $complexity);
        if ($term === null) {
            return null;
        }
        if ($onlyWithMedia && ! $this->termHasMedia($term)) {
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
