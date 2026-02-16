<?php

namespace Tests\Feature;

use App\Ai\Tools\WikipediaSearchTool;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Tools\Request;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('smoke')]
class WikipediaSearchToolSmokeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Skip tests if smoke tests are not enabled
        if (! env('AI_SMOKE_TESTS', false)) {
            $this->markTestSkipped('Smoke tests are disabled. Set AI_SMOKE_TESTS=1 to enable.');
        }

        // Check if Wikipedia API is reachable
        try {
            $response = Http::timeout(10)
                ->withoutVerifying() // Skip SSL verification in Docker if needed
                ->withHeaders([
                    'User-Agent' => 'Lateralzr-API-Test/1.0',
                ])
                ->get('https://en.wikipedia.org/api/rest_v1/page/summary/Sonar');
            if (! $response->successful()) {
                $this->markTestSkipped('Wikipedia API returned non-success status: '.$response->status());
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            $this->markTestSkipped('Wikipedia API connection failed: '.$e->getMessage());
        } catch (\Exception $e) {
            $this->markTestSkipped('Wikipedia API error: '.get_class($e).' - '.$e->getMessage());
        }
    }

    public function test_wikipedia_tool_returns_url_for_known_concept(): void
    {
        $tool = new WikipediaSearchTool();
        $request = new Request(['concept' => 'sonar']);

        $result = $tool->handle($request);

        $this->assertNotEmpty($result);
        $this->assertIsString($result);
        $this->assertStringContainsString('wikipedia.org', $result);
        $this->assertStringContainsString('wiki', $result);
    }

    public function test_wikipedia_tool_handles_invalid_concept_gracefully(): void
    {
        $tool = new WikipediaSearchTool();
        $request = new Request(['concept' => 'nonexistentconcept12345xyz']);

        $result = $tool->handle($request);

        // Should return a URL (fallback) or empty string, but not throw exception
        $this->assertIsString($result);
    }
}
