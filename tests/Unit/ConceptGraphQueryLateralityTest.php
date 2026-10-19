<?php

namespace Tests\Unit;

use App\Models\Concept;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Services\ConceptGraphQuery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConceptGraphQueryLateralityTest extends TestCase
{
    use RefreshDatabase;

    public function test_laterality_filters_to_the_requested_score(): void
    {
        $mushroom = $this->makeConcept('mushroom');
        $tide = $this->makeConcept('tide');
        $chaos = $this->makeConcept('chaos');
        $this->link($mushroom, $tide, laterality: 0.25, strength: 0.95);
        $this->link($mushroom, $chaos, laterality: 1.0, strength: 0.40);

        $default = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 2,
            depth: 1,
            locale: 'en',
        );
        $this->assertNotNull($default);
        $this->assertCount(2, $default['edges']);

        $lateral = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 2,
            depth: 1,
            locale: 'en',
            laterality: 1.0,
        );
        $this->assertNotNull($lateral);
        $this->assertCount(1, $lateral['edges']);
        $this->assertSame($chaos->id, $lateral['edges'][0]['to']);
        $this->assertEqualsWithDelta(1.0, $lateral['edges'][0]['laterality'], 0.001);
        $this->assertEqualsWithDelta(1.0, $lateral['meta']['laterality'], 0.001);

        $near = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 2,
            depth: 1,
            locale: 'en',
            laterality: 0.25,
        );
        $this->assertNotNull($near);
        $this->assertCount(1, $near['edges']);
        $this->assertSame($tide->id, $near['edges'][0]['to']);
        $this->assertEqualsWithDelta(0.25, $near['edges'][0]['laterality'], 0.001);
    }

    public function test_laterality_filter_returns_null_when_no_edge_matches(): void
    {
        $mushroom = $this->makeConcept('mushroom');
        $tide = $this->makeConcept('tide');
        $this->link($mushroom, $tide, laterality: 0.25, strength: 0.95);

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 2,
            depth: 1,
            locale: 'en',
            laterality: 1.0,
        );

        $this->assertNull($graph);
    }

    public function test_null_last_laterality_is_half_in_filter_and_response(): void
    {
        $mushroom = $this->makeConcept('mushroom');
        $bridge = $this->makeConcept('bridge');
        $this->link($mushroom, $bridge, laterality: null, strength: 0.80);

        $atHalf = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 2,
            depth: 1,
            locale: 'en',
            laterality: 0.5,
        );
        $this->assertNotNull($atHalf);
        $this->assertCount(1, $atHalf['edges']);
        $this->assertEqualsWithDelta(0.5, $atHalf['edges'][0]['laterality'], 0.001);

        $atZero = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 2,
            depth: 1,
            locale: 'en',
            laterality: 0.0,
        );
        $this->assertNull($atZero);
    }

    public function test_random_start_honours_laterality_filter(): void
    {
        $scores = [0.0, 0.25, 0.5, 0.75, 1.0];
        $starts = [];
        foreach ($scores as $index => $score) {
            $from = $this->makeConcept("seed-{$index}");
            $to = $this->makeConcept("nbr-{$index}");
            $this->link($from, $to, laterality: $score, strength: 0.9);
            $starts[(string) $score] = $from->id;
        }

        foreach ($scores as $score) {
            $graph = app(ConceptGraphQuery::class)->getGraph(
                startConcept: null,
                locale: 'en',
                laterality: $score,
            );
            $this->assertNotNull($graph);
            $this->assertSame($starts[(string) $score], $graph['start']['id']);
            $this->assertEqualsWithDelta($score, $graph['meta']['laterality'], 0.001);
            foreach ($graph['edges'] as $edge) {
                $this->assertEqualsWithDelta($score, $edge['laterality'], 0.001);
            }
        }

        for ($i = 0; $i < 20; $i++) {
            $graph = app(ConceptGraphQuery::class)->getGraph(
                startConcept: null,
                locale: 'en',
                laterality: 1.0,
            );
            $this->assertNotNull($graph);
            $this->assertSame($starts['1'], $graph['start']['id']);
            $this->assertEqualsWithDelta(1.0, $graph['meta']['laterality'], 0.001);
            foreach ($graph['edges'] as $edge) {
                $this->assertEqualsWithDelta(1.0, $edge['laterality'], 0.001);
            }
        }
    }

    public function test_omitting_laterality_does_not_add_meta_laterality(): void
    {
        $from = $this->makeConcept('creativity');
        $to = $this->makeConcept('silence');
        $this->link($from, $to, laterality: 0.5, strength: 0.8);

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'creativity',
            locale: 'en',
        );

        $this->assertNotNull($graph);
        $this->assertArrayNotHasKey('laterality', $graph['meta']);
    }

    private function makeConcept(string $canonical): Concept
    {
        $concept = Concept::query()->create(['canonical_key' => $canonical]);
        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => 'en',
            'term' => $canonical,
            'normalized_term' => ConceptTerm::normalizeTerm($canonical),
            'short_description' => $canonical.' desc',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        return $concept;
    }

    private function link(Concept $from, Concept $to, ?float $laterality, float $strength): void
    {
        ConceptRelationship::query()->create([
            'from_concept_id' => $from->id,
            'to_concept_id' => $to->id,
            'strength' => $strength,
            'last_laterality' => $laterality,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);
    }
}
