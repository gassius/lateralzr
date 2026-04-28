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
            'start' => 'Cleopatra',
            'limit' => 20,
            'depth' => 2,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
            ])
            ->assertJsonStructure([
                'data' => [
                    'start' => [
                        'id',
                        'label',
                    ],
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
                        '*' => [
                            'id',
                            'from',
                            'to',
                            'strength',
                            'laterality',
                        ],
                    ],
                    'meta' => [
                        'depth',
                        'limit',
                        'minStrength',
                        'hasMore',
                    ],
                ],
                'status',
            ]);

        $data = $response->json('data');

        $this->assertIsArray($data['start']);
        $this->assertArrayHasKey('id', $data['start']);
        $this->assertArrayHasKey('label', $data['start']);

        $this->assertIsArray($data['nodes']);
        $this->assertIsArray($data['edges']);

        if (count($data['edges']) === 0) {
            $this->fail('No graph edges returned. Full response: '.json_encode($data, JSON_PRETTY_PRINT));
        }

        $this->assertGreaterThan(0, count($data['nodes']));
        $this->assertGreaterThan(0, count($data['edges']));

        $firstNode = $data['nodes'][0];
        $this->assertArrayHasKey('label', $firstNode);
        $this->assertArrayHasKey('shortDescription', $firstNode);
        $this->assertArrayHasKey('wikiUrl', $firstNode);
        $this->assertArrayHasKey('mediaUrl', $firstNode);
    }
}
