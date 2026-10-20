<?php

namespace App\Console\Commands;

use App\Ai\Support\AiProviders;
use App\Services\ConceptPipeline\ConceptPipelineDispatchService;
use Illuminate\Console\Command;
use InvalidArgumentException;

class GenerateConceptPipeline extends Command
{
    protected $signature = 'concepts:generate
        {--concept= : Existing or new starting concept}
        {--concepts= : Comma-separated starting concepts (some, none, or all may exist)}
        {--random=0 : How many random existing concepts to use as starts}
        {--count=10 : Related concepts requested per generate job}
        {--complexity=3 : Concept label complexity 1-5}
        {--provider= : AI provider (ollama|openrouter|openai|anthropic|gemini) (default from config)}
        {--model= : AI model (default from provider config)}
        {--depth=1 : Expansion depth (1-3)}
        {--locales= : Comma-separated locales to localise into (default: supported except the default locale)}
        {--queue=default : Queue name}';

    protected $description = 'Generate, localise, then complete-info a concept graph as small per-node queued jobs.';

    public function handle(ConceptPipelineDispatchService $pipeline): int
    {
        $concepts = $this->resolveConcepts();
        $random = max(0, (int) $this->option('random'));
        $count = (int) $this->option('count');
        $complexity = (int) $this->option('complexity');
        $depth = (int) $this->option('depth');
        $queue = (string) $this->option('queue');
        $provider = $this->option('provider') ? (string) $this->option('provider') : null;
        $model = $this->option('model') ? (string) $this->option('model') : null;
        $locales = $this->resolveLocalesOption();

        try {
            if ($provider !== null && $provider !== '') {
                AiProviders::normalize($provider);
            }

            $run = $pipeline->dispatch(
                concepts: $concepts,
                random: $random,
                count: $count,
                complexity: $complexity,
                depth: $depth,
                locales: $locales,
                provider: $provider,
                model: $model,
                queue: $queue,
            );
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $nodeCount = $run->pipelineNodes()->count();
        $localesLabel = implode(',', data_get($run->seeds, 'locales', []) ?: []);
        $this->info("Enqueued pipeline. run_uuid={$run->run_uuid} seeds={$run->seed_count} nodes={$nodeCount} count={$run->target_count} complexity={$run->complexity} depth=".data_get($run->seeds, 'depth')." locales={$localesLabel} provider={$run->provider} model={$run->model} queue={$run->queue}");

        return self::SUCCESS;
    }

    /**
     * @return list<string>
     */
    protected function resolveConcepts(): array
    {
        $concepts = [];

        $single = $this->option('concept');
        if (is_string($single) && trim($single) !== '') {
            $concepts[] = trim($single);
        }

        $csv = $this->option('concepts');
        if (is_string($csv) && trim($csv) !== '') {
            foreach (explode(',', $csv) as $part) {
                $part = trim($part);
                if ($part !== '') {
                    $concepts[] = $part;
                }
            }
        }

        return $concepts;
    }

    /**
     * @return list<string>|null
     */
    protected function resolveLocalesOption(): ?array
    {
        $raw = $this->option('locales');
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        $locales = [];
        foreach (explode(',', $raw) as $part) {
            $part = trim($part);
            if ($part !== '') {
                $locales[] = $part;
            }
        }

        return $locales;
    }
}
