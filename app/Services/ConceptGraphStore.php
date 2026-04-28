<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptRelationship;
use App\Models\RelationshipEvidence;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class ConceptGraphStore
{
    public function __construct(
        protected ConceptCanonicalizer $canonicalizer
    ) {}

    /**
     * Legacy persistence path used by existing jobs until graph-generation refactor lands.
     * Stores a simple directed set of edges from seed -> related.
     *
     * @param  array{concept:string,shortDescription:string,wikiUrl:?string,mediaUrl:?string}  $seed
     * @param  array<int, array{concept:string,shortDescription:string,larelality:int,wikiUrl:?string,mediaUrl:?string}>  $related
     */
    public function storeSeedAndRelated(
        array $seed,
        array $related,
        ?string $provider,
        ?string $model,
        ?string $runUuid
    ): void {
        DB::transaction(function () use ($seed, $related, $provider, $model, $runUuid) {
            $locale = $this->canonicalizer->defaultLocale();
            $seedConcept = $this->canonicalizer->resolveOrCreate(
                term: (string) ($seed['concept'] ?? ''),
                locale: $locale,
                shortDescription: $seed['shortDescription'] ?? null,
                wikiUrl: $seed['wikiUrl'] ?? null,
                mediaUrl: $seed['mediaUrl'] ?? null
            );

            foreach ($related as $item) {
                $toConcept = $this->canonicalizer->resolveOrCreate(
                    term: (string) ($item['concept'] ?? ''),
                    locale: $locale,
                    shortDescription: $item['shortDescription'] ?? null,
                    wikiUrl: $item['wikiUrl'] ?? null,
                    mediaUrl: $item['mediaUrl'] ?? null
                );

                $edge = $this->upsertEdge(
                    from: $seedConcept,
                    to: $toConcept,
                    laterality: (int) ($item['larelality'] ?? 1),
                );

                RelationshipEvidence::query()->create([
                    'concept_relationship_id' => $edge->id,
                    'provider' => $provider,
                    'model' => $model,
                    'run_uuid' => $runUuid,
                    'laterality' => (int) ($item['larelality'] ?? 1),
                    'from_term' => (string) ($seed['concept'] ?? ''),
                    'to_term' => (string) ($item['concept'] ?? ''),
                    'raw_json' => $item,
                    'created_at' => CarbonImmutable::now(),
                ]);
            }
        });
    }

    /**
     * Persist an interwoven concept graph.
     *
     * @param  array<int, array{concept:string,shortDescription:string,complexity?:int,wikiUrl:?string,mediaUrl:?string}>  $concepts
     * @param  array<int, array{from:string,to:string,laterality:int}>  $edges
     */
    public function storeGraph(
        array $concepts,
        array $edges,
        int $complexity,
        ?string $provider,
        ?string $model,
        ?string $runUuid
    ): void {
        $complexity = max(1, min(5, $complexity));

        DB::transaction(function () use ($concepts, $edges, $complexity, $provider, $model, $runUuid) {
            $locale = $this->canonicalizer->defaultLocale();

            /** @var array<string, Concept> $resolved */
            $resolved = [];

            foreach ($concepts as $c) {
                $label = trim((string) ($c['concept'] ?? ''));
                if ($label === '') {
                    continue;
                }

                $concept = $this->canonicalizer->resolveOrCreate(
                    term: $label,
                    locale: $locale,
                    shortDescription: $c['shortDescription'] ?? null,
                    wikiUrl: $c['wikiUrl'] ?? null,
                    mediaUrl: $c['mediaUrl'] ?? null,
                    complexity: (int) ($c['complexity'] ?? $complexity)
                );

                $resolved[\App\Models\ConceptTerm::normalizeTerm($label)] = $concept;
            }

            foreach ($edges as $e) {
                $fromLabel = trim((string) ($e['from'] ?? ''));
                $toLabel = trim((string) ($e['to'] ?? ''));
                if ($fromLabel === '' || $toLabel === '') {
                    continue;
                }

                $fromKey = \App\Models\ConceptTerm::normalizeTerm($fromLabel);
                $toKey = \App\Models\ConceptTerm::normalizeTerm($toLabel);
                if ($fromKey === $toKey) {
                    continue;
                }

                $from = $resolved[$fromKey] ?? null;
                $to = $resolved[$toKey] ?? null;
                if (! $from || ! $to) {
                    continue;
                }

                $laterality = max(1, min(5, (int) ($e['laterality'] ?? 3)));

                $edge = $this->upsertEdge(
                    from: $from,
                    to: $to,
                    laterality: $laterality,
                );

                RelationshipEvidence::query()->create([
                    'concept_relationship_id' => $edge->id,
                    'provider' => $provider,
                    'model' => $model,
                    'run_uuid' => $runUuid,
                    'laterality' => $laterality,
                    'from_term' => $fromLabel,
                    'to_term' => $toLabel,
                    'raw_json' => $e,
                    'created_at' => CarbonImmutable::now(),
                ]);
            }
        });
    }

    protected function upsertEdge(
        Concept $from,
        Concept $to,
        int $laterality,
    ): ConceptRelationship {
        $now = CarbonImmutable::now();

        $edge = ConceptRelationship::query()->firstOrNew([
            'from_concept_id' => $from->id,
            'to_concept_id' => $to->id,
        ]);

        $edge->last_laterality = max(1, min(5, $laterality));
        $edge->llm_occurrences = (int) ($edge->llm_occurrences ?? 0) + 1;
        $edge->last_generated_at = $now;

        $edge->strength = $this->calculateStrength(
            laterality: (int) ($edge->last_laterality ?? 3),
            llmOccurrences: (int) $edge->llm_occurrences,
            userWeight: (int) ($edge->user_weight ?? 0)
        );

        $edge->save();

        return $edge;
    }

    /**
     * Strength in [0,1], based on:
     * - Laterality: used as a weak prior, not a hard penalty (laterality 3–5 is valuable).
     * - Occurrences: repeated LLM suggestions increase confidence with diminishing returns.
     * - User weight: reserved for future client feedback (can be positive/negative).
     */
    protected function calculateStrength(int $laterality, int $llmOccurrences, int $userWeight): float
    {
        $laterality = max(1, min(5, $laterality));

        // Laterality prior: keep 1 slightly lower, but don't punish high laterality.
        $latFactor = match ($laterality) {
            1 => 0.75,
            2 => 0.90,
            3 => 1.00,
            4 => 1.05,
            5 => 1.05,
        };

        // Diminishing returns curve: 1 - e^{-k*n}
        $occFactor = 1 - exp(-0.33 * max(0, $llmOccurrences));

        // Clamp user contribution to [-1,1], scale modestly.
        $userFactor = max(-1.0, min(1.0, $userWeight / 100.0));

        $strength = ($latFactor * $occFactor) + (0.15 * $userFactor);

        return (float) max(0.0, min(1.0, $strength));
    }
}
