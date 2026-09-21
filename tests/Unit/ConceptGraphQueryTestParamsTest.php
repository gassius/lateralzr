<?php

namespace Tests\Unit;

use App\Models\Concept;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Services\ConceptGraphQuery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConceptGraphQueryTestParamsTest extends TestCase
{
    use RefreshDatabase;

    public function test_canonical_start_plus_locale_returns_localized_label(): void
    {
        [$creativity] = $this->seedBilingualPair();

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: null,
            locale: 'es',
            canonicalStart: 'creativity',
        );

        $this->assertNotNull($graph);
        $this->assertSame($creativity->id, $graph['start']['id']);
        $this->assertSame('creatividad', $graph['start']['label']);
        $this->assertSame('es', $graph['meta']['locale']);
    }

    public function test_localized_start_still_resolves_by_term(): void
    {
        [$creativity] = $this->seedBilingualPair();

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'creatividad',
            locale: 'es',
        );

        $this->assertNotNull($graph);
        $this->assertSame($creativity->id, $graph['start']['id']);
        $this->assertSame('creatividad', $graph['start']['label']);
    }

    public function test_localized_start_wins_over_canonical_start(): void
    {
        [$creativity, $silence] = $this->seedBilingualPair();

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'silencio',
            locale: 'es',
            canonicalStart: 'creativity',
        );

        $this->assertNotNull($graph);
        $this->assertSame($silence->id, $graph['start']['id']);
        $this->assertSame('silencio', $graph['start']['label']);
        $this->assertSame($creativity->canonical_key, 'creativity');
    }

    public function test_unknown_canonical_start_returns_null(): void
    {
        $this->seedBilingualPair();

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: null,
            locale: 'en',
            canonicalStart: 'no-such-concept',
        );

        $this->assertNull($graph);
    }

    public function test_only_with_media_drops_nodes_without_media(): void
    {
        [$withMedia, $withoutMedia, $alsoMedia] = $this->seedMediaNeighborhood();

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'mushroom',
            locale: 'en',
            onlyWithMedia: true,
        );

        $this->assertNotNull($graph);
        $this->assertSame($withMedia->id, $graph['start']['id']);

        $ids = collect($graph['nodes'])->pluck('id')->all();
        $this->assertContains($withMedia->id, $ids);
        $this->assertContains($alsoMedia->id, $ids);
        $this->assertNotContains($withoutMedia->id, $ids);

        foreach ($graph['nodes'] as $node) {
            $this->assertNotEmpty($node['mediaUrl']);
        }
    }

    public function test_only_with_media_random_start_picks_a_media_bearing_concept(): void
    {
        [$withMedia, $withoutMedia, $alsoMedia] = $this->seedMediaNeighborhood();

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: null,
            locale: 'en',
            onlyWithMedia: true,
        );

        $this->assertNotNull($graph);
        $this->assertContains($graph['start']['id'], [$withMedia->id, $alsoMedia->id]);
        $this->assertNotSame($withoutMedia->id, $graph['start']['id']);
        foreach ($graph['nodes'] as $node) {
            $this->assertNotEmpty($node['mediaUrl']);
        }
    }

    public function test_named_start_without_media_returns_null_when_only_with_media(): void
    {
        $this->seedMediaNeighborhood();

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'tide',
            locale: 'en',
            onlyWithMedia: true,
        );

        $this->assertNull($graph);
    }

    public function test_complexity_prefers_matching_locale_term_label(): void
    {
        $ball = $this->makeConcept('ball', [
            ['locale' => 'en', 'term' => 'ball', 'media' => null, 'complexity' => 1],
            ['locale' => 'en', 'term' => 'spherical object', 'media' => null, 'complexity' => 5],
        ]);
        $fire = $this->makeConcept('fire', [
            ['locale' => 'en', 'term' => 'fire', 'media' => null, 'complexity' => 1],
        ]);
        $this->link($ball, $fire);

        $simple = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'ball',
            locale: 'en',
            complexity: 1,
        );
        $dense = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'ball',
            locale: 'en',
            complexity: 5,
        );

        $this->assertNotNull($simple);
        $this->assertNotNull($dense);
        $this->assertSame('ball', $simple['start']['label']);
        $this->assertSame('spherical object', $dense['start']['label']);
        $this->assertSame(1, $simple['meta']['complexity']);
        $this->assertSame(5, $dense['meta']['complexity']);
    }

    public function test_complexity_random_start_prefers_matching_tier(): void
    {
        $simpleFrom = $this->makeConcept('constraint', [
            ['locale' => 'en', 'term' => 'constraint', 'media' => null, 'complexity' => 2],
        ]);
        $simpleTo = $this->makeConcept('pattern', [
            ['locale' => 'en', 'term' => 'pattern', 'media' => null, 'complexity' => 2],
        ]);
        $denseFrom = $this->makeConcept('emergent-order', [
            ['locale' => 'en', 'term' => 'emergent order', 'media' => null, 'complexity' => 5],
        ]);
        $denseTo = $this->makeConcept('dissipative-structure', [
            ['locale' => 'en', 'term' => 'dissipative structure', 'media' => null, 'complexity' => 5],
        ]);
        $this->link($simpleFrom, $simpleTo);
        $this->link($denseFrom, $denseTo);

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: null,
            locale: 'en',
            complexity: 5,
        );

        $this->assertNotNull($graph);
        $this->assertContains($graph['start']['id'], [$denseFrom->id, $denseTo->id]);
        $this->assertSame(5, $graph['meta']['complexity']);
    }

    public function test_omitting_complexity_keeps_preferred_term_and_omits_meta_key(): void
    {
        $ball = $this->makeConcept('ball', [
            ['locale' => 'en', 'term' => 'ball', 'media' => null, 'complexity' => 1, 'preferred' => false],
            ['locale' => 'en', 'term' => 'spherical object', 'media' => null, 'complexity' => 5, 'preferred' => true],
        ]);
        $fire = $this->makeConcept('fire', [
            ['locale' => 'en', 'term' => 'fire', 'media' => null],
        ]);
        $this->link($ball, $fire);

        $graph = app(ConceptGraphQuery::class)->getGraph(
            startConcept: 'spherical object',
            locale: 'en',
        );

        $this->assertNotNull($graph);
        $this->assertSame('spherical object', $graph['start']['label']);
        $this->assertArrayNotHasKey('complexity', $graph['meta']);
    }

    /**
     * @return array{0: Concept, 1: Concept}
     */
    private function seedBilingualPair(): array
    {
        $creativity = $this->makeConcept('creativity', [
            ['locale' => 'en', 'term' => 'creativity', 'media' => 'https://example.com/creativity.jpg'],
            ['locale' => 'es', 'term' => 'creatividad', 'media' => 'https://example.com/creatividad.jpg'],
        ]);
        $silence = $this->makeConcept('silence', [
            ['locale' => 'en', 'term' => 'silence', 'media' => 'https://example.com/silence.jpg'],
            ['locale' => 'es', 'term' => 'silencio', 'media' => 'https://example.com/silencio.jpg'],
        ]);
        $this->link($creativity, $silence);

        return [$creativity, $silence];
    }

    /**
     * @return array{0: Concept, 1: Concept, 2: Concept}
     */
    private function seedMediaNeighborhood(): array
    {
        $mushroom = $this->makeConcept('mushroom', [
            ['locale' => 'en', 'term' => 'mushroom', 'media' => 'https://example.com/mushroom.jpg'],
        ]);
        $tide = $this->makeConcept('tide', [
            ['locale' => 'en', 'term' => 'tide', 'media' => null],
        ]);
        $lighthouse = $this->makeConcept('lighthouse', [
            ['locale' => 'en', 'term' => 'lighthouse', 'media' => 'https://example.com/lighthouse.jpg'],
        ]);
        $this->link($mushroom, $tide);
        $this->link($mushroom, $lighthouse);

        return [$mushroom, $tide, $lighthouse];
    }

    /**
     * @param  list<array{locale: string, term: string, media: ?string, complexity?: int, preferred?: bool}>  $terms
     */
    private function makeConcept(string $canonical, array $terms): Concept
    {
        $concept = Concept::query()->create(['canonical_key' => $canonical]);
        foreach ($terms as $term) {
            ConceptTerm::query()->create([
                'concept_id' => $concept->id,
                'locale' => $term['locale'],
                'term' => $term['term'],
                'normalized_term' => ConceptTerm::normalizeTerm($term['term']),
                'short_description' => $term['term'].' desc',
                'complexity' => $term['complexity'] ?? 2,
                'is_preferred' => $term['preferred'] ?? true,
                'media_url' => $term['media'],
            ]);
        }

        return $concept;
    }

    private function link(Concept $from, Concept $to): void
    {
        ConceptRelationship::query()->create([
            'from_concept_id' => $from->id,
            'to_concept_id' => $to->id,
            'strength' => 0.8,
            'last_laterality' => 3,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);
    }
}
