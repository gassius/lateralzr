<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('ollama')]
class ConceptRelationshipOllamaSmokeTest extends TestCase
{
    use RefreshDatabase;

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
    }

    public function test_api_endpoint_returns_success_response(): void
    {
        $response = $this->postJson('/api/concepts/relationships', [
            'seed' => 'innovation',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
            ])
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
            ]);

        $data = $response->json('data');

        // Check seed structure
        $this->assertIsArray($data['seed']);
        $this->assertArrayHasKey('concept', $data['seed']);
        $this->assertArrayHasKey('shortDescription', $data['seed']);
        $this->assertArrayHasKey('wikiUrl', $data['seed']);
        $this->assertArrayHasKey('mediaUrl', $data['seed']);

        $this->assertIsArray($data['related_concepts']);

        // If no concepts returned, log the full response for debugging
        if (count($data['related_concepts']) === 0) {
            $this->fail('No concepts returned. Full response: '.json_encode($data, JSON_PRETTY_PRINT));
        }

        $this->assertGreaterThan(0, count($data['related_concepts']));

        // Check that at least one concept has the expected structure
        $firstConcept = $data['related_concepts'][0];
        $this->assertArrayHasKey('concept', $firstConcept);
        $this->assertArrayHasKey('shortDescription', $firstConcept);
        $this->assertArrayHasKey('larelality', $firstConcept);
        $this->assertArrayHasKey('wikiUrl', $firstConcept);
        $this->assertArrayHasKey('mediaUrl', $firstConcept);
        // URLs may be null if tools fail, but keys should exist
    }
}
