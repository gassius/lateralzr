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
     * @param  list<array{locale: string, term: string, media: ?string}>  $terms
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
                'complexity' => 2,
                'is_preferred' => true,
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
