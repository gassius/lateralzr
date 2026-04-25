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
     * @param  list<string>  $seeds
     */
    public function dispatch(
        array $seeds,
        int $nIfNoneProvided,
        ?int $relatedCount,
        int $complexity,
        ?string $provider,
        ?string $model,
        string $queue
    ): ConceptGraphRun {
        $complexity = max(1, min(5, $complexity));

        $provider = $provider !== null && $provider !== '' ? $provider : (string) config('ai.default', 'ollama');
        $model = $model !== null && $model !== '' ? $model : (string) config('ai.models.text');

        if ($relatedCount !== null) {
            $relatedCount = max(1, min(10, $relatedCount));
        }

        $seeds = array_map(fn (string $s) => ConceptTerm::normalizeTerm($s), $seeds);
        $seeds = array_values(array_unique(array_filter($seeds, fn ($v) => $v !== '')));

        if (count($seeds) === 0) {
            $seeds = $this->randomSeeds(max(1, $nIfNoneProvided));
        }

        $runUuid = (string) Str::uuid();

        $run = ConceptGraphRun::query()->create([
            'run_uuid' => $runUuid,
            'provider' => $provider,
            'model' => $model,
            'complexity' => $complexity,
            'queue' => $queue,
            'seed_count' => count($seeds),
            'seeds' => $seeds,
            'related_count' => $relatedCount,
            'dispatched_at' => now(),
        ]);

        foreach ($seeds as $seed) {
            ConceptGraphRunJob::query()->create([
                'run_uuid' => $runUuid,
                'seed' => $seed,
                'status' => 'pending',
                'attempts' => 0,
            ]);

            GenerateConceptGraphJob::dispatch(
                seed: $seed,
                count: $relatedCount,
                complexity: $complexity,
                provider: $provider,
                model: $model,
                runUuid: $runUuid
            )->onQueue($queue);
        }

        return $run;
    }

    /**
     * @return list<string>
     */
    protected function randomSeeds(int $n): array
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

