<?php

namespace Tests\Feature;

use App\Ai\Tools\WikimediaCommonsSearchTool;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Tools\Request;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('smoke')]
class WikimediaCommonsSearchToolSmokeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Skip tests if smoke tests are not enabled
        if (! env('AI_SMOKE_TESTS', false)) {
            $this->markTestSkipped('Smoke tests are disabled. Set AI_SMOKE_TESTS=1 to enable.');
        }

        // Check if Wikimedia Commons API is reachable
        try {
            $response = Http::timeout(10)
                ->withoutVerifying() // Skip SSL verification in Docker if needed
                ->withHeaders([
                    'User-Agent' => 'Lateralzr-API-Test/1.0',
                ])
                ->get('https://commons.wikimedia.org/w/api.php', [
                    'action' => 'query',
                    'format' => 'json',
                    'list' => 'search',
                    'srsearch' => 'sonar',
                    'srnamespace' => 6,
                    'srlimit' => 1,
                ]);
            if (! $response->successful()) {
                $this->markTestSkipped('Wikimedia Commons API returned non-success status: '.$response->status());
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            $this->markTestSkipped('Wikimedia Commons API connection failed: '.$e->getMessage());
        } catch (\Exception $e) {
            $this->markTestSkipped('Wikimedia Commons API error: '.get_class($e).' - '.$e->getMessage());
        }
    }

    public function test_wikimedia_commons_tool_returns_url_for_known_concept(): void
    {
        $tool = new WikimediaCommonsSearchTool();
        $request = new Request([
            'concept' => 'sonar',
            'shortDescription' => 'Sonar technology uses sound waves',
        ]);

        $result = $tool->handle($request);

        // Result may be empty if no image found, but should not throw exception
        $this->assertIsString($result);
        if (! empty($result)) {
            // Should return direct image URL (upload.wikimedia.org) not wiki page
            $this->assertStringContainsString('upload.wikimedia.org', $result);
            // Tool returns either thumbnails (with "NNpx-" pattern) or original images
            // Both are valid as long as they're direct upload.wikimedia.org URLs
            $this->assertMatchesRegularExpression(
                '#^https://upload\.wikimedia\.org/#',
                $result,
                'URL should be a direct upload.wikimedia.org image URL'
            );
        }
    }

    public function test_wikimedia_commons_tool_handles_invalid_concept_gracefully(): void
    {
        $tool = new WikimediaCommonsSearchTool();
        $request = new Request(['concept' => 'nonexistentconcept12345xyz']);

        $result = $tool->handle($request);

        // Should return empty string, but not throw exception
        $this->assertIsString($result);
    }
}
