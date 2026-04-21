<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptRelationship;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class ConceptGraphStore
{
    /**
     * Persist seed + related concepts and their edges (seed -> related).
     *
     * @param  array{concept:string,shortDescription:string,wikiUrl:?string,mediaUrl:?string}  $seed
     * @param  array<int, array{concept:string,shortDescription:string,larelality:int,wikiUrl:?string,mediaUrl:?string}>  $related
     */
    public function storeSeedAndRelated(
        array $seed,
        array $related,
        int $complexity,
        ?string $provider,
        ?string $model,
        ?string $runUuid
    ): void {
        DB::transaction(function () use ($seed, $related, $complexity, $provider, $model, $runUuid) {
            $seedConcept = $this->upsertConcept($seed, $complexity);

            foreach ($related as $item) {
                $toConcept = $this->upsertConcept($item, $complexity);

                $this->upsertEdge(
                    from: $seedConcept,
                    to: $toConcept,
                    complexity: $complexity,
                    larelality: (int) ($item['larelality'] ?? 1),
                    provider: $provider,
                    model: $model,
                    runUuid: $runUuid
                );
            }
        });
    }

    /**
     * @param  array{concept:string,shortDescription?:string,wikiUrl?:?string,mediaUrl?:?string}  $item
     */
    protected function upsertConcept(array $item, int $complexity): Concept
    {
        $normalized = Concept::normalizeConcept((string) ($item['concept'] ?? ''));

        return Concept::query()->updateOrCreate(
            ['concept' => $normalized],
            [
                'complexity' => $complexity,
                'short_description' => isset($item['shortDescription']) ? (string) $item['shortDescription'] : null,
                'wiki_url' => $item['wikiUrl'] ?? null,
                'media_url' => $item['mediaUrl'] ?? null,
            ]
        );
    }

    protected function upsertEdge(
        Concept $from,
        Concept $to,
        int $complexity,
        int $larelality,
        ?string $provider,
        ?string $model,
        ?string $runUuid
    ): ConceptRelationship {
        $now = CarbonImmutable::now();

        $edge = ConceptRelationship::query()->firstOrNew([
            'from_concept_id' => $from->id,
            'to_concept_id' => $to->id,
            'complexity' => $complexity,
        ]);

        $edge->larelality = max(1, min(5, $larelality));
        $edge->llm_occurrences = (int) ($edge->llm_occurrences ?? 0) + 1;
        $edge->provider = $provider;
        $edge->model = $model;
        $edge->last_run_uuid = $runUuid;
        $edge->last_generated_at = $now;

        $edge->strength = $this->calculateStrength(
            larelality: (int) $edge->larelality,
            llmOccurrences: (int) $edge->llm_occurrences,
            userWeight: (int) ($edge->user_weight ?? 0)
        );

        $edge->save();

        return $edge;
    }

    /**
     * Strength in [0,1], based on:
     * - Laterality: nearer edges are intrinsically stronger.
     * - Occurrences: repeated LLM suggestions increase confidence with diminishing returns.
     * - User weight: reserved for future client feedback (can be positive/negative).
     */
    protected function calculateStrength(int $larelality, int $llmOccurrences, int $userWeight): float
    {
        $larelality = max(1, min(5, $larelality));
        $base = (6 - $larelality) / 5; // 1=>1.0, 5=>0.2

        // Diminishing returns curve: 1 - e^{-k*n}
        $occFactor = 1 - exp(-0.33 * max(0, $llmOccurrences));

        // Clamp user contribution to [-1,1], scale modestly.
        $userFactor = max(-1.0, min(1.0, $userWeight / 100.0));

        $strength = ($base * $occFactor) + (0.15 * $userFactor);

        return (float) max(0.0, min(1.0, $strength));
    }
}

