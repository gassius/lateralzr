<?php

namespace App\Services;

use App\Ai\Agents\ConceptLocalizeAgent;
use App\Ai\Tools\WikipediaSearchTool;
use App\Models\Concept;
use App\Support\ConceptLocale;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Responses\StructuredAgentResponse;

class ConceptLocalizeService
{
    public function __construct(
        protected ConceptCanonicalizer $canonicalizer,
        protected WikipediaSearchTool $wikipediaTool,
    ) {}

    /**
     * Localize preferred terms from one locale onto another for the same concepts.
     *
     * @return array{processed:int,created:int,skipped:int,failed:int}
     */
    public function localize(
        string $fromLocale = 'en',
        string $toLocale = 'es',
        ?int $limit = null,
        bool $missingOnly = true,
        int $batchSize = 20,
        ?object $agent = null,
    ): array {
        $fromLocale = ConceptLocale::resolve($fromLocale);
        $toLocale = ConceptLocale::resolve($toLocale);

        if ($fromLocale === $toLocale) {
            throw new \InvalidArgumentException('--from and --to must be different locales.');
        }

        $batchSize = max(1, min(50, $batchSize));
        $stats = ['processed' => 0, 'created' => 0, 'skipped' => 0, 'failed' => 0];

        $query = Concept::query()
            ->with(['terms'])
            ->whereHas('terms', fn ($q) => $q->where('locale', $fromLocale)->where('is_preferred', true))
            ->orderBy('id');

        if ($missingOnly) {
            $query->whereDoesntHave('terms', fn ($q) => $q->where('locale', $toLocale));
        }

        if ($limit !== null) {
            $query->limit(max(1, $limit));
        }

        $concepts = $query->get();
        if ($concepts->isEmpty()) {
            return $stats;
        }

        foreach ($concepts->chunk($batchSize) as $chunk) {
            $payload = $chunk->map(function (Concept $concept) use ($fromLocale) {
                $term = $concept->termForLocale($fromLocale, fallback: false);
                if ($term === null) {
                    return null;
                }

                return [
                    'id' => (int) $concept->id,
                    'term' => (string) $term->term,
                    'shortDescription' => (string) ($term->short_description ?? ''),
                    'complexity' => (int) ($term->complexity ?? config('concepts.default_complexity', 2)),
                    'mediaUrl' => $term->media_url,
                ];
            })->filter()->values();

            if ($payload->isEmpty()) {
                continue;
            }

            try {
                $translations = $this->translateBatch($payload, $fromLocale, $toLocale, $agent);
            } catch (\Throwable $e) {
                Log::warning('ConceptLocalizeService: batch translation failed', [
                    'from' => $fromLocale,
                    'to' => $toLocale,
                    'error' => $e->getMessage(),
                ]);
                $stats['failed'] += $payload->count();

                continue;
            }

            $byId = $translations->keyBy('id');

            foreach ($payload as $item) {
                $stats['processed']++;
                $concept = $chunk->firstWhere('id', $item['id']);
                if (! $concept instanceof Concept) {
                    $stats['failed']++;

                    continue;
                }

                if ($missingOnly && $concept->termForLocale($toLocale, fallback: false) !== null) {
                    $stats['skipped']++;

                    continue;
                }

                $translated = $byId->get($item['id']);
                if (! is_array($translated) || trim((string) ($translated['term'] ?? '')) === '') {
                    $stats['failed']++;

                    continue;
                }

                $termLabel = trim((string) $translated['term']);
                $shortDescription = trim((string) ($translated['shortDescription'] ?? ''));
                if ($shortDescription === '') {
                    $shortDescription = (string) ($item['shortDescription'] ?? '');
                }

                $wikiUrl = $this->wikipediaTool->lookup($termLabel, $shortDescription, $toLocale);
                $wikiUrl = $wikiUrl !== '' ? $wikiUrl : null;

                $this->canonicalizer->attachLocalizedTerm(
                    concept: $concept,
                    locale: $toLocale,
                    term: $termLabel,
                    shortDescription: $shortDescription !== '' ? $shortDescription : null,
                    wikiUrl: $wikiUrl,
                    mediaUrl: $item['mediaUrl'] ?? null,
                    complexity: (int) ($item['complexity'] ?? config('concepts.default_complexity', 2)),
                );

                $stats['created']++;
            }
        }

        return $stats;
    }

    /**
     * @param  Collection<int, array{id:int,term:string,shortDescription:string,complexity:int,mediaUrl:?string}>  $payload
     * @return Collection<int, array{id:int,term:string,shortDescription:string}>
     */
    protected function translateBatch(
        Collection $payload,
        string $fromLocale,
        string $toLocale,
        ?object $agent = null
    ): Collection {
        $agent = $agent ?? new ConceptLocalizeAgent($fromLocale, $toLocale);

        $lines = $payload->map(function (array $item) {
            $desc = str_replace(["\n", "\r"], ' ', $item['shortDescription']);

            return "- id={$item['id']}; term=".json_encode($item['term'], JSON_UNESCAPED_UNICODE).'; shortDescription='.json_encode($desc, JSON_UNESCAPED_UNICODE);
        })->implode("\n");

        $prompt = <<<PROMPT
Localize these concept terms from {$fromLocale} to {$toLocale}.

{$lines}
PROMPT;

        $response = $agent->prompt($prompt);

        if (! $response instanceof StructuredAgentResponse) {
            throw new \RuntimeException('Expected structured response from localize agent');
        }

        $data = $response->toArray();
        $translations = $data['translations'] ?? [];
        if (! is_array($translations)) {
            return collect();
        }

        return collect($translations)
            ->filter(fn ($row) => is_array($row) && isset($row['id']))
            ->map(fn (array $row) => [
                'id' => (int) $row['id'],
                'term' => trim((string) ($row['term'] ?? '')),
                'shortDescription' => trim((string) ($row['shortDescription'] ?? '')),
            ])
            ->values();
    }
}
