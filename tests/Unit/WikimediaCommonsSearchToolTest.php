<?php

namespace Tests\Unit;

use App\Ai\Tools\WikimediaCommonsSearchTool;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WikimediaCommonsSearchToolTest extends TestCase
{
    private const TEST_USER_AGENT = 'Lateralzr-Test-Agent/1.0';

    protected function setUp(): void
    {
        parent::setUp();
        config(['media.user_agent' => self::TEST_USER_AGENT]);
    }

    public function test_lookup_uses_configured_user_agent(): void
    {
        Http::fake([
            'commons.wikimedia.org/*' => Http::response([
                'query' => ['search' => []],
            ], 200),
        ]);

        $this->assertSame('', (new WikimediaCommonsSearchTool)->lookup('silence'));

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'commons.wikimedia.org')
                && $request->hasHeader('User-Agent', self::TEST_USER_AGENT);
        });
    }
}
