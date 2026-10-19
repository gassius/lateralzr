<?php

namespace App\Services;

class ConceptPromptEvalService
{
    /**
     * @var list<string>
     */
    public const DEFAULT_SEEDS = ['Ball', 'Harbor', 'Kyoto'];

    public function __construct(
        protected ConceptRelationshipService $generator,
        protected ConceptGenerationSettings $settings,
    ) {}

    /**
     * @param  list<string>  $seeds
     * @param  object|null  $agent  Optional fake LLM (prompt() → StructuredAgentResponse)
     * @return array{rows: list<list<string>>, summary: array{count_hit_rate: string, laterality_in_band_rate: string, complexity_in_tol_rate: string, complexity_tolerance: int}}
     */
    public function run(
        array $seeds,
        int $count = 3,
        int $complexity = 3,
        int $iterations = 1,
        ?object $agent = null,
    ): array {
        $band = $this->settings->band();
        $rows = [];
        $countHits = 0;
        $countTotal = 0;
        $edgesInBand = 0;
        $edgesTotal = 0;
        $complexityHits = 0;
        $complexityTotal = 0;

        foreach ($seeds as $seed) {
            for ($i = 0; $i < $iterations; $i++) {
                $result = $this->generator->generateRelationships(
                    startConcept: $seed,
                    count: $count,
                    agent: $agent,
                    complexity: $complexity,
                );

                $returned = count($result['concepts']);
                $countHit = $returned >= $count;
                $countHits += $countHit ? 1 : 0;
                $countTotal++;

                $complexities = [];
                foreach ($result['concepts'] as $concept) {
                    $value = (int) ($concept['complexity'] ?? $complexity);
                    $complexities[] = $value;
                    $complexityTotal++;
                    if (GeneratedGraphConstraints::complexityMatches($value, $complexity)) {
                        $complexityHits++;
                    }
                }

                $lateralities = [];
                foreach ($result['edges'] as $edge) {
                    $value = (float) ($edge['laterality'] ?? 0);
                    $lateralities[] = $value;
                    $edgesTotal++;
                    if ($value + 1e-9 >= $band['min'] && $value - 1e-9 <= $band['max']) {
                        $edgesInBand++;
                    }
                }

                $complexityMean = $complexities === [] ? 0.0 : array_sum($complexities) / count($complexities);
                $latMin = $lateralities === [] ? 0.0 : min($lateralities);
                $latMax = $lateralities === [] ? 0.0 : max($lateralities);
                $inBandRate = $lateralities === [] ? 0.0 : (count(array_filter(
                    $lateralities,
                    fn (float $value) => $value + 1e-9 >= $band['min'] && $value - 1e-9 <= $band['max']
                )) / count($lateralities));
                $inTolRate = $complexities === [] ? 0.0 : (
                    count(array_filter(
                        $complexities,
                        fn (int $value) => GeneratedGraphConstraints::complexityMatches($value, $complexity)
                    )) / count($complexities)
                );

                $rows[] = [
                    $seed,
                    (string) $count,
                    (string) $returned,
                    $countHit ? '1' : '0',
                    number_format($complexityMean, 2, '.', ''),
                    number_format((float) $latMin, 2, '.', ''),
                    number_format((float) $latMax, 2, '.', ''),
                    number_format($inBandRate, 2, '.', ''),
                    number_format($inTolRate, 2, '.', ''),
                ];
            }
        }

        return [
            'rows' => $rows,
            'summary' => [
                'count_hit_rate' => $this->percent($countHits, $countTotal),
                'laterality_in_band_rate' => $this->percent($edgesInBand, $edgesTotal),
                'complexity_in_tol_rate' => $this->percent($complexityHits, $complexityTotal),
                'complexity_tolerance' => GeneratedGraphConstraints::COMPLEXITY_TOLERANCE,
            ],
        ];
    }

    protected function percent(int $hits, int $total): string
    {
        if ($total === 0) {
            return '0%';
        }

        return round(100 * $hits / $total).'%';
    }
}
