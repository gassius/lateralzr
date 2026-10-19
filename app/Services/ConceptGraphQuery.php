<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptMedia;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Support\ConceptLocale;
use App\Support\Laterality;
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
        ?float $laterality = null,
        bool $lateralityAsGrade = false
    ): ?array {
        $limit = max(1, min(500, $limit));
        $depth = max(1, min(5, $depth));
        $minStrength = max(0.0, min(1.0, $minStrength));
        $locale = ConceptLocale::resolve($locale);
        $complexity = $this->normalizeComplexity($complexity);
        $laterality = $laterality === null ? null : Laterality::normalize($laterality);

        $start = $this->resolveStart($startConcept, $locale, $canonicalStart, $onlyWithMedia, $complexity, $laterality, $lateralityAsGrade);
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

            $edges = $this->orderNeighborhoodEdges($edgesQuery, $laterality, $lateralityAsGrade)
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

        $concepts = Concept::query()
            ->with(['terms', 'media'])
            ->whereIn('id', array_keys($nodeIds))
            ->get();

        $degrees = $this->relationshipDegrees($concepts->pluck('id')->all());

        $nodes = $concepts
            ->map(fn (Concept $concept) => $this->formatNode(
                $concept,
                $locale,
                $onlyWithMedia,
                $complexity,
                $degrees[(int) $concept->id] ?? 0
            ))
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
                ...($laterality !== null ? Laterality::publicFields($laterality) : []),
            ],
        ];
    }

    protected function resolveStart(
        ?string $startConcept,
        string $locale,
        ?string $canonicalStart = null,
        bool $onlyWithMedia = false,
        ?int $complexity = null,
        ?float $laterality = null,
        bool $lateralityAsGrade = false
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
        $startId = $this->randomStartId($locale, $onlyWithMedia, $complexity, $laterality, $lateralityAsGrade);
        if ($startId === null && $complexity !== null) {
            $startId = $this->randomStartId($locale, $onlyWithMedia, null, $laterality, $lateralityAsGrade);
        }

        if ($startId) {
            return Concept::query()->with('terms')->find($startId);
        }

        // No prefetched graph yet for this locale.
        return null;
    }

    protected function randomStartId(string $locale, bool $onlyWithMedia, ?int $complexity, ?float $laterality = null, bool $lateralityAsGrade = false): ?int
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

        if ($laterality !== null) {
            $this->constrainLaterality($startQuery, $laterality, $lateralityAsGrade);
        }

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
     * When a laterality value is passed, keep only matching edges.
     * Legacy grades use the nearest-grade interval; laterality_score uses ±0.005.
     * NULL `last_laterality` is 0.5 (legacy grade 3).
     * Omitted laterality keeps the existing strength-first walk (backward compatible).
     *
     * @param  Builder<ConceptRelationship>  $query
     * @return Builder<ConceptRelationship>
     */
    protected function orderNeighborhoodEdges(Builder $query, ?float $laterality, bool $lateralityAsGrade = false): Builder
    {
        if ($laterality !== null) {
            $this->constrainLaterality($query, $laterality, $lateralityAsGrade);
        }

        return $query
            ->orderByDesc('strength')
            ->orderByDesc('llm_occurrences');
    }

    /**
     * Match stored last_laterality. Exact laterality_score uses ±0.005;
     * a legacy 1–5 grade uses that grade's half-open nearest-grade interval.
     * NULL last_laterality is 0.5 / grade 3.
     *
     * @param  Builder<ConceptRelationship>  $query
     */
    protected function constrainLaterality(Builder $query, float $laterality, bool $asGrade = false): void
    {
        if ($asGrade) {
            $grade = Laterality::toLegacyInteger($laterality);
            $interval = $grade === null ? null : Laterality::gradeInterval($grade);
            if ($interval === null) {
                $query->whereRaw('0 = 1');

                return;
            }

            $query->where(function (Builder $inner) use ($interval, $grade) {
                $inner->where(function (Builder $range) use ($interval) {
                    $range->where('last_laterality', $interval['minInclusive'] ? '>=' : '>', $interval['min']);
                    $range->where('last_laterality', $interval['maxInclusive'] ? '<=' : '<', $interval['max']);
                });
                if ($grade === Laterality::toLegacyInteger(Laterality::NULL_DEFAULT)) {
                    $inner->orWhereNull('last_laterality');
                }
            });

            return;
        }

        $score = Laterality::clamp($laterality);

        $query->where(function (Builder $inner) use ($score) {
            $inner->whereBetween('last_laterality', [
                $score - Laterality::SCORE_MATCH_TOLERANCE,
                $score + Laterality::SCORE_MATCH_TOLERANCE,
            ]);
            if (abs($score - Laterality::NULL_DEFAULT) < Laterality::SCORE_MATCH_TOLERANCE) {
                $inner->orWhereNull('last_laterality');
            }
        });
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
                    abs((int) ($term->complexity ?? config('concepts.default_complexity', 3)) - $complexity),
                    $term->is_preferred ? 0 : 1,
                ];
            })
            ->first();
    }

    /**
     * Global incident-edge counts (from + to), matching
     * `where from = id or to = id` per node. Self-loops count once.
     *
     * @param  list<int|string>  $conceptIds
     * @return array<int, int>
     */
    protected function relationshipDegrees(array $conceptIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $conceptIds)));
        if ($ids === []) {
            return [];
        }

        $degrees = array_fill_keys($ids, 0);

        $fromCounts = ConceptRelationship::query()
            ->whereIn('from_concept_id', $ids)
            ->selectRaw('from_concept_id as concept_id, COUNT(*) as aggregate')
            ->groupBy('from_concept_id')
            ->pluck('aggregate', 'concept_id');

        $toCounts = ConceptRelationship::query()
            ->whereIn('to_concept_id', $ids)
            ->whereColumn('from_concept_id', '!=', 'to_concept_id')
            ->selectRaw('to_concept_id as concept_id, COUNT(*) as aggregate')
            ->groupBy('to_concept_id')
            ->pluck('aggregate', 'concept_id');

        foreach ($fromCounts as $id => $count) {
            $degrees[(int) $id] = ($degrees[(int) $id] ?? 0) + (int) $count;
        }
        foreach ($toCounts as $id => $count) {
            $degrees[(int) $id] = ($degrees[(int) $id] ?? 0) + (int) $count;
        }

        return $degrees;
    }

    protected function formatNode(Concept $concept, string $locale, bool $onlyWithMedia = false, ?int $complexity = null, int $degree = 0): ?array
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
            'complexity' => (int) ($term->complexity ?? config('concepts.default_complexity', 3)),
            'wikiUrl' => $term->wiki_url,
            'mediaUrl' => $term->media_url,
            'media' => $this->formatMedia($concept),
            'locale' => $locale,
            'degree' => $degree,
        ];
    }

    /**
     * @return list<array{
     *     url:string,
     *     kind:string,
     *     license:string,
     *     purpose:?string,
     *     alt:?string,
     *     creator:?string,
     *     source:?string,
     *     sourcePageUrl:?string,
     *     licenceName:?string,
     *     licenceUrl:?string,
     *     changeNotice:?string,
     *     focalX:?float,
     *     focalY:?float,
     *     tone:?string
     * }>
     */
    protected function formatMedia(Concept $concept): array
    {
        $media = $concept->relationLoaded('media')
            ? $concept->media
            : $concept->media()->get();

        return $media->map(fn (ConceptMedia $item) => [
            'url' => (string) $item->url,
            'kind' => (string) $item->kind,
            'license' => (string) $item->license,
            'purpose' => $item->purpose,
            'alt' => $item->alt,
            'creator' => $item->creator,
            'source' => $item->source,
            'sourcePageUrl' => $item->source_page_url,
            'licenceName' => $item->licence_name ?: $item->license,
            'licenceUrl' => $item->licence_url,
            'changeNotice' => $item->change_notice,
            'focalX' => $item->focal_x,
            'focalY' => $item->focal_y,
            'tone' => $item->tone,
        ])->values()->all();
    }

    protected function formatEdge(ConceptRelationship $edge): array
    {
        $score = Laterality::clamp((float) ($edge->last_laterality ?? Laterality::NULL_DEFAULT));

        return [
            'id' => (int) $edge->id,
            'from' => (int) $edge->from_concept_id,
            'to' => (int) $edge->to_concept_id,
            'strength' => (float) $edge->strength,
            ...Laterality::publicFields($score),
        ];
    }
}
