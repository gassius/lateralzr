<?php

namespace App\Ai\Tools;

use App\Support\ConceptLocale;
use Illuminate\Contracts\JsonSchema\JsonSchema;
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
        return 'Search for a Wikipedia page URL for a given concept and locale. Returns the Wikipedia article URL if found.';
    }

    /**
     * Execute the tool.
     */
    public function handle(Request $request): Stringable|string
    {
        $concept = $request['concept'] ?? '';
        $shortDescription = $request['shortDescription'] ?? '';
        $locale = ConceptLocale::resolve($request['locale'] ?? null);

        return $this->lookup((string) $concept, (string) $shortDescription, $locale);
    }

    /**
     * Exact-title lookup kept for the agent tool and smoke tests.
     * Concept enrichment uses WikipediaArticleResolver via concepts:complete-info instead.
     */
    public function lookup(string $concept, string $shortDescription = '', ?string $locale = null): string
    {
        $locale = ConceptLocale::resolve($locale);

        if ($concept === '') {
            Log::channel('single')->debug('WikipediaSearchTool: Empty concept provided');

            return '';
        }

        Log::channel('single')->debug('WikipediaSearchTool: Searching for concept', [
            'concept' => $concept,
            'locale' => $locale,
        ]);

        try {
            $url = $this->urlFromSummary(
                $this->fetchSummary($this->normalizeConceptName($concept), $locale),
                $concept,
                $shortDescription,
                $locale,
            );
            if ($url !== null) {
                return $url;
            }

            Log::channel('single')->debug('WikipediaSearchTool: No page found', [
                'concept' => $concept,
                'locale' => $locale,
            ]);

            return '';
        } catch (\Exception $e) {
            Log::channel('single')->warning('WikipediaSearchTool: Error searching for concept', [
                'concept' => $concept,
                'locale' => $locale,
                'error' => $e->getMessage(),
            ]);

            return '';
        }
    }

    /**
     * Search Wikipedia for a more specific page using concept + shortDescription keywords.
     */
    protected function searchForSpecificPage(string $concept, string $shortDescription, string $locale): string
    {
        $host = $this->wikipediaHost($locale);

        // Build search query: concept plus first meaningful words from shortDescription (avoid common words)
        $stopWords = ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'that', 'this', 'it', 'as', 'be', 'by', 'or', 'and'];
        $words = array_slice(preg_split('/\s+/', trim($shortDescription), -1, PREG_SPLIT_NO_EMPTY), 0, 5);
        $keywords = array_filter($words, fn ($w) => strlen($w) > 2 && ! in_array(strtolower($w), $stopWords, true));
        $searchQuery = $concept.' '.implode(' ', array_slice($keywords, 0, 3));

        $response = $this->httpClient()->get("https://{$host}/w/api.php", [
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
            $summaryData = $this->fetchSummary($title, $locale);
            if ($summaryData !== null && ($summaryData['type'] ?? '') !== 'disambiguation') {
                $url = $summaryData['content_urls']['desktop']['page'] ?? null;
                if ($url) {
                    return $url;
                }
            }
        }

        return '';
    }

    protected function wikipediaHost(string $locale): string
    {
        $locale = ConceptLocale::resolve($locale);

        return $locale.'.wikipedia.org';
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
        $encodedPath = '/'.implode('/', $encodedSegments);
        $result = ($parsed['scheme'] ?? 'https').'://'.($parsed['host'] ?? '').$encodedPath;
        if (! empty($parsed['query'])) {
            $result .= '?'.$parsed['query'];
        }
        if (! empty($parsed['fragment'])) {
            $result .= '#'.rawurlencode($parsed['fragment']);
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
            'locale' => $schema->string()->nullable(),
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

    /**
     * @return array<string, mixed>|null
     */
    protected function fetchSummary(string $title, string $locale): ?array
    {
        $host = $this->wikipediaHost($locale);
        $response = $this->httpClient()->get(
            "https://{$host}/api/rest_v1/page/summary/".rawurlencode($title)
        );

        if (! $response->successful()) {
            return null;
        }

        $data = $response->json();

        return is_array($data) ? $data : null;
    }

    /**
     * @param  array<string, mixed>|null  $data
     */
    protected function urlFromSummary(?array $data, string $concept, string $shortDescription, string $locale): ?string
    {
        if ($data === null) {
            return null;
        }

        $pageType = $data['type'] ?? 'standard';

        if ($pageType === 'disambiguation' && $shortDescription !== '') {
            $specificUrl = $this->searchForSpecificPage($concept, $shortDescription, $locale);
            if ($specificUrl !== '') {
                return $this->ensureEncodedUrl($specificUrl);
            }

            Log::channel('single')->debug('WikipediaSearchTool: Disambiguation page, no specific match found', [
                'concept' => $concept,
                'locale' => $locale,
            ]);

            return '';
        }

        if ($pageType === 'disambiguation') {
            Log::channel('single')->debug('WikipediaSearchTool: Disambiguation page skipped (no shortDescription)', [
                'concept' => $concept,
                'locale' => $locale,
            ]);

            return '';
        }

        $url = $data['content_urls']['desktop']['page'] ?? null;
        if ($url) {
            Log::channel('single')->debug('WikipediaSearchTool: Found URL', [
                'concept' => $concept,
                'locale' => $locale,
                'url' => $url,
            ]);

            return $this->ensureEncodedUrl($url);
        }

        return null;
    }

    protected function httpClient(int $timeoutSeconds = 10): \Illuminate\Http\Client\PendingRequest
    {
        return WikiHttp::client($timeoutSeconds);
    }
}
