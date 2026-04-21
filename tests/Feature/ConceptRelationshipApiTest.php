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
        $mockQuery->shouldReceive('getFromDb')->once()->andReturn([
            'complexity' => 2,
            'seed' => [
                'concept' => 'creativity',
                'shortDescription' => 'The use of imagination or original ideas to create something',
                'wikiUrl' => 'https://en.wikipedia.org/wiki/Creativity',
                'mediaUrl' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg',
            ],
            'related_concepts' => [
                [
                    'concept' => 'constraint',
                    'shortDescription' => 'Limitations that can spark creative solutions',
                    'larelality' => 3,
                    'wikiUrl' => 'https://en.wikipedia.org/wiki/Constraint',
                    'mediaUrl' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constraint.jpg/960px-Constraint.jpg',
                ],
            ],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'creativity',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'complexity',
                    'seed' => [
                        'concept',
                        'shortDescription',
                        'wikiUrl',
                        'mediaUrl',
                    ],
                    'related_concepts' => [
                        '*' => [
                            'concept',
                            'shortDescription',
                            'larelality',
                            'wikiUrl',
                            'mediaUrl',
                        ],
                    ],
                ],
                'status',
            ])
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'seed' => [
                        'concept' => 'creativity',
                    ],
                ],
            ]);
    }

    public function test_generate_endpoint_accepts_count_parameter(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getFromDb')->once()->andReturn([
            'complexity' => 2,
            'seed' => [
                'concept' => 'innovation',
                'shortDescription' => 'The introduction of something new',
                'wikiUrl' => null,
                'mediaUrl' => null,
            ],
            'related_concepts' => [],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'innovation',
            'count' => 5,
        ]);

        $response->assertStatus(200);
    }

    public function test_generate_endpoint_accepts_empty_body_and_uses_random_seed(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getFromDb')->once()->andReturn([
            'complexity' => 2,
            'seed' => [
                'concept' => 'creativity',
                'shortDescription' => 'Cold start seed',
                'wikiUrl' => null,
                'mediaUrl' => null,
            ],
            'related_concepts' => [],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', []);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success'])
            ->assertJsonStructure(['data' => ['seed' => ['concept'], 'related_concepts']]);
    }

    public function test_generate_endpoint_validates_seed_is_string(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 123,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['seed']);
    }

    public function test_generate_endpoint_treats_whitespace_only_seed_as_cold_start(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getFromDb')->once()->andReturn([
            'complexity' => 2,
            'seed' => [
                'concept' => 'innovation',
                'shortDescription' => 'Cold start',
                'wikiUrl' => null,
                'mediaUrl' => null,
            ],
            'related_concepts' => [],
        ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => '   ',  // only whitespace → normalized to null (cold start)
        ]);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);
    }

    public function test_generate_endpoint_validates_count_range(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'test',
            'count' => 15, // Exceeds max of 10
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['count']);
    }

    public function test_generate_endpoint_validates_complexity_range(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'test',
            'complexity' => 6,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['complexity']);
    }

    public function test_generate_endpoint_passes_complexity_to_db_query(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getFromDb')
            ->once()
            ->with('creativity', null, 4)
            ->andReturn([
                'complexity' => 4,
                'seed' => [
                    'concept' => 'creativity',
                    'shortDescription' => 'Desc',
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
                'related_concepts' => [],
            ]);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'creativity',
            'complexity' => 4,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.complexity', 4);
    }

    public function test_generate_endpoint_returns_404_when_not_prefetched(): void
    {
        $mockQuery = Mockery::mock(ConceptGraphQuery::class);
        $mockQuery->shouldReceive('getFromDb')->once()->andReturn(null);
        $this->app->instance(ConceptGraphQuery::class, $mockQuery);

        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'test',
        ]);

        $response->assertStatus(404)
            ->assertJson([
                'status' => 'error',
            ]);
    }
}
