<?php

namespace App\Console\Commands;

use App\Services\ConceptGraphPrefetchService;
use Illuminate\Console\Command;

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

        $provider = $this->option('provider') ? (string) $this->option('provider') : null;
        $model = $this->option('model') ? (string) $this->option('model') : null;

        $count = $this->option('count') !== null ? (int) $this->option('count') : null;

        $queue = (string) $this->option('queue');

        $seeds = $this->resolveSeeds();
        $n = (int) $this->option('n');
        $n = max(1, $n);

        $run = app(ConceptGraphPrefetchService::class)->dispatch(
            seeds: $seeds,
            nIfNoneProvided: $n,
            relatedCount: $count,
            complexity: $complexity,
            provider: $provider,
            model: $model,
            queue: $queue
        );

        $this->info("Enqueued {$run->seed_count} seed(s). run_uuid={$run->run_uuid} provider={$run->provider} model={$run->model} complexity={$run->complexity} queue={$run->queue}");

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
        $seeds = array_map(fn (string $s) => \App\Models\ConceptTerm::normalizeTerm($s), $seeds);
        $seeds = array_values(array_unique($seeds));

        return $seeds;
    }
}

