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
                'seed' => 'creativity',
                'related_concepts' => [
                    [
                        'concept' => 'constraint',
                        'rationale' => 'Limitations can spark creative solutions',
                        'strength' => 0.8,
                    ],
                    [
                        'concept' => 'chaos',
                        'rationale' => 'Disorder can lead to unexpected patterns',
                        'strength' => 0.7,
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
                    'seed',
                    'related_concepts' => [
                        '*' => [
                            'concept',
                            'rationale',
                            'strength',
                        ],
                    ],
                ],
                'status',
            ])
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'seed' => 'creativity',
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
                'seed' => 'innovation',
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
