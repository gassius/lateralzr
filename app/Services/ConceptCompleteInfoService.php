<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptMedia;
use App\Models\ConceptTerm;
use App\Services\Enrichment\QualifiedMedia;
use App\Services\Enrichment\QualifiedMediaFinder;
use App\Services\Enrichment\WikipediaArticle;
use App\Services\Enrichment\WikipediaArticleResolver;
use App\Support\ConceptLocale;
use Illuminate\Support\Facades\Log;

class ConceptCompleteInfoService
{
    public const HTTP_TIMEOUT_SECONDS = 12;

    /** Locale search + keyword retry + English langlink + English search + keyword + locale langlink. */
    public const WORST_WIKI_HTTP_CALLS = 6;

    /** Two page image lists plus several Commons imageinfo chunks. */
    public const WORST_MEDIA_HTTP_CALLS = 8;

    public const MAX_BATCH_SIZE = 20;

    public function __construct(
        protected WikipediaArticleResolver $articles,
        protected QualifiedMediaFinder $mediaFinder,
    ) {}

    /**
     * Worst-case sequential Wikimedia time for one term (every HTTP call hits its timeout).
     */
    public static function estimatedWorstCaseSeconds(string $mode): int
    {
        $http = self::HTTP_TIMEOUT_SECONDS;

        return match ($mode) {
            'wiki' => $http * self::WORST_WIKI_HTTP_CALLS,
            'media' => $http * self::WORST_MEDIA_HTTP_CALLS,
            default => $http * (self::WORST_WIKI_HTTP_CALLS + self::WORST_MEDIA_HTTP_CALLS),
        };
    }

    /**
     * Backfill missing localized wiki URLs and concept-level media.
     * This is the only path that searches Wikipedia or attaches media.
     *
     * @param  list<int>  $termIds
     * @param  'wiki'|'media'|'both'  $mode
     * @param  int|null  $deadlineAt  Unix timestamp; stop starting new terms at/after this.
     * @return array{processed:int,wikiUpdated:int,mediaUpdated:int,skipped:int,failed:int,deferred:int,deferredTermIds:list<int>}
     */
    public function complete(array $termIds, string $mode = 'both', ?int $deadlineAt = null): array
    {
        $mode = $this->normalizeMode($mode);
        $stats = [
            'processed' => 0,
            'wikiUpdated' => 0,
            'mediaUpdated' => 0,
            'skipped' => 0,
            'failed' => 0,
            'deferred' => 0,
            'deferredTermIds' => [],
        ];

        $ids = array_values(array_unique(array_map('intval', $termIds)));
        if ($ids === []) {
            return $stats;
        }

        $terms = ConceptTerm::query()
            ->with(['concept.media', 'concept.terms'])
            ->whereIn('id', $ids)
            ->orderBy('id')
            ->get();

        foreach ($terms as $index => $term) {
            if ($this->shouldStopBeforeTerm($deadlineAt, $mode)) {
                $deferred = $terms->slice($index);
                $stats['deferredTermIds'] = $deferred
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->values()
                    ->all();
                $stats['deferred'] = count($stats['deferredTermIds']);
                Log::info('ConceptCompleteInfoService: stopping before worker timeout', [
                    'deferred' => $stats['deferred'],
                    'processed' => $stats['processed'],
                    'mode' => $mode,
                    'worst_case_seconds' => self::estimatedWorstCaseSeconds($mode),
                ]);
                break;
            }

            $stats['processed']++;

            $needWiki = in_array($mode, ['wiki', 'both'], true) && $this->isBlank($term->wiki_url);
            $needMedia = in_array($mode, ['media', 'both'], true) && $this->termNeedsMedia($term);

            if (! $needWiki && ! $needMedia) {
                $stats['skipped']++;

                continue;
            }

            $concept = $term->concept;
            if (! $concept instanceof Concept) {
                $stats['failed']++;

                continue;
            }

            try {
                $label = (string) $term->term;
                $description = (string) ($term->short_description ?? '');
                $english = $concept->termForLocale(ConceptLocale::default(), fallback: false);
                $alternateLabel = null;
                $alternateDescription = null;
                if ($english instanceof ConceptTerm && (int) $english->id !== (int) $term->id) {
                    $alternateLabel = (string) $english->term;
                    $alternateDescription = (string) ($english->short_description ?? '');
                }

                $article = null;
                if ($needWiki || $this->isBlank($term->wiki_url)) {
                    $article = $this->articles->find(
                        $label,
                        $description,
                        (string) $term->locale,
                        $alternateLabel,
                        $alternateDescription,
                    );
                } elseif ($needMedia) {
                    $article = WikipediaArticle::fromUrl((string) $term->wiki_url);
                }

                $updates = [];
                if ($needWiki && $article instanceof WikipediaArticle && $article->url !== '') {
                    $updates['wiki_url'] = $article->url;
                    $stats['wikiUpdated']++;
                }

                if ($needMedia) {
                    $before = $concept->media->count();
                    if ($before === 0 && $article instanceof WikipediaArticle) {
                        $found = $this->mediaFinder->find($label, $description, $article->mediaPages);
                        $this->persistMedia($concept, $found);
                        $concept->unsetRelation('media');
                    }

                    $primary = $this->primaryImageUrl($concept);
                    if ($primary !== null && $this->isBlank($term->media_url)) {
                        $updates['media_url'] = $primary;
                        $this->copyPrimaryToSiblingTerms($concept, (int) $term->id, $primary);
                        $stats['mediaUpdated']++;
                    } elseif ($concept->media()->count() > $before) {
                        $stats['mediaUpdated']++;
                    }
                }

                if ($updates !== []) {
                    $term->fill($updates);
                    $term->save();
                }
            } catch (\Throwable $e) {
                Log::warning('ConceptCompleteInfoService: term backfill failed', [
                    'term_id' => $term->id,
                    'term' => $term->term,
                    'error' => $e->getMessage(),
                ]);
                $stats['failed']++;
            }
        }

        return $stats;
    }

    /**
     * @return 'wiki'|'media'|'both'
     */
    public function normalizeMode(string $mode): string
    {
        $mode = strtolower(trim($mode));

        return match ($mode) {
            'wiki', 'wiki-only', 'wiki_only' => 'wiki',
            'media', 'media-only', 'media_only' => 'media',
            default => 'both',
        };
    }

    /**
     * Stop if the deadline has passed, or if a worst-case Wikimedia term
     * would run past it (sequential Http::timeout(12) calls).
     */
    protected function shouldStopBeforeTerm(?int $deadlineAt, string $mode): bool
    {
        if ($deadlineAt === null) {
            return false;
        }

        return time() + self::estimatedWorstCaseSeconds($mode) >= $deadlineAt;
    }

    /**
     * @param  list<QualifiedMedia>  $found
     */
    protected function persistMedia(Concept $concept, array $found): void
    {
        $position = (int) $concept->media()->max('position');
        $position = $concept->media()->exists() ? $position + 1 : 0;

        foreach ($found as $item) {
            if ($position >= 4) {
                break;
            }

            $record = ConceptMedia::query()->firstOrCreate(
                [
                    'concept_id' => $concept->id,
                    'url_sha256' => hash('sha256', $item->url),
                ],
                [
                    'url' => $item->url,
                    'kind' => $item->kind,
                    'license' => $item->license,
                    'source' => $item->source,
                    'position' => $position,
                ]
            );

            if ($record->wasRecentlyCreated) {
                $position++;
            }
        }
    }

    protected function primaryImageUrl(Concept $concept): ?string
    {
        $image = $concept->media()
            ->where('kind', 'image')
            ->orderBy('position')
            ->orderBy('id')
            ->first();

        $url = $image?->url;

        return is_string($url) && trim($url) !== '' ? $url : null;
    }

    protected function copyPrimaryToSiblingTerms(Concept $concept, int $exceptTermId, string $primary): void
    {
        ConceptTerm::query()
            ->where('concept_id', $concept->id)
            ->where('id', '!=', $exceptTermId)
            ->where(function ($query) {
                $query->whereNull('media_url')->orWhere('media_url', '');
            })
            ->update(['media_url' => $primary]);
    }

    protected function termNeedsMedia(ConceptTerm $term): bool
    {
        // The client still reads concept_terms.media_url. Existing concept_media
        // rows do not fill that column until this command copies the primary image.
        return $this->isBlank($term->media_url);
    }

    protected function isBlank(?string $value): bool
    {
        return $value === null || trim($value) === '';
    }
}
