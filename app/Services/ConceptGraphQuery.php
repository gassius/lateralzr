<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptRelationship;
use Illuminate\Support\Arr;

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
            ->with('toConcept')
            ->where('from_concept_id', $seed->id)
            ->where('complexity', $complexity)
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
                'concept' => $seed->concept,
                'shortDescription' => (string) ($seed->short_description ?? ''),
                'wikiUrl' => $seed->wiki_url,
                'mediaUrl' => $seed->media_url,
            ],
            'related_concepts' => $edges->map(function (ConceptRelationship $edge) {
                $to = $edge->toConcept;

                return [
                    'concept' => $to?->concept ?? '',
                    'shortDescription' => (string) ($to?->short_description ?? ''),
                    'larelality' => (int) ($edge->larelality ?? 1),
                    'wikiUrl' => $to?->wiki_url,
                    'mediaUrl' => $to?->media_url,
                ];
            })->values()->all(),
        ];
    }

    protected function resolveSeed(?string $seedConcept, int $complexity): ?Concept
    {
        if ($seedConcept !== null && trim($seedConcept) !== '') {
            $normalized = Concept::normalizeConcept($seedConcept);

            // If the client requests a seed explicitly, only serve it if it exists in DB.
            // Do not silently swap to a random seed.
            return Concept::query()->where('concept', $normalized)->first();
        }

        // Prefer concepts that actually have outgoing edges at this complexity.
        $seedId = ConceptRelationship::query()
            ->where('complexity', $complexity)
            ->inRandomOrder()
            ->value('from_concept_id');

        if ($seedId) {
            return Concept::query()->find($seedId);
        }

        // No prefetched graph yet.
        return null;
    }
}

