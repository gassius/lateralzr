<?php

namespace App\Services;

use App\Ai\Tools\WikimediaCommonsSearchTool;
use App\Ai\Tools\WikipediaSearchTool;
use App\Models\ConceptTerm;
use Illuminate\Support\Facades\Log;

class ConceptCompleteInfoService
{
    public function __construct(
        protected WikipediaSearchTool $wikipediaTool,
        protected WikimediaCommonsSearchTool $commonsTool,
    ) {}

    /**
     * Backfill missing wiki_url / media_url on existing concept terms.
     *
     * @param  list<int>  $termIds
     * @param  'wiki'|'media'|'both'  $mode
     * @return array{processed:int,wikiUpdated:int,mediaUpdated:int,skipped:int,failed:int}
     */
    public function complete(array $termIds, string $mode = 'both'): array
    {
        $mode = $this->normalizeMode($mode);
        $stats = [
            'processed' => 0,
            'wikiUpdated' => 0,
            'mediaUpdated' => 0,
            'skipped' => 0,
            'failed' => 0,
        ];

        $ids = array_values(array_unique(array_map('intval', $termIds)));
        if ($ids === []) {
            return $stats;
        }

        $terms = ConceptTerm::query()
            ->whereIn('id', $ids)
            ->orderBy('id')
            ->get();

        foreach ($terms as $term) {
            $stats['processed']++;

            $needWiki = in_array($mode, ['wiki', 'both'], true) && $this->isBlank($term->wiki_url);
            $needMedia = in_array($mode, ['media', 'both'], true) && $this->isBlank($term->media_url);

            if (! $needWiki && ! $needMedia) {
                $stats['skipped']++;

                continue;
            }

            try {
                $updates = [];
                $label = (string) $term->term;
                $description = (string) ($term->short_description ?? '');

                if ($needWiki) {
                    $wikiUrl = $this->wikipediaTool->lookup($label, $description, (string) $term->locale);
                    if ($wikiUrl !== '') {
                        $updates['wiki_url'] = $wikiUrl;
                        $stats['wikiUpdated']++;
                    }
                }

                if ($needMedia) {
                    $mediaUrl = $this->commonsTool->lookup($label, $description);
                    if ($mediaUrl !== '') {
                        $updates['media_url'] = $mediaUrl;
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

    protected function isBlank(?string $value): bool
    {
        return $value === null || trim($value) === '';
    }
}
