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
            ]);
    }
}
