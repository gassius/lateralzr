<?php

namespace App\Console\Commands;

use App\Services\ConceptPromptEvalService;
use Illuminate\Console\Command;

class EvalConceptPrompts extends Command
{
    protected $signature = 'concepts:eval-prompts
        {--seed= : Single starting concept}
        {--seeds= : Comma-separated starting concepts (default: Ball,Harbor,Kyoto)}
        {--count=3 : Concepts requested per seed (including the start)}
        {--complexity= : Target complexity 1-5 (default from config)}
        {--iterations=1 : How many times to generate each seed}';

    protected $description = 'Report laterality and complexity distributions plus count hit rate for a seed set (uses a faked LLM in tests).';

    public function handle(ConceptPromptEvalService $eval): int
    {
        $seeds = $this->resolveSeeds();
        $count = max(3, (int) $this->option('count'));
        $complexity = $this->option('complexity') !== null && $this->option('complexity') !== ''
            ? max(1, min(5, (int) $this->option('complexity')))
            : (int) config('concepts.default_complexity', 3);
        $iterations = max(1, (int) $this->option('iterations'));

        $report = $eval->run(
            seeds: $seeds,
            count: $count,
            complexity: $complexity,
            iterations: $iterations,
        );

        $this->table(
            ['seed', 'requested', 'returned', 'count_hit', 'complexity_mean', 'laterality_min', 'laterality_max', 'laterality_in_band', 'complexity_in_tol'],
            $report['rows'],
        );

        $this->newLine();
        $this->info('count hit rate: '.$report['summary']['count_hit_rate']);
        $this->info('laterality in band: '.$report['summary']['laterality_in_band_rate']);
        $this->info('complexity within ±'.$report['summary']['complexity_tolerance'].': '.$report['summary']['complexity_in_tol_rate']);

        return self::SUCCESS;
    }

    /**
     * @return list<string>
     */
    protected function resolveSeeds(): array
    {
        $single = $this->option('seed');
        if (is_string($single) && trim($single) !== '') {
            return [trim($single)];
        }

        $csv = $this->option('seeds');
        if (is_string($csv) && trim($csv) !== '') {
            return array_values(array_filter(array_map('trim', explode(',', $csv))));
        }

        return ConceptPromptEvalService::DEFAULT_SEEDS;
    }
}
