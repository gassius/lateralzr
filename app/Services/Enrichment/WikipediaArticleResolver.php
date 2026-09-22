<?php

namespace App\Services\Enrichment;

use App\Support\ConceptLocale;

/**
 * Localized Wikipedia article lookup for concept enrichment.
 * Uses MediaWiki search (not an exact title) and drops container pages such as museums
 * unless the concept itself names that container.
 */
class WikipediaArticleResolver
{
    public function __construct(
        private WikimediaClient $client,
        private WikipediaCandidateRanker $ranker,
    ) {}

    public function find(
        string $label,
        string $description,
        string $locale,
        ?string $alternateLabel = null,
        ?string $alternateDescription = null,
    ): ?WikipediaArticle {
        $label = trim($label);
        $description = trim($description);
        if ($label === '') {
            return null;
        }

        $locale = ConceptLocale::resolve($locale);
        $direct = $this->searchLanguage($locale, $label, $description);
        if ($direct !== null) {
            return $this->attachEnglishMediaPage($direct);
        }

        $alternateLabel = trim((string) $alternateLabel);
        if ($locale === 'en' || $alternateLabel === '') {
            return null;
        }

        $english = $this->searchLanguage('en', $alternateLabel, trim((string) ($alternateDescription ?? $description)));
        if ($english === null) {
            return null;
        }

        $localizedTitle = $this->langlink('en', $english->title, $locale);
        if ($localizedTitle === null) {
            return null;
        }

        return new WikipediaArticle(
            url: WikipediaArticle::pageUrl($locale, $localizedTitle),
            title: $localizedTitle,
            language: $locale,
            mediaPages: [
                ['language' => $locale, 'title' => $localizedTitle],
                ['language' => 'en', 'title' => $english->title],
            ],
        );
    }

    private function searchLanguage(string $language, string $label, string $description): ?WikipediaArticle
    {
        $candidates = $this->search($language, $label);
        $best = $this->ranker->best($label, $description, $candidates);
        if ($best === null && $description !== '') {
            $keywords = array_slice($this->ranker->tokens($description), 0, 4);
            if ($keywords !== []) {
                $candidates = $this->mergeCandidates(
                    $candidates,
                    $this->search($language, $label.' '.implode(' ', $keywords))
                );
                $best = $this->ranker->best($label, $description, $candidates);
            }
        }
        if ($best === null) {
            return null;
        }

        return new WikipediaArticle(
            url: WikipediaArticle::pageUrl($language, (string) $best['title']),
            title: (string) $best['title'],
            language: $language,
            mediaPages: [['language' => $language, 'title' => (string) $best['title']]],
        );
    }

    /**
     * @return list<array{title:string,extract:string,rank:int,disambiguation:bool}>
     */
    private function search(string $language, string $query): array
    {
        $json = $this->client->get($language.'.wikipedia.org', [
            'action' => 'query',
            'generator' => 'search',
            'gsrsearch' => $query,
            'gsrlimit' => 8,
            'gsrnamespace' => 0,
            'prop' => 'extracts|pageprops',
            'exintro' => 1,
            'explaintext' => 1,
            'exchars' => 600,
            'ppprop' => 'disambiguation',
            'redirects' => 1,
        ]);

        $pages = $json['query']['pages'] ?? null;
        if (! is_array($pages)) {
            return [];
        }

        $candidates = [];
        foreach ($pages as $page) {
            if (! is_array($page)) {
                continue;
            }
            $title = trim((string) ($page['title'] ?? ''));
            if ($title === '' || isset($page['missing'])) {
                continue;
            }
            $pageprops = is_array($page['pageprops'] ?? null) ? $page['pageprops'] : [];
            $candidates[] = [
                'title' => $title,
                'extract' => trim((string) ($page['extract'] ?? '')),
                'rank' => max(1, (int) ($page['index'] ?? 9)),
                'disambiguation' => array_key_exists('disambiguation', $pageprops),
            ];
        }

        return $candidates;
    }

    /**
     * @param  list<array{title:string,extract:string,rank:int,disambiguation:bool}>  $left
     * @param  list<array{title:string,extract:string,rank:int,disambiguation:bool}>  $right
     * @return list<array{title:string,extract:string,rank:int,disambiguation:bool}>
     */
    private function mergeCandidates(array $left, array $right): array
    {
        $byTitle = [];
        foreach ([$left, $right] as $batch) {
            foreach ($batch as $candidate) {
                $key = mb_strtolower($candidate['title']);
                if (! isset($byTitle[$key]) || $candidate['rank'] < $byTitle[$key]['rank']) {
                    $byTitle[$key] = $candidate;
                }
            }
        }

        return array_values($byTitle);
    }

    private function attachEnglishMediaPage(WikipediaArticle $article): WikipediaArticle
    {
        if ($article->language === 'en') {
            return $article;
        }

        $englishTitle = $this->langlink($article->language, $article->title, 'en');
        if ($englishTitle === null || mb_strtolower($englishTitle) === mb_strtolower($article->title)) {
            return $article;
        }

        $pages = $article->mediaPages;
        $pages[] = ['language' => 'en', 'title' => $englishTitle];

        return new WikipediaArticle(
            url: $article->url,
            title: $article->title,
            language: $article->language,
            mediaPages: $pages,
        );
    }

    private function langlink(string $fromLanguage, string $title, string $toLanguage): ?string
    {
        $json = $this->client->get($fromLanguage.'.wikipedia.org', [
            'action' => 'query',
            'titles' => $title,
            'prop' => 'langlinks',
            'lllang' => $toLanguage,
        ]);

        $pages = $json['query']['pages'] ?? null;
        if (! is_array($pages)) {
            return null;
        }

        foreach ($pages as $page) {
            if (! is_array($page)) {
                continue;
            }
            $links = $page['langlinks'] ?? null;
            if (! is_array($links)) {
                continue;
            }
            foreach ($links as $link) {
                if (! is_array($link)) {
                    continue;
                }
                $linked = trim((string) ($link['*'] ?? $link['title'] ?? ''));
                if ($linked !== '') {
                    return $linked;
                }
            }
        }

        return null;
    }
}
