<?php

namespace App\Console\Commands;

use App\Ai\Support\AiProviders;
use App\Services\ConceptLocalizeService;
use App\Support\ConceptLocale;
use Illuminate\Console\Command;
use InvalidArgumentException;

class LocalizeConceptTerms extends Command
{
    protected $signature = 'concepts:localize
        {--from=en : Source locale (preferred terms)}
        {--to=es : Target locale to create}
        {--limit= : Max concepts to process}
        {--batch-size=20 : Concepts per AI translation batch}
        {--missing-only : Only concepts missing the target locale (default true)}
        {--all : Also overwrite/refresh existing target locale terms}
        {--provider= : AI provider override}
        {--model= : AI model override}';

    protected $description = 'Localize existing concept terms from one locale into another (same canonical concept).';

    public function handle(ConceptLocalizeService $service): int
    {
        $fromRaw = strtolower(trim((string) $this->option('from')));
        $toRaw = strtolower(trim((string) $this->option('to')));
        $supported = ConceptLocale::supported();

        if (! in_array($fromRaw, $supported, true) || ! in_array($toRaw, $supported, true)) {
            $this->error('Locales must be in supported list: '.implode(', ', $supported));

            return self::FAILURE;
        }

        $from = ConceptLocale::resolve($fromRaw);
        $to = ConceptLocale::resolve($toRaw);

        if ($from === $to) {
            $this->error('--from and --to must differ.');

            return self::FAILURE;
        }

        $provider = $this->option('provider') ? (string) $this->option('provider') : null;
        $model = $this->option('model') ? (string) $this->option('model') : null;

        try {
            if ($provider !== null && $provider !== '') {
                AiProviders::normalize($provider);
            }
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        if ($provider !== null && $provider !== '') {
            config(['ai.default' => $provider]);
        }
        if ($model !== null && $model !== '') {
            // Provider-specific model env keys are read via AiProviders; set text model default.
            config(['ai.models.text' => $model]);
        }

        $limit = $this->option('limit');
        $limit = $limit !== null && $limit !== '' ? (int) $limit : null;
        $missingOnly = ! (bool) $this->option('all');
        if ($this->option('missing-only')) {
            $missingOnly = true;
        }

        $this->info("Localizing concepts {$from} → {$to} (missing_only=".($missingOnly ? 'yes' : 'no').')');

        try {
            $stats = $service->localize(
                fromLocale: $from,
                toLocale: $to,
                limit: $limit,
                missingOnly: $missingOnly,
                batchSize: (int) ($this->option('batch-size') ?? 20),
            );
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Done. processed={$stats['processed']} created={$stats['created']} skipped={$stats['skipped']} failed={$stats['failed']}");

        return $stats['failed'] > 0 && $stats['created'] === 0 ? self::FAILURE : self::SUCCESS;
    }
}
