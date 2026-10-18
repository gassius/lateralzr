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

    public function test_laterality_filters_to_the_requested_grade(): void
    {
        $mushroom = $this->makeConcept('mushroom');
        $tide = $this->makeConcept('tide');
        $chaos = $this->makeConcept('chaos');
        $this->link($mushroom, $tide, laterality: 2, strength: 0.95);
        $this->link($mushroom, $chaos, laterality: 5, strength: 0.40);

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
            laterality: 5,
        );
        $this->assertNotNull($lateral);
        $this->assertCount(1, $lateral['edges']);
        $this->assertSame($chaos->id, $lateral['edges'][0]['to']);
        $this->assertSame(5, $lateral['edges'][0]['laterality']);
        $this->assertSame(5, $lateral['meta']['laterality']);

        $near = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 2,
            depth: 1,
            locale: 'en',
            laterality: 2,
        );
        $this->assertNotNull($near);
        $this->assertCount(1, $near['edges']);
        $this->assertSame($tide->id, $near['edges'][0]['to']);
        $this->assertSame(2, $near['edges'][0]['laterality']);
    }

    public function test_laterality_filter_returns_null_when_no_edge_matches(): void
    {
        $mushroom = $this->makeConcept('mushroom');
        $tide = $this->makeConcept('tide');
        $this->link($mushroom, $tide, laterality: 2, strength: 0.95);

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 2,
            depth: 1,
            locale: 'en',
            laterality: 5,
        );

        $this->assertNull($graph);
    }

    public function test_null_last_laterality_is_grade_three_in_filter_and_response(): void
    {
        $mushroom = $this->makeConcept('mushroom');
        $bridge = $this->makeConcept('bridge');
        $this->link($mushroom, $bridge, laterality: null, strength: 0.80);

        $atThree = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 2,
            depth: 1,
            locale: 'en',
            laterality: 3,
        );
        $this->assertNotNull($atThree);
        $this->assertCount(1, $atThree['edges']);
        $this->assertSame(3, $atThree['edges'][0]['laterality']);

        $atOne = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 2,
            depth: 1,
            locale: 'en',
            laterality: 1,
        );
        $this->assertNull($atOne);
    }

    public function test_omitting_laterality_does_not_add_meta_laterality(): void
    {
        $from = $this->makeConcept('creativity');
        $to = $this->makeConcept('silence');
        $this->link($from, $to, laterality: 3, strength: 0.8);

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

    private function link(Concept $from, Concept $to, ?int $laterality, float $strength): void
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
