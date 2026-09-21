<?php

namespace Tests\Feature;

use App\Services\ConceptGraphQuery;
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

    public function test_generate_endpoint_returns_success_with_valid_seed(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')->once()->andReturn([
            'start' => ['id' => 1, 'label' => 'creativity'],
            'nodes' => [
                ['id' => 1, 'label' => 'creativity', 'shortDescription' => 'The use of imagination or original ideas to create something', 'complexity' => 1, 'wikiUrl' => 'https://en.wikipedia.org/wiki/Creativity', 'mediaUrl' => null, 'degree' => 1],
                ['id' => 2, 'label' => 'constraint', 'shortDescription' => 'A limitation or restriction.', 'complexity' => 1, 'wikiUrl' => 'https://en.wikipedia.org/wiki/Constraint', 'mediaUrl' => null, 'degree' => 1],
            ],
            'edges' => [
                ['id' => 10, 'from' => 1, 'to' => 2, 'strength' => 0.72, 'laterality' => 3],
            ],
            'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
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
                            'degree',
                        ],
                    ],
                    'edges' => [
                        '*' => ['id', 'from', 'to', 'strength', 'laterality'],
                    ],
                    'meta',
                ],
                'status',
            ])
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'start' => ['label' => 'creativity'],
                ],
            ]);
    }

    public function test_generate_endpoint_accepts_limit_parameter(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')->once()->andReturn([
            'start' => ['id' => 1, 'label' => 'innovation'],
            'nodes' => [['id' => 1, 'label' => 'innovation', 'shortDescription' => 'The introduction of something new', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'degree' => 0]],
            'edges' => [],
            'meta' => ['depth' => 2, 'limit' => 5, 'minStrength' => 0.0, 'hasMore' => false],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'innovation',
            'limit' => 5,
        ]);

        $response->assertStatus(200);
    }

    public function test_generate_endpoint_accepts_empty_body_and_uses_random_seed(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')->once()->andReturn([
            'start' => ['id' => 1, 'label' => 'creativity'],
            'nodes' => [['id' => 1, 'label' => 'creativity', 'shortDescription' => 'Cold start', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'degree' => 0]],
            'edges' => [],
            'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', []);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success'])
            ->assertJsonStructure(['data' => ['start' => ['label'], 'nodes', 'edges']]);
    }

    public function test_generate_endpoint_validates_seed_is_string(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 123,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['start']);
    }

    public function test_generate_endpoint_treats_whitespace_only_seed_as_cold_start(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')->once()->andReturn([
            'start' => ['id' => 1, 'label' => 'innovation'],
            'nodes' => [['id' => 1, 'label' => 'innovation', 'shortDescription' => 'Cold start', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'degree' => 0]],
            'edges' => [],
            'meta' => ['depth' => 2, 'limit' => 100, 'minStrength' => 0.0, 'hasMore' => false],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'start' => '   ',  // only whitespace -> normalized to null (cold start)
        ]);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);
    }

    public function test_generate_endpoint_validates_limit_range(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'test',
            'limit' => 501,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['limit']);
    }

    public function test_generate_endpoint_validates_depth_range(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'test',
            'depth' => 6,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['depth']);
    }

    public function test_generate_endpoint_passes_graph_options_to_db_query(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with('creativity', 40, 3, 0.2, 'en', null, false)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creativity'],
                'nodes' => [['id' => 1, 'label' => 'creativity', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'degree' => 0]],
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

    public function test_generate_endpoint_accepts_locale_and_defaults_to_en(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with('creativity', 100, 2, 0.0, 'es', null, false)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creatividad'],
                'nodes' => [['id' => 1, 'label' => 'creatividad', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'degree' => 0]],
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

    public function test_generate_endpoint_rejects_unsupported_locale(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'start' => 'creativity',
            'locale' => 'fr',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['locale']);
    }

    public function test_generate_endpoint_returns_404_when_not_prefetched(): void
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

    public function test_generate_endpoint_passes_canonical_start_and_only_with_media(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with(null, 100, 2, 0.0, 'es', 'creativity', true)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creatividad'],
                'nodes' => [['id' => 1, 'label' => 'creatividad', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => 'https://example.com/c.jpg', 'degree' => 0]],
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

    public function test_generate_endpoint_accepts_localized_concept_alias(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getGraph')
            ->once()
            ->with('creatividad', 100, 2, 0.0, 'es', null, false)
            ->andReturn([
                'start' => ['id' => 1, 'label' => 'creatividad'],
                'nodes' => [['id' => 1, 'label' => 'creatividad', 'shortDescription' => 'Desc', 'complexity' => 1, 'wikiUrl' => null, 'mediaUrl' => null, 'degree' => 0]],
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
}
