<?php

namespace App\Console\Commands;

use App\Jobs\GenerateConceptGraphJob;
use App\Models\ConceptTerm;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class PrefetchConceptGraph extends Command
{
    protected $signature = 'concepts:prefetch
        {--seed= : Seed concept to generate from (optional)}
        {--seeds= : Comma-separated seed concepts (optional)}
        {--n=25 : How many seeds to enqueue if none provided}
        {--count= : Related concepts per seed (default: 3-5 per agent)}
        {--complexity= : Complexity 1-5 (default from config)}
        {--provider= : AI provider (ollama|openai|anthropic|gemini) (default from config)}
        {--model= : AI model (default from config)}
        {--queue=default : Queue name}';

    protected $description = 'Prefetch concept relationships into the database (async queued jobs).';

    public function handle(): int
    {
        $complexity = (int) ($this->option('complexity') ?? config('concepts.default_complexity', 2));
        $complexity = max(1, min(5, $complexity));

        $provider = $this->option('provider') ? (string) $this->option('provider') : (string) config('ai.default', 'ollama');
        $model = $this->option('model') ? (string) $this->option('model') : (string) config('ai.models.text');

        $count = $this->option('count') !== null ? (int) $this->option('count') : null;
        if ($count !== null) {
            $count = max(1, min(10, $count));
        }

        $queue = (string) $this->option('queue');
        $runUuid = (string) Str::uuid();

        $seeds = $this->resolveSeeds();
        $n = (int) $this->option('n');
        $n = max(1, $n);

        if (count($seeds) === 0) {
            $seeds = $this->randomSeeds($n);
        }

        $this->info("Enqueuing ".count($seeds)." seed(s). run_uuid={$runUuid} provider={$provider} model={$model} complexity={$complexity}");

        foreach ($seeds as $seed) {
            GenerateConceptGraphJob::dispatch(
                seed: $seed,
                count: $count,
                complexity: $complexity,
                provider: $provider,
                model: $model,
                runUuid: $runUuid
            )->onQueue($queue);
        }

        return self::SUCCESS;
    }

    /**
     * @return list<string>
     */
    protected function resolveSeeds(): array
    {
        $seeds = [];

        $single = $this->option('seed');
        if (is_string($single) && trim($single) !== '') {
            $seeds[] = trim($single);
        }

        $csv = $this->option('seeds');
        if (is_string($csv) && trim($csv) !== '') {
            $parts = array_map('trim', explode(',', $csv));
            $parts = array_values(array_filter($parts, fn ($v) => $v !== ''));
            $seeds = array_merge($seeds, $parts);
        }

        // Normalize, unique.
        $seeds = array_map(fn (string $s) => ConceptTerm::normalizeTerm($s), $seeds);
        $seeds = array_values(array_unique($seeds));

        return $seeds;
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

