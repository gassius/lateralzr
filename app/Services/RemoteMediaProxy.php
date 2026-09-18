<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use InvalidArgumentException;

class RemoteMediaProxy
{
    /**
     * Fetch an allowlisted remote image for the web client.
     *
     * @return array{body: string, contentType: string}
     */
    public function fetch(string $url): array
    {
        $this->assertAllowedUrl($url);

        $timeout = (int) config('media.timeout', 10);
        $maxBytes = (int) config('media.max_bytes', 5_000_000);
        $userAgent = (string) config('media.user_agent');

        $response = Http::timeout($timeout)
            ->withHeaders([
                'User-Agent' => $userAgent,
                'Accept' => 'image/jpeg,image/png,image/webp,image/gif,image/avif',
            ])
            ->withOptions([
                'allow_redirects' => false,
            ])
            ->get($url);

        if (! $response->successful()) {
            throw new RemoteMediaProxyException('Upstream image request failed.', 502);
        }

        $contentTypeHeader = (string) $response->header('Content-Type');
        $contentType = strtolower(trim(explode(';', $contentTypeHeader)[0]));
        $allowedTypes = config('media.allowed_content_types', []);

        if ($contentType === '' || ! in_array($contentType, $allowedTypes, true)) {
            throw new InvalidArgumentException('Upstream response is not an allowed image type.');
        }

        $body = $response->body();
        if ($body === '') {
            throw new RemoteMediaProxyException('Upstream image was empty.', 502);
        }

        if (strlen($body) > $maxBytes) {
            throw new RemoteMediaProxyException('Image exceeds size limit.', 413);
        }

        return [
            'body' => $body,
            'contentType' => $contentType,
        ];
    }

    public function assertAllowedUrl(string $url): void
    {
        if ($url === '' || strlen($url) > 2048) {
            throw new InvalidArgumentException('Image URL is invalid.');
        }

        $parts = parse_url($url);
        if ($parts === false || ! isset($parts['scheme'], $parts['host'])) {
            throw new InvalidArgumentException('Image URL is invalid.');
        }

        if (strtolower($parts['scheme']) !== 'https') {
            throw new InvalidArgumentException('Image URL must use HTTPS.');
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException('Image URL must not include credentials.');
        }

        if (isset($parts['port']) && (int) $parts['port'] !== 443) {
            throw new InvalidArgumentException('Image URL must use the default HTTPS port.');
        }

        $host = strtolower(rtrim($parts['host'], '.'));
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            throw new InvalidArgumentException('Image host is not allowed.');
        }

        $allowedHosts = array_map('strtolower', config('media.allowed_hosts', []));
        if (! in_array($host, $allowedHosts, true)) {
            throw new InvalidArgumentException('Image host is not allowed.');
        }

        $path = $parts['path'] ?? '';
        if ($path === '' || str_contains($path, '..')) {
            throw new InvalidArgumentException('Image URL path is invalid.');
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $allowedExtensions = config('media.allowed_extensions', []);
        if ($extension === '' || ! in_array($extension, $allowedExtensions, true)) {
            throw new InvalidArgumentException('Image URL must point to an image file.');
        }
    }
}
