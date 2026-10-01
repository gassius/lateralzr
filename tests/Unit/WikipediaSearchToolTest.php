<?php

namespace Tests\Unit;

use App\Ai\Tools\WikipediaSearchTool;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WikipediaSearchToolTest extends TestCase
{
    private const TEST_USER_AGENT = 'Lateralzr-Test-Agent/1.0';

    protected function setUp(): void
    {
        parent::setUp();
        config(['media.user_agent' => self::TEST_USER_AGENT]);
    }

    public function test_lookup_uses_configured_user_agent_and_a_single_normalized_title(): void
    {
        Http::fake([
            'en.wikipedia.org/api/rest_v1/page/summary/*' => Http::response([
                'type' => 'standard',
                'content_urls' => [
                    'desktop' => ['page' => 'https://en.wikipedia.org/wiki/Foo_Bar'],
                ],
            ], 200),
        ]);

        $url = (new WikipediaSearchTool)->lookup(' Foo Bar ');

        $this->assertNotSame('', $url);
        $this->assertStringContainsString('Foo_Bar', $url);

        Http::assertSentCount(1);
        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/page/summary/Foo_Bar')
                && ! str_contains($request->url(), '_Foo_Bar_')
                && $request->hasHeader('User-Agent', self::TEST_USER_AGENT);
        });
    }

    public function test_disambiguation_search_reuses_fetch_summary(): void
    {
        Http::fake([
            'en.wikipedia.org/api/rest_v1/page/summary/Mercury' => Http::response([
                'type' => 'disambiguation',
            ], 200),
            'en.wikipedia.org/w/api.php*' => Http::response([
                'query' => [
                    'search' => [
                        ['title' => 'Mercury (element)'],
                    ],
                ],
            ], 200),
            'en.wikipedia.org/api/rest_v1/page/summary/Mercury%20%28element%29' => Http::response([
                'type' => 'standard',
                'content_urls' => [
                    'desktop' => ['page' => 'https://en.wikipedia.org/wiki/Mercury_(element)'],
                ],
            ], 200),
        ]);

        $url = (new WikipediaSearchTool)->lookup('Mercury', 'chemical element');

        $this->assertStringContainsString('Mercury', $url);
        Http::assertSent(fn ($request) => str_contains($request->url(), '/w/api.php'));
        Http::assertSent(fn ($request) => str_contains($request->url(), 'Mercury%20%28element%29')
            && $request->hasHeader('User-Agent', self::TEST_USER_AGENT));
    }
}
