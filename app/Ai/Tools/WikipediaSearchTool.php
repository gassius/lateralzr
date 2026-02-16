<?php

namespace App\Ai\Tools;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class WikipediaSearchTool implements Tool
{
    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Search for a Wikipedia page URL for a given concept. Returns the Wikipedia article URL if found.';
    }

    /**
     * Execute the tool.
     */
    public function handle(Request $request): Stringable|string
    {
        $concept = $request['concept'] ?? '';
        $shortDescription = $request['shortDescription'] ?? '';

        if (empty($concept)) {
            Log::channel('single')->debug('WikipediaSearchTool: Empty concept provided');
            return '';
        }

        Log::channel('single')->debug('WikipediaSearchTool: Searching for concept', ['concept' => $concept]);

        try {
            // Normalize concept name: capitalize first letter of each word, replace spaces with underscores
            $normalizedConcept = $this->normalizeConceptName($concept);

            // Try to fetch page summary from Wikipedia API
            $response = Http::timeout(10)
                ->withoutVerifying() // Skip SSL verification in Docker if needed
                ->withHeaders([
                    'User-Agent' => 'Lateralzr-API/1.0 (https://github.com/yourusername/lateralzr-api; contact@example.com)',
                ])
                ->get("https://en.wikipedia.org/api/rest_v1/page/summary/{$normalizedConcept}");

            if ($response->successful()) {
                $data = $response->json();
                $pageType = $data['type'] ?? 'standard';

                // Skip disambiguation pages - try to find a more specific article using shortDescription
                if ($pageType === 'disambiguation' && ! empty($shortDescription)) {
                    $specificUrl = $this->searchForSpecificPage($concept, $shortDescription);
                    if ($specificUrl !== '') {
                        return $this->ensureEncodedUrl($specificUrl);
                    }
                    // No specific page found - don't return disambiguation page
                    Log::channel('single')->debug('WikipediaSearchTool: Disambiguation page, no specific match found', [
                        'concept' => $concept,
                    ]);
                    return '';
                }

                if ($pageType === 'disambiguation') {
                    Log::channel('single')->debug('WikipediaSearchTool: Disambiguation page skipped (no shortDescription)', [
                        'concept' => $concept,
                    ]);
                    return '';
                }

                $url = $data['content_urls']['desktop']['page'] ?? null;

                if ($url) {
                    Log::channel('single')->debug('WikipediaSearchTool: Found URL', [
                        'concept' => $concept,
                        'url' => $url,
                    ]);

                    return $this->ensureEncodedUrl($url);
                }
            }

            // If direct lookup failed, try with spaces replaced by underscores
            $underscoredConcept = str_replace(' ', '_', ucwords(strtolower($concept)));
            if ($underscoredConcept !== $normalizedConcept) {
                $response = Http::timeout(10)
                    ->withoutVerifying() // Skip SSL verification in Docker if needed
                    ->withHeaders([
                        'User-Agent' => 'Lateralzr-API/1.0 (https://github.com/yourusername/lateralzr-api; contact@example.com)',
                    ])
                    ->get("https://en.wikipedia.org/api/rest_v1/page/summary/{$underscoredConcept}");

                if ($response->successful()) {
                    $data = $response->json();
                    $pageType = $data['type'] ?? 'standard';

                    if ($pageType === 'disambiguation' && ! empty($shortDescription)) {
                        $specificUrl = $this->searchForSpecificPage($concept, $shortDescription);
                        if ($specificUrl !== '') {
                            return $this->ensureEncodedUrl($specificUrl);
                        }
                        return '';
                    }

                    if ($pageType === 'disambiguation') {
                        return '';
                    }

                    $url = $data['content_urls']['desktop']['page'] ?? null;

                    if ($url) {
                        Log::channel('single')->debug('WikipediaSearchTool: Found URL (with underscores)', [
                            'concept' => $concept,
                            'url' => $url,
                        ]);
                        return $this->ensureEncodedUrl($url);
                    }
                }
            }

            // No page found - return empty string
            Log::channel('single')->debug('WikipediaSearchTool: No page found', [
                'concept' => $concept,
            ]);
            return '';
        } catch (\Exception $e) {
            Log::channel('single')->warning('WikipediaSearchTool: Error searching for concept', [
                'concept' => $concept,
                'error' => $e->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * Search Wikipedia for a more specific page using concept + shortDescription keywords.
     */
    protected function searchForSpecificPage(string $concept, string $shortDescription): string
    {
        // Build search query: concept plus first meaningful words from shortDescription (avoid common words)
        $stopWords = ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'that', 'this', 'it', 'as', 'be', 'by', 'or', 'and'];
        $words = array_slice(preg_split('/\s+/', trim($shortDescription), -1, PREG_SPLIT_NO_EMPTY), 0, 5);
        $keywords = array_filter($words, fn ($w) => strlen($w) > 2 && ! in_array(strtolower($w), $stopWords, true));
        $searchQuery = $concept . ' ' . implode(' ', array_slice($keywords, 0, 3));

        $response = Http::timeout(10)
            ->withoutVerifying()
            ->withHeaders([
                'User-Agent' => 'Lateralzr-API/1.0 (https://github.com/yourusername/lateralzr-api; contact@example.com)',
            ])
            ->get('https://en.wikipedia.org/w/api.php', [
                'action' => 'query',
                'format' => 'json',
                'list' => 'search',
                'srsearch' => $searchQuery,
                'srlimit' => 3,
                'srprop' => 'title',
            ]);

        if (! $response->successful()) {
            return '';
        }

        $data = $response->json();
        $results = $data['query']['search'] ?? [];

        foreach ($results as $hit) {
            $title = $hit['title'] ?? '';
            if ($title === '') {
                continue;
            }
            // Fetch summary to confirm it's not another disambiguation page
            $encodedTitle = rawurlencode($title);
            $summaryResponse = Http::timeout(10)
                ->withoutVerifying()
                ->withHeaders([
                    'User-Agent' => 'Lateralzr-API/1.0 (https://github.com/yourusername/lateralzr-api; contact@example.com)',
                ])
                ->get("https://en.wikipedia.org/api/rest_v1/page/summary/{$encodedTitle}");

            if ($summaryResponse->successful()) {
                $summaryData = $summaryResponse->json();
                if (($summaryData['type'] ?? '') !== 'disambiguation') {
                    $url = $summaryData['content_urls']['desktop']['page'] ?? null;
                    if ($url) {
                        return $url;
                    }
                }
            }
        }

        return '';
    }

    /**
     * Ensure URL is properly encoded (e.g. path segments with spaces or special chars).
     */
    protected function ensureEncodedUrl(string $url): string
    {
        $parsed = parse_url($url);
        if (! isset($parsed['path']) || $parsed['path'] === '') {
            return $url;
        }
        $path = $parsed['path'];
        $segments = explode('/', trim($path, '/'));
        $encodedSegments = array_map(
            fn ($s) => rawurlencode($s),
            $segments
        );
        $encodedPath = '/' . implode('/', $encodedSegments);
        $result = ($parsed['scheme'] ?? 'https') . '://' . ($parsed['host'] ?? '') . $encodedPath;
        if (! empty($parsed['query'])) {
            $result .= '?' . $parsed['query'];
        }
        if (! empty($parsed['fragment'])) {
            $result .= '#' . rawurlencode($parsed['fragment']);
        }

        return $result;
    }

    /**
     * Get the tool's schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'concept' => $schema->string()->required(),
            'shortDescription' => $schema->string()->nullable(),
        ];
    }

    /**
     * Normalize concept name for Wikipedia API.
     */
    protected function normalizeConceptName(string $concept): string
    {
        // Capitalize first letter of each word and replace spaces with underscores
        return str_replace(' ', '_', ucwords(strtolower(trim($concept))));
    }
}
