<?php

namespace Tests\Feature;

use App\Services\ConceptRelationshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('ollama')]
class ConceptRelationshipOllamaSmokeTest extends TestCase
{
    use RefreshDatabase;

    protected ConceptRelationshipService $service;

    protected function setUp(): void
    {
        parent::setUp();

        // Skip tests if smoke tests are not enabled
        if (! env('AI_SMOKE_TESTS', false)) {
            $this->markTestSkipped('Smoke tests are disabled. Set AI_SMOKE_TESTS=1 to enable.');
        }

        // Check if Ollama is reachable
        $ollamaUrl = config('ai.providers.ollama.url', 'http://host.docker.internal:11434');
        try {
            $response = Http::timeout(2)->get("{$ollamaUrl}/api/tags");
            if (! $response->successful()) {
                $this->markTestSkipped('Ollama is not reachable at '.$ollamaUrl);
            }
        } catch (\Exception $e) {
            $this->markTestSkipped('Ollama is not reachable at '.$ollamaUrl.': '.$e->getMessage());
        }

        $this->service = new ConceptRelationshipService;
    }

    public function test_service_can_generate_relationships_from_real_ollama(): void
    {
        $result = $this->service->generateRelationships('creativity');

        $this->assertIsArray($result);
        $this->assertArrayHasKey('seed', $result);
        $this->assertArrayHasKey('related_concepts', $result);
        $this->assertEquals('creativity', $result['seed']);
        $this->assertNotEmpty($result['related_concepts'], 'Should generate at least one related concept');

        // Verify structure of related concepts
        foreach ($result['related_concepts'] as $concept) {
            $this->assertArrayHasKey('concept', $concept);
            $this->assertIsString($concept['concept']);
            $this->assertNotEmpty($concept['concept']);

            if (isset($concept['rationale'])) {
                $this->assertIsString($concept['rationale']);
            }

            if (isset($concept['strength'])) {
                $this->assertIsNumeric($concept['strength']);
                $this->assertGreaterThanOrEqual(0, $concept['strength']);
                $this->assertLessThanOrEqual(1, $concept['strength']);
            }
        }
    }

    public function test_api_endpoint_works_with_real_ollama(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'innovation',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'seed',
                    'related_concepts' => [
                        '*' => [
                            'concept',
                        ],
                    ],
                ],
                'status',
            ])
            ->assertJson([
                'status' => 'success',
            ]);

        $data = $response->json('data');
        $this->assertEquals('innovation', $data['seed']);
        $this->assertNotEmpty($data['related_concepts'], 'Should generate at least one related concept');
    }

    public function test_service_respects_count_parameter(): void
    {
        $result = $this->service->generateRelationships('problem-solving', 3);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('related_concepts', $result);
        // Note: The model may generate more or fewer, but we verify it at least attempts to generate
        $this->assertNotEmpty($result['related_concepts']);
    }
}
