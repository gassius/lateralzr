<?php

namespace Tests\Unit;

use App\Services\GeneratedGraphConstraints;
use Tests\TestCase;

class GeneratedGraphConstraintsTest extends TestCase
{
    public function test_drops_edges_outside_the_band_and_concepts_outside_complexity_tolerance(): void
    {
        $filtered = GeneratedGraphConstraints::apply(
            [
                'start_concept' => 'Ball',
                'concepts' => [
                    ['concept' => 'Ball', 'shortDescription' => 'A round toy.', 'complexity' => 3],
                    ['concept' => 'Harbor', 'shortDescription' => 'A sheltered port.', 'complexity' => 3],
                    ['concept' => 'String theory', 'shortDescription' => 'A physics framework.', 'complexity' => 5],
                    ['concept' => 'Chair', 'shortDescription' => 'Something to sit on.', 'complexity' => 3],
                ],
                'edges' => [
                    ['from' => 'Ball', 'to' => 'Harbor', 'laterality' => 0.5],
                    ['from' => 'Ball', 'to' => 'String theory', 'laterality' => 0.5],
                    ['from' => 'Ball', 'to' => 'Chair', 'laterality' => 0.9],
                ],
            ],
            targetComplexity: 3,
            bandMin: 0.4,
            bandMax: 0.6,
        );

        $labels = collect($filtered['concepts'])->pluck('concept')->all();
        $this->assertEqualsCanonicalizing(['Ball', 'Harbor'], $labels);
        $this->assertCount(1, $filtered['edges']);
        $this->assertSame(0.5, $filtered['edges'][0]['laterality']);
        $this->assertSame(1, $filtered['rejected_laterality']);
        $this->assertSame(1, $filtered['rejected_complexity']);
    }

    public function test_complexity_tolerance_is_plus_or_minus_one(): void
    {
        $this->assertTrue(GeneratedGraphConstraints::complexityMatches(2, 3));
        $this->assertTrue(GeneratedGraphConstraints::complexityMatches(4, 3));
        $this->assertTrue(GeneratedGraphConstraints::complexityMatches(3, 3));
        $this->assertFalse(GeneratedGraphConstraints::complexityMatches(1, 3));
        $this->assertFalse(GeneratedGraphConstraints::complexityMatches(5, 3));
    }
}
