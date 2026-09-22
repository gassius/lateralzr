<?php

namespace App\Services\Enrichment;

final class WikipediaArticle
{
    /**
     * @param  list<array{language:string,title:string}>  $mediaPages
     */
    public function __construct(
        public string $url,
        public string $title,
        public string $language,
        public array $mediaPages,
    ) {}

    public static function pageUrl(string $language, string $title): string
    {
        $slug = str_replace(' ', '_', trim($title));

        return 'https://'.$language.'.wikipedia.org/wiki/'.rawurlencode($slug);
    }

    public static function fromUrl(string $url): ?self
    {
        $parts = parse_url(trim($url));
        if (! is_array($parts) || ! isset($parts['host'], $parts['path'])) {
            return null;
        }

        $host = strtolower((string) $parts['host']);
        if (! preg_match('/^([a-z]{2,3})\.wikipedia\.org$/', $host, $hostMatch)) {
            return null;
        }

        $path = rawurldecode((string) $parts['path']);
        if (! preg_match('#^/wiki/(.+)$#', $path, $pathMatch)) {
            return null;
        }

        $language = $hostMatch[1];
        $title = str_replace('_', ' ', $pathMatch[1]);

        return new self(
            url: self::pageUrl($language, $title),
            title: $title,
            language: $language,
            mediaPages: [['language' => $language, 'title' => $title]],
        );
    }
}
