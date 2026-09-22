<?php

namespace App\Services\Enrichment;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class WikimediaClient
{
    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>|null
     */
    public function get(string $host, array $query): ?array
    {
        $host = strtolower(trim($host));
        if (! preg_match('/^(?:[a-z]{2,3}\.wikipedia\.org|commons\.wikimedia\.org)$/', $host)) {
            return null;
        }

        try {
            $response = Http::timeout(12)
                ->withoutVerifying()
                ->withHeaders([
                    'User-Agent' => (string) config('media.user_agent'),
                    'Accept' => 'application/json',
                ])
                ->get("https://{$host}/w/api.php", $query + [
                    'format' => 'json',
                ]);

            if (! $response->successful()) {
                Log::debug('WikimediaClient: non-success response', [
                    'host' => $host,
                    'status' => $response->status(),
                ]);

                return null;
            }

            $json = $response->json();

            return is_array($json) ? $json : null;
        } catch (\Throwable $e) {
            Log::warning('WikimediaClient: request failed', [
                'host' => $host,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
