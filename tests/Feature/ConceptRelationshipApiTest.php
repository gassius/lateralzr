<?php

namespace Tests\Feature;

use App\Services\ConceptRelationshipService;
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
        // Mock the service
        $mockService = Mockery::mock(ConceptRelationshipService::class);
        $mockService->shouldReceive('generateRelationships')
            ->once()
            ->with('creativity', null)
            ->andReturn([
                'seed' => [
                    'concept' => 'creativity',
                    'shortDescription' => 'The use of imagination or original ideas to create something',
                    'wikiUrl' => 'https://en.wikipedia.org/wiki/Creativity',
                    'mediaUrl' => 'https://commons.wikimedia.org/wiki/File:Creativity.jpg',
                ],
                'related_concepts' => [
                    [
                        'concept' => 'constraint',
                        'shortDescription' => 'Limitations that can spark creative solutions',
                        'larelality' => 3,
                        'wikiUrl' => 'https://en.wikipedia.org/wiki/Constraint',
                        'mediaUrl' => 'https://commons.wikimedia.org/wiki/File:Constraint.jpg',
                    ],
                    [
                        'concept' => 'chaos',
                        'shortDescription' => 'Disorder that can lead to unexpected patterns',
                        'larelality' => 4,
                        'wikiUrl' => 'https://en.wikipedia.org/wiki/Chaos',
                        'mediaUrl' => null,
                    ],
                ],
            ]);

        $this->app->instance(ConceptRelationshipService::class, $mockService);

        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'creativity',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
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
        $mockService = Mockery::mock(ConceptRelationshipService::class);
        $mockService->shouldReceive('generateRelationships')
            ->once()
            ->with('innovation', 5)
            ->andReturn([
                'seed' => [
                    'concept' => 'innovation',
                    'shortDescription' => 'The introduction of something new',
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ],
                'related_concepts' => [],
            ]);

        $this->app->instance(ConceptRelationshipService::class, $mockService);

        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'innovation',
            'count' => 5,
        ]);

        $response->assertStatus(200);
    }

    public function test_generate_endpoint_validates_seed_required(): void
    {
        $response = $this->postJson('/api/concepts/relationships', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['seed']);
    }

    public function test_generate_endpoint_validates_seed_is_string(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 123,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['seed']);
    }

    public function test_generate_endpoint_validates_seed_min_length(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => '',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['seed']);
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

    public function test_generate_endpoint_handles_service_exception(): void
    {
        $mockService = Mockery::mock(ConceptRelationshipService::class);
        $mockService->shouldReceive('generateRelationships')
            ->once()
            ->andThrow(new \Exception('LLM service unavailable'));

        $this->app->instance(ConceptRelationshipService::class, $mockService);

        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'test',
        ]);

        $response->assertStatus(500)
            ->assertJson([
                'status' => 'error',
            ])
            ->assertJsonStructure([
                'message',
            ]);
    }
}
