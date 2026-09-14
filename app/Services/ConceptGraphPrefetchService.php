<?php

namespace App\Services;

use App\Jobs\GenerateConceptGraphJob;
use App\Models\ConceptGraphRun;
use App\Models\ConceptGraphRunJob;
use App\Models\ConceptTerm;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class ConceptGraphPrefetchService
{
    /**
     * @param  list<string>  $starts
     */
    public function dispatch(
        array $starts,
        int $randomExisting,
        bool $randomIdea,
        int $targetCount,
        int $batchSize,
        int $complexity,
        ?string $provider,
        ?string $model,
        string $queue
    ): ConceptGraphRun {
        $complexity = max(1, min(5, $complexity));
        $targetCount = max(1, min(1000, $targetCount));
        $batchSize = max(1, min(100, $batchSize));

        $provider = $provider !== null && $provider !== '' ? $provider : (string) config('ai.default', 'ollama');
        $model = $model !== null && $model !== '' ? $model : (string) config('ai.models.text');

        $starts = array_map(fn (string $s) => ConceptTerm::normalizeTerm($s), $starts);
        $starts = array_values(array_unique(array_filter($starts, fn ($v) => $v !== '')));

        if ($randomExisting > 0) {
            $starts = array_merge($starts, $this->randomStarts($randomExisting));
        }

        $starts = array_values(array_unique($starts));

        if (count($starts) === 0 && ! $randomIdea) {
            $starts = $this->randomStarts(1);
        }

        $jobsToCreate = max(1, (int) ceil($targetCount / $batchSize));
        $runUuid = (string) Str::uuid();

        $run = ConceptGraphRun::query()->create([
            'run_uuid' => $runUuid,
            'provider' => $provider,
            'model' => $model,
            'complexity' => $complexity,
            'queue' => $queue,
            'seed_count' => count($starts) + ($randomIdea ? 1 : 0),
            'seeds' => [
                'starts' => $starts,
                'randomIdea' => $randomIdea,
                'targetCount' => $targetCount,
                'batchSize' => $batchSize,
            ],
            // `related_count` is legacy tinyint; keep it small and use `seeds.targetCount` for the real value.
            'related_count' => min(255, $targetCount),
            'dispatched_at' => now(),
        ]);

        foreach ($starts as $start) {
            $this->dispatchBatches(
                runUuid: $runUuid,
                start: $start,
                jobsToCreate: $jobsToCreate,
                batchSize: $batchSize,
                complexity: $complexity,
                provider: $provider,
                model: $model,
                queue: $queue
            );
        }

        if ($randomIdea) {
            $this->dispatchBatches(
                runUuid: $runUuid,
                start: null,
                jobsToCreate: $jobsToCreate,
                batchSize: $batchSize,
                complexity: $complexity,
                provider: $provider,
                model: $model,
                queue: $queue
            );
        }

        return $run;
    }

    protected function dispatchBatches(
        string $runUuid,
        ?string $start,
        int $jobsToCreate,
        int $batchSize,
        int $complexity,
        ?string $provider,
        ?string $model,
        string $queue
    ): void {
        $baseKey = $start ?? 'random-idea';

        for ($batch = 1; $batch <= $jobsToCreate; $batch++) {
            $jobKey = "{$baseKey}#{$batch}";

            ConceptGraphRunJob::query()->create([
                'run_uuid' => $runUuid,
                'seed' => $jobKey,
                'status' => 'pending',
                'attempts' => 0,
            ]);

            GenerateConceptGraphJob::dispatch(
                seed: $start,
                count: $batchSize,
                complexity: $complexity,
                provider: $provider,
                model: $model,
                runUuid: $runUuid,
                jobKey: $jobKey
            )->onQueue($queue);
        }
    }

    /**
     * @return list<string>
     */
    protected function randomStarts(int $n): array
    {
        $locale = (string) config('concepts.default_locale', 'en');
        $fromDb = ConceptTerm::query()
            ->where('locale', $locale)
            ->inRandomOrder()
            ->limit($n)
            ->pluck('term')
            ->all();

        if (count($fromDb) > 0) {
            return array_values(array_unique(array_map('strval', $fromDb)));
        }

        $defaults = config('concepts.default_seeds', []);
        if (is_array($defaults) && count($defaults) > 0) {
            $picked = [];
            for ($i = 0; $i < $n; $i++) {
                $picked[] = (string) Arr::random($defaults);
            }

            $picked = array_map(fn (string $s) => ConceptTerm::normalizeTerm($s), $picked);

            return array_values(array_unique($picked));
        }

        return ['creativity'];
    }
}
