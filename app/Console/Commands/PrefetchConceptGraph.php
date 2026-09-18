<?php

namespace App\Console\Commands;

use App\Ai\Support\AiProviders;
use App\Services\ConceptGraphPrefetchService;
use Illuminate\Console\Command;
use InvalidArgumentException;

class PrefetchConceptGraph extends Command
{
    protected $signature = 'concepts:prefetch
        {--starts= : Comma-separated starting concepts (optional)}
        {--random-existing=0 : How many random existing concepts to use as starts}
        {--random-idea : Ask the generator to begin from its cold-start/random path}
        {--count=100 : Target concept count for this run}
        {--batch-size=10 : Concept count requested per queued batch}
        {--complexity= : Concept label complexity 1-5 (default from config)}
        {--provider= : AI provider (ollama|openrouter|openai|anthropic|gemini) (default from config)}
        {--model= : AI model (default from provider config)}
        {--queue=default : Queue name}';

    protected $description = 'Prefetch an interwoven concept graph into the database (async queued jobs).';

    public function handle(): int
    {
        $complexity = (int) ($this->option('complexity') ?? config('concepts.default_complexity', 2));
        $complexity = max(1, min(5, $complexity));

        $provider = $this->option('provider') ? (string) $this->option('provider') : null;
        $model = $this->option('model') ? (string) $this->option('model') : null;

        try {
            $provider = $provider !== null && $provider !== '' ? AiProviders::normalize($provider) : null;
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $count = max(1, (int) ($this->option('count') ?? 100));
        $batchSize = max(1, min(100, (int) ($this->option('batch-size') ?? 10)));

        $queue = (string) $this->option('queue');

        $starts = $this->resolveStarts();
        $randomExisting = max(0, (int) $this->option('random-existing'));
        $randomIdea = (bool) $this->option('random-idea');

        try {
            $run = app(ConceptGraphPrefetchService::class)->dispatch(
                starts: $starts,
                randomExisting: $randomExisting,
                randomIdea: $randomIdea,
                targetCount: $count,
                batchSize: $batchSize,
                complexity: $complexity,
                provider: $provider,
                model: $model,
                queue: $queue
            );
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Enqueued {$run->seed_count} start(s). run_uuid={$run->run_uuid} provider={$run->provider} model={$run->model} target={$run->related_count} batch_size={$batchSize} complexity={$run->complexity} queue={$run->queue}");

        return self::SUCCESS;
    }

    /**
     * @return list<string>
     */
    protected function resolveStarts(): array
    {
        $starts = [];

        $csv = $this->option('starts');
        if (is_string($csv) && trim($csv) !== '') {
            $parts = array_map('trim', explode(',', $csv));
            $parts = array_values(array_filter($parts, fn ($v) => $v !== ''));
            $starts = array_merge($starts, $parts);
        }

        // Normalize, unique.
        $starts = array_map(fn (string $s) => \App\Models\ConceptTerm::normalizeTerm($s), $starts);
        $starts = array_values(array_unique($starts));

        return $starts;
    }
}
