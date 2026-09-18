<?php

namespace Tests\Unit;

use App\Services\RemoteMediaProxy;
use App\Services\RemoteMediaProxyException;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use Tests\TestCase;

class RemoteMediaProxyTest extends TestCase
{
    private RemoteMediaProxy $proxy;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        $this->proxy = new RemoteMediaProxy;
    }

    public function test_rejects_non_https_urls(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->proxy->assertAllowedUrl('http://upload.wikimedia.org/wikipedia/commons/a.jpg');
    }

    public function test_rejects_disallowed_hosts(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->proxy->assertAllowedUrl('https://example.com/photo.jpg');
    }

    public function test_rejects_loopback_hosts(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->proxy->assertAllowedUrl('https://127.0.0.1/secret.jpg');
    }

    public function test_rejects_urls_with_credentials(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->proxy->assertAllowedUrl('https://user:pass@upload.wikimedia.org/wikipedia/commons/a.jpg');
    }

    public function test_rejects_svg_paths(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->proxy->assertAllowedUrl('https://upload.wikimedia.org/wikipedia/commons/a.svg');
    }

    public function test_allows_wikimedia_jpeg_thumbs(): void
    {
        $this->proxy->assertAllowedUrl(
            'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg'
        );
        $this->addToAssertionCount(1);
    }

    public function test_fetch_returns_image_bytes(): void
    {
        $url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg';
        Http::fake([
            $url => Http::response('fake-jpeg-bytes', 200, ['Content-Type' => 'image/jpeg']),
        ]);

        $media = $this->proxy->fetch($url);

        $this->assertSame('fake-jpeg-bytes', $media['body']);
        $this->assertSame('image/jpeg', $media['contentType']);
        Http::assertSent(function ($request) use ($url) {
            return $request->url() === $url
                && $request->hasHeader('User-Agent');
        });
    }

    public function test_fetch_rejects_html_content_type(): void
    {
        $url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg';
        Http::fake([
            $url => Http::response('<html>nope</html>', 200, ['Content-Type' => 'text/html']),
        ]);

        $this->expectException(InvalidArgumentException::class);
        $this->proxy->fetch($url);
    }

    public function test_fetch_maps_upstream_failure(): void
    {
        $url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg';
        Http::fake([
            $url => Http::response('missing', 404, ['Content-Type' => 'text/html']),
        ]);

        try {
            $this->proxy->fetch($url);
            $this->fail('Expected RemoteMediaProxyException');
        } catch (RemoteMediaProxyException $e) {
            $this->assertSame(502, $e->status);
        }
    }

    public function test_fetch_does_not_follow_redirects(): void
    {
        $url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg';
        Http::fake([
            $url => Http::response('', 302, ['Location' => 'https://evil.example/payload.jpg']),
        ]);

        try {
            $this->proxy->fetch($url);
            $this->fail('Expected RemoteMediaProxyException');
        } catch (RemoteMediaProxyException $e) {
            $this->assertSame(502, $e->status);
        }
    }

    public function test_fetch_rejects_oversized_payload(): void
    {
        config(['media.max_bytes' => 8]);
        $url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg';
        Http::fake([
            $url => Http::response('0123456789', 200, ['Content-Type' => 'image/jpeg']),
        ]);

        try {
            $this->proxy->fetch($url);
            $this->fail('Expected RemoteMediaProxyException');
        } catch (RemoteMediaProxyException $e) {
            $this->assertSame(413, $e->status);
        }
    }
}
