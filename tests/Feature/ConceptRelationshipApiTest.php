<?php

namespace Tests\Feature;

use App\Models\Concept;
use App\Models\ConceptMedia;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Services\ConceptGraphQuery;
use App\Support\Laterality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class ConceptRelationshipApiTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_relationships_endpoint_returns_success_with_valid_start(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')->once()->andReturn([
            'start' => ['id' => 1, 'label' => 'creativity'],
            'nodes' => [
                ['id' => 1, 'label' => 'creativity', 'shortDescription' => 'The use of imagination or original ideas to create something', 'complexity' => 1, 'wikiUrl' => 'https://en.wikipedia.org/wiki/Creativity', 'mediaUrl' => null, 'media' => [], 'locale' => 'en', 'degree' => 1],
                ['id' => 2, 'label' => 'constraint', 'shortDescription' => 'A limitation or restriction.', 'complexity' => 1, 'wikiUrl' => 'https://en.wikipedia.org/wiki/Constraint', 'mediaUrl' => null, 'media' => [], 'locale' => 'en', 'degree' => 1],
            ],
            'edges' => [
                ['id' => 10, 'from' => 1, 'to' => 2, 'strength' => 0.72, 'laterality' => 3, 'laterality_score' => 0.5],
            ],
            'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'en'],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure($this->graphJsonStructure())
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'start' => ['label' => 'creativity'],
                ],
            ]);
    }

    public function test_relationships_endpoint_accepts_limit_parameter(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')->once()->andReturn([
            'start' => ['id' => 1, 'label' => 'innovation'],
            'nodes' => [['id' => 1, 'label' => 'innovation', 'shortDescription' => 'The introduction of something new', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'media' => [], 'locale' => 'en', 'degree' => 0]],
            'edges' => [],
            'meta' => ['depth' => 2, 'limit' => 5, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'en'],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'innovation',
            'limit' => 5,
        ]);

        $response->assertStatus(200);
    }

    public function test_relationships_endpoint_accepts_empty_body_and_uses_random_seed(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')->once()->andReturn([
            'start' => ['id' => 1, 'label' => 'creativity'],
            'nodes' => [['id' => 1, 'label' => 'creativity', 'shortDescription' => 'Cold start', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'media' => [], 'locale' => 'en', 'degree' => 0]],
            'edges' => [],
            'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'en'],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', []);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success'])
            ->assertJsonStructure(['data' => ['start' => ['label'], 'nodes', 'edges']]);
    }

    public function test_relationships_endpoint_validates_start_is_string(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 123,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['start']);
    }

    public function test_relationships_endpoint_treats_whitespace_only_start_as_cold_start(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')->once()->andReturn([
            'start' => ['id' => 1, 'label' => 'innovation'],
            'nodes' => [['id' => 1, 'label' => 'innovation', 'shortDescription' => 'Cold start', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'media' => [], 'locale' => 'en', 'degree' => 0]],
            'edges' => [],
            'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'en'],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => '   ',  // only whitespace -> normalized to null (cold start)
        ]);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);
    }

    public function test_relationships_endpoint_validates_limit_range(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'test',
            'limit' => 501,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['limit']);
    }

    public function test_relationships_endpoint_validates_depth_range(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'test',
            'depth' => 6,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['depth']);
    }

    public function test_relationships_endpoint_passes_graph_options_to_db_query(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with('creativity', 40, 3, 0.2, 'en', null, false, null, null, false)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creativity'],
                'nodes' => [['id' => 1, 'label' => 'creativity', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'media' => [], 'locale' => 'en', 'degree' => 0]],
                'edges' => [],
                'meta' => ['depth' => 3, 'limit' => 40, 'minStrength' => 0.2, 'hasMore' => false, 'locale' => 'en'],
            ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'limit' => 40,
            'depth' => 3,
            'minStrength' => 0.2,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.meta.depth', 3);
    }

    public function test_relationships_endpoint_accepts_locale_and_defaults_to_en(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with('creativity', 100, 2, 0.0, 'es', null, false, null, null, false)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creatividad'],
                'nodes' => [['id' => 1, 'label' => 'creatividad', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'media' => [], 'locale' => 'es', 'degree' => 0]],
                'edges' => [],
                'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'es'],
            ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'locale' => 'es',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.meta.locale', 'es')
            ->assertJsonPath('data.start.label', 'creatividad');
    }

    public function test_relationships_endpoint_rejects_unsupported_locale(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'locale' => 'fr',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['locale']);
    }

    public function test_relationships_endpoint_returns_404_when_not_prefetched(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')->once()->andReturn(null);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'test',
        ]);

        $response->assertStatus(404)
            ->assertJson([
                'status' => 'error',
            ]);
    }

    public function test_relationships_endpoint_passes_canonical_start_and_only_with_media(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with(null, 100, 2, 0.0, 'es', 'creativity', true, null, null, false)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creatividad'],
                'nodes' => [['id' => 1, 'label' => 'creatividad', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => 'https://example.com/c.jpg', 'media' => [['url' => 'https://example.com/c.jpg', 'kind' => 'image', 'license' => 'CC0']], 'locale' => 'es', 'degree' => 0]],
                'edges' => [],
                'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'es'],
            ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'canonicalConcept' => 'creativity',
            'locale' => 'es',
            'onlyWithMedia' => true,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.start.label', 'creatividad')
            ->assertJsonPath('data.meta.locale', 'es');
    }

    public function test_relationships_endpoint_accepts_localized_concept_alias(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with('creatividad', 100, 2, 0.0, 'es', null, false, null, null, false)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creatividad'],
                'nodes' => [['id' => 1, 'label' => 'creatividad', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'media' => [], 'locale' => 'es', 'degree' => 0]],
                'edges' => [],
                'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'es'],
            ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'localizedConcept' => 'creatividad',
            'locale' => 'es',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.start.label', 'creatividad');
    }

    public function test_relationships_endpoint_passes_complexity_to_graph_query(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with('creativity', 100, 2, 0.0, 'en', null, false, 5, null, false)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creativity'],
                'nodes' => [['id' => 1, 'label' => 'creativity', 'shortDescription' => 'Desc', 'complexity' => 5, 'wikiUrl' => null, 'mediaUrl' => null, 'media' => [], 'locale' => 'en', 'degree' => 0]],
                'edges' => [],
                'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'en', 'complexity' => 5],
            ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'complexity' => 5,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.meta.complexity', 5);
    }

    public function test_relationships_endpoint_validates_complexity_range(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'complexity' => 6,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['complexity']);
    }

    public function test_relationships_endpoint_maps_legacy_laterality_grade_to_graph_query(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with('creativity', 100, 2, 0.0, 'en', null, false, null, 0.75, true)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creativity'],
                'nodes' => [['id' => 1, 'label' => 'creativity', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'media' => [], 'locale' => 'en', 'degree' => 0]],
                'edges' => [],
                'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'en', 'laterality' => 4, 'laterality_score' => 0.75],
            ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality' => 4,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.meta.laterality', 4)
            ->assertJsonPath('data.meta.laterality_score', 0.75);
    }

    public function test_relationships_endpoint_passes_laterality_score_to_graph_query(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with('creativity', 100, 2, 0.0, 'en', null, false, null, 0.47, false)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creativity'],
                'nodes' => [['id' => 1, 'label' => 'creativity', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'media' => [], 'locale' => 'en', 'degree' => 0]],
                'edges' => [],
                'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'en', 'laterality' => 3, 'laterality_score' => 0.47],
            ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality_score' => 0.47,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.meta.laterality', 3)
            ->assertJsonPath('data.meta.laterality_score', 0.47);
    }

    public function test_relationships_endpoint_rejects_out_of_range_laterality_params(): void
    {
        $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality' => 0,
        ])->assertStatus(422)->assertJsonValidationErrors(['laterality']);

        $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality' => 6,
        ])->assertStatus(422)->assertJsonValidationErrors(['laterality']);

        $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality' => 0.75,
        ])->assertStatus(422)->assertJsonValidationErrors(['laterality']);

        $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality_score' => -0.1,
        ])->assertStatus(422)->assertJsonValidationErrors(['laterality_score']);

        $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality_score' => 1.1,
        ])->assertStatus(422)->assertJsonValidationErrors(['laterality_score']);
    }

    public function test_relationships_endpoint_filters_by_legacy_laterality_grade(): void
    {
        $mushroom = $this->makeConcept('mushroom', 'mushroom', 'https://example.com/mushroom.jpg');
        $tide = $this->makeConcept('tide', 'tide', 'https://example.com/tide.jpg');
        $chaos = $this->makeConcept('chaos', 'chaos', 'https://example.com/chaos.jpg');

        ConceptRelationship::query()->create([
            'from_concept_id' => $mushroom->id,
            'to_concept_id' => $tide->id,
            'strength' => 0.95,
            'last_laterality' => 0.25,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);
        ConceptRelationship::query()->create([
            'from_concept_id' => $mushroom->id,
            'to_concept_id' => $chaos->id,
            'strength' => 0.40,
            'last_laterality' => 1.0,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);

        $gradeFive = $this->postJson('/api/concepts/relationships', [
            'start' => 'mushroom',
            'laterality' => 5,
            'limit' => 4,
            'depth' => 1,
        ]);
        $gradeFive->assertStatus(200)
            ->assertJsonPath('data.meta.laterality', 5)
            ->assertJsonPath('data.edges.0.to', $chaos->id)
            ->assertJsonPath('data.edges.0.laterality', 5);
        $this->assertEqualsWithDelta(1.0, (float) $gradeFive->json('data.meta.laterality_score'), 0.001);
        $this->assertEqualsWithDelta(1.0, (float) $gradeFive->json('data.edges.0.laterality_score'), 0.001);

        $this->postJson('/api/concepts/relationships', [
            'start' => 'mushroom',
            'laterality' => 4,
            'limit' => 4,
            'depth' => 1,
        ])->assertStatus(404);

        $gradeTwo = $this->postJson('/api/concepts/relationships', [
            'start' => 'mushroom',
            'laterality' => 2,
            'limit' => 4,
            'depth' => 1,
        ]);
        $gradeTwo->assertStatus(200)
            ->assertJsonPath('data.meta.laterality', 2)
            ->assertJsonPath('data.edges.0.to', $tide->id)
            ->assertJsonPath('data.edges.0.laterality', 2);
        $this->assertEqualsWithDelta(0.25, (float) $gradeTwo->json('data.meta.laterality_score'), 0.001);
        $this->assertEqualsWithDelta(0.25, (float) $gradeTwo->json('data.edges.0.laterality_score'), 0.001);
    }

    public function test_relationships_endpoint_filters_by_laterality_score(): void
    {
        $mushroom = $this->makeConcept('mushroom', 'mushroom', 'https://example.com/mushroom.jpg');
        $tide = $this->makeConcept('tide', 'tide', 'https://example.com/tide.jpg');
        $chaos = $this->makeConcept('chaos', 'chaos', 'https://example.com/chaos.jpg');

        ConceptRelationship::query()->create([
            'from_concept_id' => $mushroom->id,
            'to_concept_id' => $tide->id,
            'strength' => 0.95,
            'last_laterality' => 0.25,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);
        ConceptRelationship::query()->create([
            'from_concept_id' => $mushroom->id,
            'to_concept_id' => $chaos->id,
            'strength' => 0.40,
            'last_laterality' => 1.0,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);

        $atOne = $this->postJson('/api/concepts/relationships', [
            'start' => 'mushroom',
            'laterality_score' => 1,
            'limit' => 4,
            'depth' => 1,
        ]);
        $atOne->assertStatus(200)
            ->assertJsonPath('data.meta.laterality', 5)
            ->assertJsonPath('data.edges.0.to', $chaos->id)
            ->assertJsonPath('data.edges.0.laterality', 5);
        $this->assertEqualsWithDelta(1.0, (float) $atOne->json('data.meta.laterality_score'), 0.001);
        $this->assertEqualsWithDelta(1.0, (float) $atOne->json('data.edges.0.laterality_score'), 0.001);

        $this->postJson('/api/concepts/relationships', [
            'start' => 'mushroom',
            'laterality_score' => 0.75,
            'limit' => 4,
            'depth' => 1,
        ])->assertStatus(404);
    }

    public function test_legacy_grade_filter_matches_the_grade_reported_on_in_band_edges(): void
    {
        $mushroom = $this->makeConcept('mushroom', 'mushroom', 'https://example.com/mushroom.jpg');
        $harbor = $this->makeConcept('harbor', 'harbor', 'https://example.com/harbor.jpg');
        $bridge = $this->makeConcept('bridge', 'bridge', 'https://example.com/bridge.jpg');

        ConceptRelationship::query()->create([
            'from_concept_id' => $mushroom->id,
            'to_concept_id' => $harbor->id,
            'strength' => 0.80,
            'last_laterality' => 0.45,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);
        ConceptRelationship::query()->create([
            'from_concept_id' => $mushroom->id,
            'to_concept_id' => $bridge->id,
            'strength' => 0.70,
            'last_laterality' => 0.375,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);

        $seeded = [
            $harbor->id => 0.45,
            $bridge->id => 0.375,
        ];

        $byGrade = [];
        foreach ([2, 3] as $grade) {
            $response = $this->postJson('/api/concepts/relationships', [
                'start' => 'mushroom',
                'laterality' => $grade,
                'limit' => 8,
                'depth' => 1,
            ]);
            $byGrade[$grade] = $response->status() === 200
                ? collect($response->json('data.edges'))
                : collect();
        }

        foreach ($seeded as $toId => $score) {
            $reported = Laterality::toLegacyInteger($score);
            $this->assertNotNull($reported);
            $matches = $byGrade[$reported]->firstWhere('to', $toId);
            $this->assertNotNull($matches, "score {$score} must be returned for laterality {$reported}");
            $this->assertSame($reported, $matches['laterality']);
            $this->assertEqualsWithDelta(Laterality::clamp($score), (float) $matches['laterality_score'], 0.001);

            foreach ($byGrade as $grade => $edges) {
                if ($grade === $reported) {
                    continue;
                }
                $this->assertNull($edges->firstWhere('to', $toId), "score {$score} must not match laterality {$grade}");
            }
        }

        $exactScore = $this->postJson('/api/concepts/relationships', [
            'start' => 'mushroom',
            'laterality_score' => 0.45,
            'limit' => 8,
            'depth' => 1,
        ]);
        $exactScore->assertStatus(200);
        $scoreTos = collect($exactScore->json('data.edges'))->pluck('to')->all();
        $this->assertSame([$harbor->id], $scoreTos);
    }

    public function test_relationships_endpoint_laterality_score_wins_over_legacy_grade(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with('creativity', 100, 2, 0.0, 'en', null, false, null, 0.25, false)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creativity'],
                'nodes' => [['id' => 1, 'label' => 'creativity', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'media' => [], 'locale' => 'en', 'degree' => 0]],
                'edges' => [],
                'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false, 'locale' => 'en', 'laterality' => 2, 'laterality_score' => 0.25],
            ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality' => 5,
            'laterality_score' => 0.25,
        ])->assertStatus(200);
    }

    public function test_relationships_endpoint_random_start_filters_by_laterality_contracts(): void
    {
        $starts = [];
        $grades = [1 => 0.0, 2 => 0.25, 3 => 0.5, 4 => 0.75, 5 => 1.0];
        foreach ($grades as $grade => $score) {
            $from = $this->makeConcept("seed-{$grade}", "seed-{$grade}", "https://example.com/seed-{$grade}.jpg");
            $to = $this->makeConcept("nbr-{$grade}", "nbr-{$grade}", "https://example.com/nbr-{$grade}.jpg");
            ConceptRelationship::query()->create([
                'from_concept_id' => $from->id,
                'to_concept_id' => $to->id,
                'strength' => 0.9,
                'last_laterality' => $score,
                'llm_occurrences' => 1,
                'user_weight' => 0,
            ]);
            $starts[$grade] = $from->id;
        }

        foreach ($grades as $grade => $score) {
            $byGrade = $this->postJson('/api/concepts/relationships', [
                'laterality' => $grade,
            ]);
            $byGrade->assertStatus(200)
                ->assertJsonPath('data.start.id', $starts[$grade])
                ->assertJsonPath('data.meta.laterality', $grade)
                ->assertJsonPath('data.edges.0.laterality', $grade);
            $this->assertEqualsWithDelta($score, (float) $byGrade->json('data.meta.laterality_score'), 0.001);
            $this->assertEqualsWithDelta($score, (float) $byGrade->json('data.edges.0.laterality_score'), 0.001);

            $byScore = $this->postJson('/api/concepts/relationships', [
                'laterality_score' => $score,
            ]);
            $byScore->assertStatus(200)
                ->assertJsonPath('data.start.id', $starts[$grade])
                ->assertJsonPath('data.meta.laterality', $grade)
                ->assertJsonPath('data.edges.0.laterality', $grade);
            $this->assertEqualsWithDelta($score, (float) $byScore->json('data.meta.laterality_score'), 0.001);
            $this->assertEqualsWithDelta($score, (float) $byScore->json('data.edges.0.laterality_score'), 0.001);
        }

        for ($i = 0; $i < 20; $i++) {
            $response = $this->postJson('/api/concepts/relationships', [
                'laterality' => 5,
            ]);
            $response->assertStatus(200)
                ->assertJsonPath('data.start.id', $starts[5])
                ->assertJsonPath('data.meta.laterality', 5);
            $this->assertEqualsWithDelta(1.0, (float) $response->json('data.meta.laterality_score'), 0.001);
        }
    }

    public function test_relationships_endpoint_treats_null_laterality_as_half(): void
    {
        $from = $this->makeConcept('creativity', 'creativity', 'https://example.com/creativity.jpg');
        $to = $this->makeConcept('silence', 'silence', 'https://example.com/silence.jpg');

        ConceptRelationship::query()->create([
            'from_concept_id' => $from->id,
            'to_concept_id' => $to->id,
            'strength' => 0.72,
            'last_laterality' => null,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);

        $byGrade = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality' => 3,
        ]);
        $byGrade->assertStatus(200)
            ->assertJsonPath('data.edges.0.laterality', 3);
        $this->assertEqualsWithDelta(0.5, (float) $byGrade->json('data.edges.0.laterality_score'), 0.001);

        $byScore = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality_score' => 0.5,
        ]);
        $byScore->assertStatus(200)
            ->assertJsonPath('data.edges.0.laterality', 3);
        $this->assertEqualsWithDelta(0.5, (float) $byScore->json('data.edges.0.laterality_score'), 0.001);

        $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality' => 1,
        ])->assertStatus(404);

        $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'laterality_score' => 0,
        ])->assertStatus(404);
    }

    public function test_fetch_seeded_pair_returns_live_response_keys(): void
    {
        $from = $this->makeConcept('creativity', 'creativity', 'https://example.com/creativity.jpg');
        $to = $this->makeConcept('silence', 'silence', 'https://example.com/silence.jpg');

        ConceptRelationship::query()->create([
            'from_concept_id' => $from->id,
            'to_concept_id' => $to->id,
            'strength' => 0.72,
            'last_laterality' => 0.5,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'complexity' => 2,
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure($this->graphJsonStructure(includeComplexity: true))
            ->assertJsonPath('data.meta.locale', 'en')
            ->assertJsonPath('data.meta.complexity', 2)
            ->assertJsonPath('data.start.label', 'creativity');

        $nodes = $response->json('data.nodes');
        $this->assertIsArray($nodes);
        $this->assertNotEmpty($nodes);
        foreach ($nodes as $node) {
            $this->assertSame('en', $node['locale']);
            $this->assertIsArray($node['media']);
            $this->assertNotEmpty($node['media']);
            $this->assertArrayHasKey('url', $node['media'][0]);
            $this->assertArrayHasKey('kind', $node['media'][0]);
            $this->assertArrayHasKey('license', $node['media'][0]);
            foreach ([
                'purpose', 'alt', 'creator', 'sourcePageUrl', 'licenceName',
                'licenceUrl', 'changeNotice', 'focalX', 'focalY', 'tone',
            ] as $key) {
                $this->assertArrayHasKey($key, $node['media'][0]);
            }
            $this->assertNull($node['media'][0]['purpose']);
            $this->assertNull($node['media'][0]['alt']);
            $this->assertNull($node['media'][0]['licenceUrl']);
            $this->assertSame('CC0', $node['media'][0]['licenceName']);
        }
    }

    public function test_relationship_media_serialises_full_provenance(): void
    {
        $concept = $this->makeConcept('harbour', 'harbour', 'https://example.com/harbour.jpg');
        $other = $this->makeConcept('tide', 'tide', 'https://example.com/tide.jpg');
        ConceptRelationship::query()->create([
            'from_concept_id' => $concept->id,
            'to_concept_id' => $other->id,
            'strength' => 0.72,
            'last_laterality' => 0.5,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);
        $media = ConceptMedia::query()->where('concept_id', $concept->id)->firstOrFail();
        $media->fill([
            'purpose' => 'photo',
            'alt' => 'A quiet harbour at dusk',
            'creator' => 'Ada Example',
            'source_page_url' => 'https://commons.wikimedia.org/wiki/File:silence.jpg',
            'licence_name' => 'CC0',
            'licence_url' => 'https://creativecommons.org/publicdomain/zero/1.0/',
            'change_notice' => 'cropped',
            'focal_x' => 0.4,
            'focal_y' => 0.6,
            'tone' => 'dark',
        ])->save();

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'harbour',
            'complexity' => 2,
        ]);

        $response->assertStatus(200);
        $node = collect($response->json('data.nodes'))->firstWhere('id', $concept->id);
        $this->assertIsArray($node);
        $row = $node['media'][0];
        $this->assertSame('photo', $row['purpose']);
        $this->assertSame('A quiet harbour at dusk', $row['alt']);
        $this->assertSame('Ada Example', $row['creator']);
        $this->assertSame('https://commons.wikimedia.org/wiki/File:silence.jpg', $row['sourcePageUrl']);
        $this->assertSame('CC0', $row['licenceName']);
        $this->assertSame('https://creativecommons.org/publicdomain/zero/1.0/', $row['licenceUrl']);
        $this->assertSame('cropped', $row['changeNotice']);
        $this->assertEqualsWithDelta(0.4, $row['focalX'], 0.0001);
        $this->assertEqualsWithDelta(0.6, $row['focalY'], 0.0001);
        $this->assertSame('dark', $row['tone']);
    }

    /**
     * @return array<string, mixed>
     */
    private function graphJsonStructure(bool $includeComplexity = false): array
    {
        $meta = [
            'depth',
            'limit',
            'minStrength',
            'hasMore',
            'locale',
        ];
        if ($includeComplexity) {
            $meta[] = 'complexity';
        }

        return [
            'data' => [
                'start' => ['id', 'label'],
                'nodes' => [
                    '*' => [
                        'id',
                        'label',
                        'shortDescription',
                        'complexity',
                        'wikiUrl',
                        'mediaUrl',
                        'media',
                        'locale',
                        'degree',
                    ],
                ],
                'edges' => [
                    '*' => ['id', 'from', 'to', 'strength', 'laterality', 'laterality_score'],
                ],
                'meta' => $meta,
            ],
            'status',
        ];
    }

    private function makeConcept(string $canonical, string $term, string $mediaUrl): Concept
    {
        $concept = Concept::query()->create(['canonical_key' => $canonical]);

        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => 'en',
            'term' => $term,
            'normalized_term' => ConceptTerm::normalizeTerm($term),
            'short_description' => $term.' desc',
            'complexity' => 2,
            'is_preferred' => true,
            'media_url' => $mediaUrl,
        ]);

        ConceptMedia::query()->create([
            'concept_id' => $concept->id,
            'url' => $mediaUrl,
            'kind' => 'image',
            'license' => 'CC0',
            'source' => 'wikimedia',
            'position' => 0,
        ]);

        return $concept;
    }
}
