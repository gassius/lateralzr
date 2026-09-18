<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RemoteMediaProxyApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    public function test_requires_url(): void
    {
        $this->get('/api/media')->assertStatus(422);
    }

    public function test_rejects_disallowed_host(): void
    {
        $this->get('/api/media?url='.urlencode('https://example.com/photo.jpg'))
            ->assertStatus(422)
            ->assertJsonPath('status', 'error');
    }

    public function test_proxies_wikimedia_image(): void
    {
        $url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg';
        Http::fake([
            $url => Http::response('fake-jpeg-bytes', 200, ['Content-Type' => 'image/jpeg']),
        ]);

        $response = $this->withHeaders(['Origin' => 'http://localhost:8081'])
            ->get('/api/media?url='.urlencode($url));

        $response->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Access-Control-Allow-Origin');

        $this->assertSame('fake-jpeg-bytes', $response->getContent());
        $this->assertStringContainsString('max-age=', (string) $response->headers->get('Cache-Control'));
    }

    public function test_maps_upstream_errors(): void
    {
        $url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg';
        Http::fake([
            $url => Http::response('missing', 404, ['Content-Type' => 'text/html']),
        ]);

        $this->get('/api/media?url='.urlencode($url))
            ->assertStatus(502)
            ->assertJson(['status' => 'error']);
    }
}
