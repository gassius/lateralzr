<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptRelationship;
use App\Models\RelationshipEvidence;
use App\Support\Laterality;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class ConceptGraphStore
{
    public function __construct(
        protected ConceptCanonicalizer $canonicalizer
    ) {}

    /**
     * Persist an interwoven concept graph.
     *
     * @param  array<int, array{concept:string,shortDescription:string,complexity?:int,wikiUrl:?string,mediaUrl:?string}>  $concepts
     * @param  array<int, array{from:string,to:string,laterality:float}>  $edges
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

                $laterality = Laterality::normalize($e['laterality'] ?? null)
                    ?? Laterality::NULL_DEFAULT;

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

    public function upsertEdge(
        Concept $from,
        Concept $to,
        float $laterality,
    ): ConceptRelationship {
        $now = CarbonImmutable::now();
        $laterality = Laterality::normalize($laterality) ?? Laterality::NULL_DEFAULT;

        try {
            return ConceptRelationship::query()->create([
                'from_concept_id' => $from->id,
                'to_concept_id' => $to->id,
                'last_laterality' => $laterality,
                'llm_occurrences' => 1,
                'last_generated_at' => $now,
                'user_weight' => 0,
                'strength' => $this->calculateStrength(
                    laterality: $laterality,
                    llmOccurrences: 1,
                    userWeight: 0
                ),
            ]);
        } catch (UniqueConstraintViolationException $e) {
            // REPEATABLE READ: a plain SELECT still sees the transaction snapshot
            // and misses a sibling commit. FOR UPDATE is a current/locking read.
            $edge = ConceptRelationship::query()
                ->where('from_concept_id', $from->id)
                ->where('to_concept_id', $to->id)
                ->lockForUpdate()
                ->first();

            if (! $edge instanceof ConceptRelationship) {
                throw $e;
            }

            $edge->last_laterality = $laterality;
            $edge->llm_occurrences = (int) ($edge->llm_occurrences ?? 0) + 1;
            $edge->last_generated_at = $now;
            $edge->strength = $this->calculateStrength(
                laterality: (float) ($edge->last_laterality ?? Laterality::NULL_DEFAULT),
                llmOccurrences: (int) $edge->llm_occurrences,
                userWeight: (int) ($edge->user_weight ?? 0)
            );
            $edge->save();

            return $edge;
        }
    }

    /**
     * Strength in [0,1], based on:
     * - Laterality: weak prior on the 0–1 scale (legacy grades 1–5 mapped to 0, 0.25, 0.5, 0.75, 1).
     * - Occurrences: repeated LLM suggestions increase confidence with diminishing returns.
     * - User weight: signed admin/Filament adjustment (can be positive or negative).
     */
    protected function calculateStrength(float $laterality, int $llmOccurrences, int $userWeight): float
    {
        $latFactor = $this->lateralityFactor($laterality);

        // Diminishing returns curve: 1 - e^{-k*n}
        $occFactor = 1 - exp(-0.33 * max(0, $llmOccurrences));

        // Clamp user contribution to [-1,1], scale modestly.
        $userFactor = max(-1.0, min(1.0, $userWeight / 100.0));

        $strength = ($latFactor * $occFactor) + (0.15 * $userFactor);

        return (float) max(0.0, min(1.0, $strength));
    }

    /**
     * Piecewise-linear prior through the legacy grade anchors.
     */
    protected function lateralityFactor(float $laterality): float
    {
        $laterality = Laterality::clamp($laterality);
        $points = [
            0.00 => 0.75,
            0.25 => 0.90,
            0.50 => 1.00,
            0.75 => 1.05,
            1.00 => 1.05,
        ];
        $keys = array_keys($points);

        if ($laterality <= $keys[0]) {
            return $points[$keys[0]];
        }

        $lastIndex = count($keys) - 1;
        for ($i = 0; $i < $lastIndex; $i++) {
            $left = $keys[$i];
            $right = $keys[$i + 1];
            if ($laterality <= $right) {
                $span = $right - $left;
                $t = $span > 0 ? ($laterality - $left) / $span : 0.0;

                return $points[$left] + ($t * ($points[$right] - $points[$left]));
            }
        }

        return $points[$keys[$lastIndex]];
    }
}
