<?php

namespace App\Services;

use App\Jobs\CompleteConceptInfoBatchJob;
use App\Models\ConceptGraphRun;
use App\Models\ConceptGraphRunJob;
use App\Models\ConceptTerm;
use App\Support\ConceptLocale;
use Illuminate\Support\Str;
use InvalidArgumentException;

class ConceptCompleteInfoDispatchService
{
    public function __construct(
        protected ConceptCompleteInfoService $completeInfoService,
    ) {}

    /**
     * Enqueue complete-info work as queued batches, tracked on concept_graph_runs (type=complete_info).
     *
     * @param  'wiki'|'media'|'both'|null  $mode
     */
    public function dispatch(
        ?string $locale = null,
        string $mode = 'both',
        ?int $limit = null,
        int $batchSize = 20,
        string $queue = 'default',
    ): ConceptGraphRun {
        $mode = $this->completeInfoService->normalizeMode($mode);
        $batchSize = max(1, min(50, $batchSize));

        $resolvedLocale = null;
        if ($locale !== null && trim($locale) !== '') {
            $normalized = strtolower(trim($locale));
            $primary = explode('-', $normalized, 2)[0];
            $supported = ConceptLocale::supported();
            if (! in_array($normalized, $supported, true) && ! in_array($primary, $supported, true)) {
                throw new InvalidArgumentException(
                    'Locale must be in supported list: '.implode(', ', $supported)
                );
            }
            $resolvedLocale = ConceptLocale::resolve($normalized);
        }

        $termIds = $this->matchingTermIds($resolvedLocale, $mode, $limit);
        $targetCount = count($termIds);
        $runUuid = (string) Str::uuid();

        $batches = [];
        $chunkIndex = 0;
        foreach (array_chunk($termIds, $batchSize) as $chunk) {
            $chunkIndex++;
            $batches["complete-info#{$chunkIndex}"] = array_values(array_map('intval', $chunk));
        }

        $run = ConceptGraphRun::query()->create([
            'run_uuid' => $runUuid,
            'type' => ConceptGraphRun::TYPE_COMPLETE_INFO,
            'provider' => null,
            'model' => null,
            'complexity' => (int) config('concepts.default_complexity', 2),
            'queue' => $queue,
            'seed_count' => count($batches),
            'seeds' => [
                'locale' => $resolvedLocale,
                'mode' => $mode,
                'batchSize' => $batchSize,
                'limit' => $limit,
                'targetCount' => $targetCount,
                'batches' => $batches,
            ],
            'related_count' => min(255, $targetCount),
            'dispatched_at' => now(),
        ]);

        foreach ($batches as $jobKey => $ids) {
            ConceptGraphRunJob::query()->create([
                'run_uuid' => $runUuid,
                'seed' => $jobKey,
                'status' => 'pending',
                'attempts' => 0,
            ]);

            CompleteConceptInfoBatchJob::dispatch(
                termIds: $ids,
                mode: $mode,
                runUuid: $runUuid,
                jobKey: $jobKey,
            )->onQueue($queue);
        }

        return $run;
    }

    /**
     * @param  'wiki'|'media'|'both'  $mode
     * @return list<int>
     */
    public function matchingTermIds(?string $locale, string $mode, ?int $limit): array
    {
        $mode = $this->completeInfoService->normalizeMode($mode);

        $query = ConceptTerm::query()->orderBy('id');

        if ($locale !== null && $locale !== '') {
            $query->where('locale', ConceptLocale::resolve($locale));
        }

        $query->where(function ($q) use ($mode) {
            if ($mode === 'wiki') {
                $q->where(function ($inner) {
                    $inner->whereNull('wiki_url')->orWhere('wiki_url', '');
                });
            } elseif ($mode === 'media') {
                $q->where(function ($inner) {
                    $this->whereMissingMedia($inner);
                });
            } else {
                $q->where(function ($inner) {
                    $inner->where(function ($wiki) {
                        $wiki->whereNull('wiki_url')->orWhere('wiki_url', '');
                    })->orWhere(function ($media) {
                        $this->whereMissingMedia($media);
                    });
                });
            }
        });

        if ($limit !== null) {
            $query->limit(max(1, $limit));
        }

        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /**
     * A term still needs its display URL when media_url is blank, even if concept_media
     * rows already exist. The client reads media_url, copied from the primary image.
     */
    protected function whereMissingMedia(\Illuminate\Database\Eloquent\Builder $query): void
    {
        $query->where(function ($blank) {
            $blank->whereNull('media_url')->orWhere('media_url', '');
        });
    }
}
