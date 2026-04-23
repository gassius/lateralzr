<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptRelationship;

class ConceptGraphQuery
{
    /**
     * Fetch relationships from DB in the same shape as ConceptRelationshipService::generateRelationships().
     *
     * @return array{complexity:int,seed:array{concept:string,shortDescription:string,wikiUrl:?string,mediaUrl:?string},related_concepts:array<int,array{concept:string,shortDescription:string,larelality:int,wikiUrl:?string,mediaUrl:?string}>}|null
     */
    public function getFromDb(?string $seedConcept, ?int $count, int $complexity): ?array
    {
        $complexity = max(1, min(5, $complexity));
        $limit = $count ? max(1, min(10, (int) $count)) : 5;

        $seed = $this->resolveSeed($seedConcept, $complexity);
        if ($seed === null) {
            return null;
        }

        $edges = ConceptRelationship::query()
            ->with(['toConcept.preferredTerm', 'fromConcept.preferredTerm'])
            ->where('from_concept_id', $seed->id)
            ->where('complexity', $complexity)
            ->where('relationship_type', 'lateral')
            ->orderByDesc('strength')
            ->orderByDesc('llm_occurrences')
            ->limit($limit)
            ->get();

        if ($edges->isEmpty()) {
            return null;
        }

        return [
            'complexity' => $complexity,
            'seed' => [
                'concept' => (string) ($seed->display_term ?? ''),
                'shortDescription' => (string) ($seed->display_short_description ?? ''),
                'wikiUrl' => $seed->display_wiki_url,
                'mediaUrl' => $seed->display_media_url,
            ],
            'related_concepts' => $edges->map(function (ConceptRelationship $edge) {
                $to = $edge->toConcept;

                return [
                    'concept' => (string) ($to?->display_term ?? ''),
                    'shortDescription' => (string) ($to?->display_short_description ?? ''),
                    'larelality' => (int) ($edge->last_larelality ?? 1),
                    'wikiUrl' => $to?->display_wiki_url,
                    'mediaUrl' => $to?->display_media_url,
                ];
            })->values()->all(),
        ];
    }

    protected function resolveSeed(?string $seedConcept, int $complexity): ?Concept
    {
        if ($seedConcept !== null && trim($seedConcept) !== '') {
            $normalized = \App\Models\ConceptTerm::normalizeTerm($seedConcept);

            // Resolve via term in default locale; do not silently swap to a random seed.
            $locale = (string) config('concepts.default_locale', 'en');

            return Concept::query()
                ->whereHas('terms', function ($q) use ($locale, $normalized) {
                    $q->where('locale', $locale)->where('normalized_term', $normalized);
                })
                ->first();
        }

        // Prefer concepts that actually have outgoing edges at this complexity.
        $seedId = ConceptRelationship::query()
            ->where('complexity', $complexity)
            ->where('relationship_type', 'lateral')
            ->inRandomOrder()
            ->value('from_concept_id');

        if ($seedId) {
            return Concept::query()->with('preferredTerm')->find($seedId);
        }

        // No prefetched graph yet.
        return null;
    }
}

