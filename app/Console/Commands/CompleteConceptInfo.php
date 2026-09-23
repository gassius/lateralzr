<?php

namespace App\Console\Commands;

use App\Services\ConceptCompleteInfoDispatchService;
use App\Services\ConceptCompleteInfoService;
use App\Support\ConceptLocale;
use Illuminate\Console\Command;
use InvalidArgumentException;

class CompleteConceptInfo extends Command
{
    protected $signature = 'concepts:complete-info
        {--locale= : Locale to backfill (omit for all supported locales)}
        {--wiki-only : Only fill missing Wikipedia URLs}
        {--media-only : Only fill missing Wikimedia media URLs}
        {--limit= : Max terms to process}
        {--batch-size=10 : Terms per queued job}
        {--queue=default : Queue name for async dispatch}
        {--sync : Run inline instead of enqueueing worker jobs}';

    protected $description = 'Backfill missing localized Wikipedia URLs and CC0/public-domain media. Separate from prefetch and localisation.';

    public function handle(
        ConceptCompleteInfoService $service,
        ConceptCompleteInfoDispatchService $dispatch,
    ): int {
        $localeRaw = $this->option('locale');
        $locale = null;
        if (is_string($localeRaw) && trim($localeRaw) !== '') {
            $normalized = strtolower(trim($localeRaw));
            $primary = explode('-', $normalized, 2)[0];
            $supported = ConceptLocale::supported();
            if (! in_array($normalized, $supported, true) && ! in_array($primary, $supported, true)) {
                $this->error('Locale must be in supported list: '.implode(', ', $supported));

                return self::FAILURE;
            }
            $locale = ConceptLocale::resolve($normalized);
        }

        $wikiOnly = (bool) $this->option('wiki-only');
        $mediaOnly = (bool) $this->option('media-only');
        if ($wikiOnly && $mediaOnly) {
            $this->error('Use only one of --wiki-only or --media-only (or neither for both).');

            return self::FAILURE;
        }

        $mode = $wikiOnly ? 'wiki' : ($mediaOnly ? 'media' : 'both');

        $limit = $this->option('limit');
        $limit = $limit !== null && $limit !== '' ? (int) $limit : null;
        $batchSize = (int) ($this->option('batch-size') ?? 20);
        $queue = (string) $this->option('queue');

        if (! (bool) $this->option('sync')) {
            try {
                $run = $dispatch->dispatch(
                    locale: $locale,
                    mode: $mode,
                    limit: $limit,
                    batchSize: $batchSize,
                    queue: $queue,
                );
            } catch (InvalidArgumentException $e) {
                $this->error($e->getMessage());

                return self::FAILURE;
            }

            $target = (int) data_get($run->seeds, 'targetCount', 0);
            $localeLabel = $locale ?? 'all';
            $this->info("Enqueued complete-info mode={$mode} locale={$localeLabel}. run_uuid={$run->run_uuid} batches={$run->seed_count} target={$target} queue={$run->queue}");

            return self::SUCCESS;
        }

        $termIds = $dispatch->matchingTermIds($locale, $mode, $limit);
        $localeLabel = $locale ?? 'all';
        $this->info('Completing info sync mode='.$mode.' locale='.$localeLabel.' terms='.count($termIds));

        $stats = $service->complete($termIds, $mode);

        $deferred = (int) ($stats['deferred'] ?? 0);
        $this->info("Done. processed={$stats['processed']} wikiUpdated={$stats['wikiUpdated']} mediaUpdated={$stats['mediaUpdated']} skipped={$stats['skipped']} failed={$stats['failed']} deferred={$deferred}");

        return $stats['failed'] > 0 && $stats['wikiUpdated'] === 0 && $stats['mediaUpdated'] === 0
            ? self::FAILURE
            : self::SUCCESS;
    }
}
