<?php

namespace App\Services\Enrichment;

/**
 * Media attached to a resolved Wikipedia article.
 * Only CC0 / public-domain files with a filename that shares the concept or article title are kept.
 * Images and short clips are both allowed; the caller decides which URL the current client displays.
 */
class QualifiedMediaFinder
{
    private const MAX_VIDEO_BYTES = 12_000_000;

    private const MAX_ORIGINAL_IMAGE_BYTES = 5_000_000;

    /** @var list<string> */
    private const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

    /** @var list<string> */
    private const REJECT_NAME_TOKENS = [
        'logo', 'icon', 'symbol', 'flag', 'locator', 'ambox', 'wikimedia', 'commons',
        'nuvola', 'edit', 'stub', 'disambig',
    ];

    public function __construct(
        private WikimediaClient $client,
        private WikipediaCandidateRanker $ranker,
    ) {}

    /**
     * @param  list<array{language:string,title:string}>  $pages
     * @return list<QualifiedMedia>
     */
    public function find(string $label, string $description, array $pages, int $limit = 4): array
    {
        $limit = max(1, min(8, $limit));
        $files = $this->fileTitles($pages);
        if ($files === []) {
            return [];
        }

        $anchor = $this->ranker->tokens($label.' '.implode(' ', array_map(
            static fn (array $page): string => (string) ($page['title'] ?? ''),
            $pages
        )));
        // Description can raise a file that already matches the concept or article.
        // It cannot qualify a file on its own (that is how unrelated pictures get attached).
        $descriptionTokens = $this->ranker->tokens($description);

        $accepted = [];
        foreach (array_chunk($files, 12) as $chunk) {
            $json = $this->client->get('commons.wikimedia.org', [
                'action' => 'query',
                'titles' => implode('|', $chunk),
                'prop' => 'imageinfo',
                'iiprop' => 'url|mime|size|extmetadata|descriptionurl',
                'iiurlwidth' => 1280,
                'iiextmetadatafilter' => 'LicenseShortName|LicenseUrl|UsageTerms|AttributionRequired|Restrictions|Artist|Credit|ImageDescription|ObjectName|Categories',
            ]);
            foreach ($this->pagesOf($json) as $page) {
                $media = $this->qualifyPage($page, $anchor, $descriptionTokens);
                if ($media !== null) {
                    $accepted[] = $media;
                }
            }
        }

        usort($accepted, function (array $a, array $b): int {
            if ($a['score'] !== $b['score']) {
                return $b['score'] <=> $a['score'];
            }
            if ($a['media']->kind !== $b['media']->kind) {
                return $a['media']->kind === 'image' ? -1 : 1;
            }

            return 0;
        });

        $chosen = [];
        $seen = [];
        foreach ($accepted as $row) {
            $url = $row['media']->url;
            if (isset($seen[$url])) {
                continue;
            }
            $seen[$url] = true;
            $chosen[] = $row['media'];
            if (count($chosen) >= $limit) {
                break;
            }
        }

        return $chosen;
    }

    /**
     * @param  list<array{language:string,title:string}>  $pages
     * @return list<string>
     */
    private function fileTitles(array $pages): array
    {
        $titles = [];
        foreach ($pages as $page) {
            $language = strtolower(trim((string) ($page['language'] ?? '')));
            $title = trim((string) ($page['title'] ?? ''));
            if ($language === '' || $title === '') {
                continue;
            }
            $json = $this->client->get($language.'.wikipedia.org', [
                'action' => 'query',
                'titles' => $title,
                'prop' => 'images',
                'imlimit' => 40,
            ]);
            foreach ($this->pagesOf($json) as $result) {
                $images = $result['images'] ?? null;
                if (! is_array($images)) {
                    continue;
                }
                foreach ($images as $image) {
                    if (! is_array($image)) {
                        continue;
                    }
                    $file = trim((string) ($image['title'] ?? ''));
                    if ($file !== '' && ! str_ends_with(strtolower($file), '.svg')) {
                        $titles[$file] = true;
                    }
                }
            }
        }

        return array_keys($titles);
    }

    /**
     * @param  array<string, mixed>|null  $json
     * @return list<array<string, mixed>>
     */
    private function pagesOf(?array $json): array
    {
        $pages = $json['query']['pages'] ?? null;
        if (! is_array($pages)) {
            return [];
        }

        $list = [];
        foreach ($pages as $page) {
            if (is_array($page) && ! isset($page['missing'])) {
                $list[] = $page;
            }
        }

        return $list;
    }

    /**
     * @param  array<string, mixed>  $page
     * @param  list<string>  $anchor
     * @param  list<string>  $descriptionTokens
     * @return array{media: QualifiedMedia, score: int}|null
     */
    private function qualifyPage(array $page, array $anchor, array $descriptionTokens): ?array
    {
        $title = (string) ($page['title'] ?? '');
        $info = $page['imageinfo'][0] ?? null;
        if (! is_array($info)) {
            return null;
        }

        $score = $this->relevanceScore($title, $anchor);
        if ($score < 1) {
            return null;
        }
        if ($descriptionTokens !== []) {
            $score += $this->relevanceScore($title, $descriptionTokens);
        }

        $license = MediaLicense::qualify(is_array($info['extmetadata'] ?? null) ? $info['extmetadata'] : null);
        if ($license === null) {
            return null;
        }

        $mime = strtolower(trim((string) ($info['mime'] ?? '')));
        $kind = $this->kindForMime($mime);
        if ($kind === null) {
            return null;
        }

        $url = $this->usableUrl($info, $kind);
        if ($url === null) {
            return null;
        }

        $ext = is_array($info['extmetadata'] ?? null) ? $info['extmetadata'] : null;
        $resized = $this->usedThumb($info, $kind, $url);
        $sourcePageUrl = $this->cleanPageUrl(isset($info['descriptionurl']) ? (string) $info['descriptionurl'] : null);

        return [
            'score' => $score,
            'media' => new QualifiedMedia(
                url: $url,
                kind: $kind,
                license: $license,
                source: 'wikimedia',
                purpose: $this->inferPurpose($title, MediaLicense::alt($ext) ?? '', $mime),
                alt: MediaLicense::alt($ext),
                creator: MediaLicense::creator($ext),
                sourcePageUrl: $sourcePageUrl,
                licenceName: MediaLicense::name($ext) ?? $license,
                licenceUrl: MediaLicense::url($ext),
                changeNotice: MediaLicense::inferChangeNotice($ext, $resized),
                tone: MediaLicense::inferTone($ext),
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $info
     */
    private function usedThumb(array $info, string $kind, string $url): bool
    {
        if ($kind !== 'image') {
            return false;
        }
        $thumb = $this->cleanUploadUrl(isset($info['thumburl']) ? (string) $info['thumburl'] : null);

        return $thumb !== null && $thumb === $url;
    }

    private function cleanPageUrl(?string $url): ?string
    {
        if ($url === null || trim($url) === '') {
            return null;
        }
        if (! filter_var($url, FILTER_VALIDATE_URL)) {
            return null;
        }
        $parts = parse_url($url);
        if (! is_array($parts) || ! isset($parts['scheme'], $parts['host'])) {
            return null;
        }
        $host = strtolower((string) $parts['host']);
        if (! str_ends_with($host, 'wikimedia.org') && ! str_ends_with($host, 'wikipedia.org')) {
            return null;
        }

        return $url;
    }

    private function inferPurpose(string $fileTitle, string $description, string $mime): string
    {
        $name = preg_replace('/^File:/i', '', $fileTitle) ?? $fileTitle;
        $blob = strtolower(str_replace('_', ' ', $name).' '.$description);
        if (preg_match('/\b(map|locator map|street map|planisphere)\b/', $blob) === 1) {
            return 'map';
        }
        if (preg_match('/\b(diagram|schematic|chart|graph|lattice|flowchart|schema)\b/', $blob) === 1) {
            return 'diagram';
        }
        if (preg_match('/\b(painting|artwork|engraving|etching|drawing|lithograph|woodcut)\b/', $blob) === 1) {
            return 'artwork';
        }
        if (preg_match('/\b(inscription|manuscript|caption|labelled|labeled text)\b/', $blob) === 1) {
            return 'text-bearing';
        }
        if (in_array($mime, ['image/png', 'image/svg+xml', 'image/gif'], true)) {
            return 'diagram';
        }

        return 'photo';
    }

    /**
     * @param  list<string>  $anchor
     */
    private function relevanceScore(string $fileTitle, array $anchor): int
    {
        $name = preg_replace('/^File:/i', '', $fileTitle) ?? $fileTitle;
        $name = (string) preg_replace('/\.[^.]+$/', '', $name);
        $tokens = $this->ranker->tokens(str_replace('_', ' ', $name));
        foreach ($tokens as $token) {
            if (in_array($token, self::REJECT_NAME_TOKENS, true)) {
                return 0;
            }
        }

        $score = 0;
        foreach ($tokens as $token) {
            foreach ($anchor as $needle) {
                if ($token === $needle) {
                    $score++;
                    break;
                }
                $short = mb_strlen($token) <= mb_strlen($needle) ? $token : $needle;
                $long = $short === $token ? $needle : $token;
                if (mb_strlen($short) >= 4 && str_starts_with($long, $short)) {
                    $score++;
                    break;
                }
            }
        }

        return $score;
    }

    private function kindForMime(string $mime): ?string
    {
        if (in_array($mime, ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'], true)) {
            return 'image';
        }

        if (in_array($mime, ['video/webm', 'video/ogg', 'video/mp4'], true)) {
            return 'clip';
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $info
     */
    private function usableUrl(array $info, string $kind): ?string
    {
        $thumb = $this->cleanUploadUrl(isset($info['thumburl']) ? (string) $info['thumburl'] : null);
        $original = $this->cleanUploadUrl(isset($info['url']) ? (string) $info['url'] : null);
        $size = isset($info['size']) ? (int) $info['size'] : null;

        if ($kind === 'clip') {
            if ($original === null || $size === null || $size <= 0 || $size > self::MAX_VIDEO_BYTES) {
                return null;
            }

            return $original;
        }

        if ($thumb !== null && $this->allowedImageExtension($thumb)) {
            return $thumb;
        }

        if ($original !== null && $this->allowedImageExtension($original) && ($size === null || $size <= self::MAX_ORIGINAL_IMAGE_BYTES)) {
            return $original;
        }

        return null;
    }

    private function allowedImageExtension(string $url): bool
    {
        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return in_array($extension, self::IMAGE_EXTENSIONS, true);
    }

    private function cleanUploadUrl(?string $url): ?string
    {
        if ($url === null || trim($url) === '') {
            return null;
        }

        $parts = parse_url($url);
        if (! is_array($parts) || ! isset($parts['scheme'], $parts['host'], $parts['path'])) {
            return null;
        }

        if (strtolower((string) $parts['scheme']) !== 'https') {
            return null;
        }

        $host = strtolower((string) $parts['host']);
        // Commons imageinfo often returns thumbs on thumb.wikimedia.org. The client
        // proxy only allows upload.wikimedia.org, which serves the same path.
        if (! in_array($host, ['upload.wikimedia.org', 'thumb.wikimedia.org'], true)) {
            return null;
        }

        return 'https://upload.wikimedia.org'.$parts['path'];
    }
}
