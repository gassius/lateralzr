<?php

namespace App\Services\ScheduledTasks;

use App\Models\ScheduledTask;
use App\Services\ConceptCompleteInfoDispatchService;
use App\Services\ConceptLocalizeDispatchService;

class FillMissingHandler implements ScheduledTaskHandler
{
    public function __construct(
        protected ConceptLocalizeDispatchService $localize,
        protected ConceptCompleteInfoDispatchService $completeInfo,
    ) {}

    public function handle(ScheduledTask $task): array
    {
        $cap = max(1, (int) $task->per_run_cap);
        $locale = strtolower(trim((string) $task->option('locale', 'es')));
        $from = strtolower(trim((string) $task->option('from', 'en')));
        $fillLocale = (bool) $task->option('fill_locale', true);
        $fillImages = (bool) $task->option('fill_images', true);

        $runUuids = [];
        $localeCount = 0;
        $mediaCount = 0;
        $remaining = $cap;

        if ($fillLocale && $remaining > 0) {
            $localeIds = $this->localize->matchingConceptIds($from, $locale, true, $remaining);
            if ($localeIds !== []) {
                $run = $this->localize->dispatch(
                    fromLocale: $from,
                    toLocale: $locale,
                    limit: count($localeIds),
                    missingOnly: true,
                );
                $localeCount = (int) data_get($run->seeds, 'targetCount', count($localeIds));
                $runUuids[] = $run->run_uuid;
                $remaining = max(0, $cap - $localeCount);
            }
        }

        if ($fillImages && $remaining > 0) {
            $mediaIds = $this->completeInfo->matchingTermIds(null, 'media', $remaining);
            if ($mediaIds !== []) {
                $run = $this->completeInfo->dispatch(
                    locale: null,
                    mode: 'media',
                    limit: count($mediaIds),
                );
                $mediaCount = (int) data_get($run->seeds, 'targetCount', count($mediaIds));
                $runUuids[] = $run->run_uuid;
            }
        }

        return [
            'items_processed' => $localeCount + $mediaCount,
            'pipeline_run_uuid' => $runUuids[0] ?? null,
            'details' => [
                'locale' => $locale,
                'from' => $from,
                'locale_count' => $localeCount,
                'media_count' => $mediaCount,
                'run_uuids' => $runUuids,
            ],
        ];
    }
}
