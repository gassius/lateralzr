<?php

namespace App\Services;

use App\Ai\Support\AiProviders;
use App\Jobs\LocalizeConceptBatchJob;
use App\Models\Concept;
use App\Models\ConceptGraphRun;
use App\Models\ConceptGraphRunJob;
use App\Support\ConceptLocale;
use Illuminate\Support\Str;
use InvalidArgumentException;

class ConceptLocalizeDispatchService
{
    /**
     * Enqueue localize work as queued batches, tracked on concept_graph_runs (type=localize).
     */
    public function dispatch(
        string $fromLocale = 'en',
        string $toLocale = 'es',
        ?int $limit = null,
        bool $missingOnly = true,
        int $batchSize = ConceptLocalizeService::DEFAULT_BATCH_SIZE,
        ?string $provider = null,
        ?string $model = null,
        string $queue = 'default',
    ): ConceptGraphRun {
        $fromLocale = ConceptLocale::resolve($fromLocale);
        $toLocale = ConceptLocale::resolve($toLocale);

        if ($fromLocale === $toLocale) {
            throw new InvalidArgumentException('--from and --to must be different locales.');
        }

        $batchSize = max(1, min(ConceptLocalizeService::MAX_BATCH_SIZE, $batchSize));
        $provider = AiProviders::normalize($provider);
        $model = $model !== null && $model !== '' ? $model : AiProviders::defaultTextModel($provider);

        $conceptIds = $this->matchingConceptIds($fromLocale, $toLocale, $missingOnly, $limit);
        $targetCount = count($conceptIds);
        $runUuid = (string) Str::uuid();

        $batches = [];
        $chunkIndex = 0;
        foreach (array_chunk($conceptIds, $batchSize) as $chunk) {
            $chunkIndex++;
            $batches["localize#{$chunkIndex}"] = array_values(array_map('intval', $chunk));
        }

        // Always create a run row so empty targets are visible in admin; no jobs if nothing to do.
        $run = ConceptGraphRun::query()->create([
            'run_uuid' => $runUuid,
            'type' => ConceptGraphRun::TYPE_LOCALIZE,
            'provider' => $provider,
            'model' => $model,
            'complexity' => (int) config('concepts.default_complexity', 2),
            'queue' => $queue,
            'seed_count' => count($batches),
            'seeds' => [
                'from' => $fromLocale,
                'to' => $toLocale,
                'missingOnly' => $missingOnly,
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

            LocalizeConceptBatchJob::dispatch(
                conceptIds: $ids,
                fromLocale: $fromLocale,
                toLocale: $toLocale,
                missingOnly: $missingOnly,
                provider: $provider,
                model: $model,
                runUuid: $runUuid,
                jobKey: $jobKey,
            )->onQueue($queue);
        }

        return $run;
    }

    /**
     * @return list<int>
     */
    public function matchingConceptIds(
        string $fromLocale,
        string $toLocale,
        bool $missingOnly,
        ?int $limit,
    ): array {
        $fromLocale = ConceptLocale::resolve($fromLocale);
        $toLocale = ConceptLocale::resolve($toLocale);

        $query = Concept::query()
            ->whereHas('terms', fn ($q) => $q->where('locale', $fromLocale)->where('is_preferred', true))
            ->orderBy('id');

        if ($missingOnly) {
            $query->whereDoesntHave('terms', fn ($q) => $q->where('locale', $toLocale));
        }

        if ($limit !== null) {
            $query->limit(max(1, $limit));
        }

        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}
