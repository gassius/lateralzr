<?php

namespace App\Services;

use App\Models\ConceptTerm;
use App\Support\Laterality;

/**
 * Filter an LLM graph against requested count, complexity, and laterality band.
 *
 * Complexity match is the requested value ± COMPLEXITY_TOLERANCE (documented).
 * Edges outside the laterality band are dropped. Concepts with no remaining
 * edges are dropped except the start concept.
 */
final class GeneratedGraphConstraints
{
    public const COMPLEXITY_TOLERANCE = 1;

    /**
     * @param  array{start_concept: string, concepts: array<int, array<string, mixed>>, edges: array<int, array<string, mixed>>}  $graph
     * @return array{
     *     start_concept: string,
     *     concepts: array<int, array<string, mixed>>,
     *     edges: array<int, array{from: string, to: string, laterality: float}>,
     *     rejected_laterality: int,
     *     rejected_complexity: int,
     *     rejected_orphan: int
     * }
     */
    public static function apply(
        array $graph,
        int $targetComplexity,
        float $bandMin,
        float $bandMax,
    ): array {
        $start = (string) ($graph['start_concept'] ?? '');
        $startKey = ConceptTerm::normalizeTerm($start);

        $keptConcepts = [];
        $rejectedComplexity = 0;

        foreach ($graph['concepts'] ?? [] as $concept) {
            if (! is_array($concept)) {
                continue;
            }

            $name = trim((string) ($concept['concept'] ?? ''));
            if ($name === '') {
                continue;
            }

            $key = ConceptTerm::normalizeTerm($name);
            $isStart = $key === $startKey;
            $complexity = max(1, min(5, (int) ($concept['complexity'] ?? $targetComplexity)));

            if (! $isStart && ! self::complexityMatches($complexity, $targetComplexity)) {
                $rejectedComplexity++;

                continue;
            }

            if ($isStart && ! self::complexityMatches($complexity, $targetComplexity)) {
                $concept['complexity'] = $targetComplexity;
            }

            $keptConcepts[$key] = $concept;
        }

        $keptEdges = [];
        $rejectedLaterality = 0;

        foreach ($graph['edges'] ?? [] as $edge) {
            if (! is_array($edge)) {
                continue;
            }

            $from = trim((string) ($edge['from'] ?? ''));
            $to = trim((string) ($edge['to'] ?? ''));
            if ($from === '' || $to === '') {
                continue;
            }

            $fromKey = ConceptTerm::normalizeTerm($from);
            $toKey = ConceptTerm::normalizeTerm($to);
            if ($fromKey === $toKey) {
                continue;
            }

            if (! isset($keptConcepts[$fromKey], $keptConcepts[$toKey])) {
                continue;
            }

            $laterality = Laterality::normalize($edge['laterality'] ?? null);
            if ($laterality === null || ! Laterality::inBand($laterality, $bandMin, $bandMax)) {
                $rejectedLaterality++;

                continue;
            }

            $keptEdges[$fromKey.'|'.$toKey] = [
                'from' => $from,
                'to' => $to,
                'laterality' => $laterality,
            ];
        }

        $connected = [];
        foreach ($keptEdges as $edge) {
            $connected[ConceptTerm::normalizeTerm($edge['from'])] = true;
            $connected[ConceptTerm::normalizeTerm($edge['to'])] = true;
        }

        $rejectedOrphan = 0;
        foreach ($keptConcepts as $key => $concept) {
            if ($key === $startKey) {
                continue;
            }
            if (! isset($connected[$key])) {
                unset($keptConcepts[$key]);
                $rejectedOrphan++;
            }
        }

        return [
            'start_concept' => $start,
            'concepts' => array_values($keptConcepts),
            'edges' => array_values($keptEdges),
            'rejected_laterality' => $rejectedLaterality,
            'rejected_complexity' => $rejectedComplexity,
            'rejected_orphan' => $rejectedOrphan,
        ];
    }

    public static function complexityMatches(int $actual, int $target): bool
    {
        return abs($actual - $target) <= self::COMPLEXITY_TOLERANCE;
    }
}
