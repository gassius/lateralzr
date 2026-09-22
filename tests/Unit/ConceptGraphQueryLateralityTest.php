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

    public function test_laterality_prefers_closer_edges_over_stronger_adjacent_ones(): void
    {
        $mushroom = $this->makeConcept('mushroom');
        $tide = $this->makeConcept('tide');
        $chaos = $this->makeConcept('chaos');
        $this->link($mushroom, $tide, laterality: 2, strength: 0.95);
        $this->link($mushroom, $chaos, laterality: 5, strength: 0.40);

        $default = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 1,
            depth: 1,
            locale: 'en',
        );
        $this->assertNotNull($default);
        $this->assertSame($tide->id, $default['edges'][0]['to']);

        $lateral = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            limit: 1,
            depth: 1,
            locale: 'en',
            laterality: 5,
        );
        $this->assertNotNull($lateral);
        $this->assertSame($chaos->id, $lateral['edges'][0]['to']);
        $this->assertSame(5, $lateral['meta']['laterality']);
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

    private function link(Concept $from, Concept $to, int $laterality, float $strength): void
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
