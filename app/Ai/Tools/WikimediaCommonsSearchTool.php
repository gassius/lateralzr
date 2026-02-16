<?php

namespace App\Ai\Tools;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class WikimediaCommonsSearchTool implements Tool
{
    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Search for a Public Domain JPEG image on Wikimedia Commons for a given concept. Returns a direct link to the image file (second largest thumbnail size) if found.';
    }

    /**
     * Execute the tool.
     */
    public function handle(Request $request): Stringable|string
    {
        $concept = $request['concept'] ?? '';
        $shortDescription = $request['shortDescription'] ?? '';

        if (empty($concept)) {
            Log::channel('single')->debug('WikimediaCommonsSearchTool: Empty concept provided');
            return '';
        }

        Log::channel('single')->debug('WikimediaCommonsSearchTool: Searching for concept', [
            'concept' => $concept,
            'shortDescription' => $shortDescription,
        ]);

        try {
            // Progressive search strategy: try multiple approaches from most specific to most general
            $searchStrategies = $this->buildSearchStrategies($concept, $shortDescription);

            foreach ($searchStrategies as $strategy) {
                $imageUrl = $this->trySearchStrategy($concept, $strategy);
                if ($imageUrl) {
                    return $imageUrl;
                }
            }

            Log::channel('single')->debug('WikimediaCommonsSearchTool: No results found after all strategies', ['concept' => $concept]);
            return '';
        } catch (\Exception $e) {
            Log::channel('single')->warning('WikimediaCommonsSearchTool: Error searching for concept', [
                'concept' => $concept,
                'error' => $e->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * Get the tool's schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'concept' => $schema->string()->required(),
            'shortDescription' => $schema->string(),
        ];
    }

    /**
     * Build multiple search strategies from most specific to most general.
     */
    protected function buildSearchStrategies(string $concept, string $shortDescription): array
    {
        $strategies = [];
        $conceptEscaped = addslashes($concept);

        // Strategy 1: Concept in title + Public Domain + JPEG
        $strategies[] = [
            'query' => sprintf('intitle:"%s" filetype:bitmap filemime:image/jpeg haswbstatement:P275=Q6938433', $conceptEscaped),
            'description' => 'concept in title + PD + JPEG',
        ];

        // Strategy 2: Concept in title + JPEG (no PD requirement)
        $strategies[] = [
            'query' => sprintf('intitle:"%s" filetype:bitmap filemime:image/jpeg', $conceptEscaped),
            'description' => 'concept in title + JPEG',
        ];

        // Strategy 3: Concept as general search + Public Domain + JPEG
        $strategies[] = [
            'query' => sprintf('"%s" filetype:bitmap filemime:image/jpeg haswbstatement:P275=Q6938433', $conceptEscaped),
            'description' => 'concept search + PD + JPEG',
        ];

        // Strategy 4: Concept as general search + JPEG
        $strategies[] = [
            'query' => sprintf('"%s" filetype:bitmap filemime:image/jpeg', $conceptEscaped),
            'description' => 'concept search + JPEG',
        ];

        // Strategy 5: Concept only + JPEG (most general)
        $strategies[] = [
            'query' => sprintf('%s filetype:bitmap filemime:image/jpeg', $conceptEscaped),
            'description' => 'concept only + JPEG',
        ];

        // Strategy 6: If description available, try concept + description keywords + JPEG
        if (!empty($shortDescription)) {
            $keywords = $this->extractKeywords($shortDescription);
            if (!empty($keywords)) {
                $keywordTerms = implode(' ', array_slice($keywords, 0, 2));
                $strategies[] = [
                    'query' => sprintf('%s %s filetype:bitmap filemime:image/jpeg', $conceptEscaped, addslashes($keywordTerms)),
                    'description' => 'concept + description keywords + JPEG',
                ];
            }
        }

        return $strategies;
    }

    /**
     * Extract meaningful keywords from description.
     */
    protected function extractKeywords(string $description): array
    {
        $stopWords = ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'that', 'this', 'it', 'as', 'be', 'by', 'or', 'and'];
        $words = array_slice(preg_split('/\s+/', trim($description), -1, PREG_SPLIT_NO_EMPTY), 0, 5);
        return array_filter($words, fn ($w) => strlen($w) > 2 && !in_array(strtolower($w), $stopWords, true));
    }

    /**
     * Try a search strategy and return image URL if found.
     */
    protected function trySearchStrategy(string $concept, array $strategy): ?string
    {
        try {
            $response = Http::timeout(10)
                ->withoutVerifying()
                ->withHeaders([
                    'User-Agent' => 'Lateralzr-API/1.0 (https://github.com/yourusername/lateralzr-api; contact@example.com)',
                ])
                ->get('https://commons.wikimedia.org/w/api.php', [
                    'action' => 'query',
                    'format' => 'json',
                    'list' => 'search',
                    'srsearch' => $strategy['query'],
                    'srnamespace' => 6, // File namespace
                    'srlimit' => 3, // Get a few results to try
                ]);

            if (!$response->successful()) {
                return null;
            }

            $data = $response->json();
            $searchResults = $data['query']['search'] ?? [];

            if (empty($searchResults)) {
                return null;
            }

            // Try each result until we find one with a valid thumbnail URL
            foreach ($searchResults as $result) {
                $title = $result['title'] ?? '';
                if ($title) {
                    $imageUrl = $this->getImageThumbnailUrl($title);
                    if ($imageUrl) {
                        Log::channel('single')->debug('WikimediaCommonsSearchTool: Found image URL', [
                            'concept' => $concept,
                            'strategy' => $strategy['description'],
                            'url' => $imageUrl,
                        ]);
                        return $imageUrl;
                    }
                }
            }

            return null;
        } catch (\Exception $e) {
            Log::channel('single')->debug('WikimediaCommonsSearchTool: Strategy failed', [
                'strategy' => $strategy['description'],
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Get the direct image thumbnail URL (second largest size) for a file title.
     * Simplified to make fewer API calls and be more reliable.
     */
    protected function getImageThumbnailUrl(string $title): ?string
    {
        try {
            // Request a few strategic thumbnail sizes in parallel to find the second largest
            // We'll request 1280px and 960px to find what's available
            $widths = [1280, 960];
            $availableThumbnails = [];

            foreach ($widths as $width) {
                $response = Http::timeout(8)
                    ->withoutVerifying()
                    ->withHeaders([
                        'User-Agent' => 'Lateralzr-API/1.0 (https://github.com/yourusername/lateralzr-api; contact@example.com)',
                    ])
                    ->get('https://commons.wikimedia.org/w/api.php', [
                        'action' => 'query',
                        'format' => 'json',
                        'titles' => $title,
                        'prop' => 'imageinfo',
                        'iiprop' => 'url',
                        'iiurlwidth' => $width,
                    ]);

                if ($response->successful()) {
                    $data = $response->json();
                    $pages = $data['query']['pages'] ?? [];
                    
                    if (!empty($pages)) {
                        $page = reset($pages);
                        // Check for error in page (e.g., missing file)
                        if (isset($page['missing'])) {
                            continue;
                        }
                        
                        $imageInfo = $page['imageinfo'][0] ?? null;
                        
                        if ($imageInfo && isset($imageInfo['thumburl'])) {
                            $url = $imageInfo['thumburl'];
                            // Extract actual width from URL (e.g., "960px-Bird_shaped...")
                            if (preg_match('/(\d+)px-/', $url, $matches)) {
                                $actualWidth = (int)$matches[1];
                                $availableThumbnails[$actualWidth] = $url;
                            } else {
                                // If no width in URL, use requested width as fallback
                                $availableThumbnails[$width] = $url;
                            }
                        }
                    }
                }
            }

            // If we have multiple thumbnails, return second largest; otherwise return what we have
            if (!empty($availableThumbnails)) {
                krsort($availableThumbnails);
                $sortedUrls = array_values($availableThumbnails);
                
                // Return second largest if available, otherwise largest
                return $sortedUrls[min(1, count($sortedUrls) - 1)] ?? $sortedUrls[0] ?? null;
            }

            // Fallback: get original image URL if no thumbnails found
            $fallbackResponse = Http::timeout(8)
                ->withoutVerifying()
                ->withHeaders([
                    'User-Agent' => 'Lateralzr-API/1.0 (https://github.com/yourusername/lateralzr-api; contact@example.com)',
                ])
                ->get('https://commons.wikimedia.org/w/api.php', [
                    'action' => 'query',
                    'format' => 'json',
                    'titles' => $title,
                    'prop' => 'imageinfo',
                    'iiprop' => 'url',
                ]);

            if ($fallbackResponse->successful()) {
                $fallbackData = $fallbackResponse->json();
                $fallbackPages = $fallbackData['query']['pages'] ?? [];
                if (!empty($fallbackPages)) {
                    $fallbackPage = reset($fallbackPages);
                    if (!isset($fallbackPage['missing'])) {
                        $fallbackInfo = $fallbackPage['imageinfo'][0] ?? null;
                        return $fallbackInfo['url'] ?? null;
                    }
                }
            }

            return null;
        } catch (\Exception $e) {
            Log::channel('single')->debug('WikimediaCommonsSearchTool: Error getting thumbnail URL', [
                'title' => $title,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
