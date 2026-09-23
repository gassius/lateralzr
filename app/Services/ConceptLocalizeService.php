<?php

namespace App\Services;

use App\Ai\Agents\ConceptLocalizeAgent;
use App\Ai\Support\AiRequestError;
use App\Models\Concept;
use App\Support\ConceptLocale;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Responses\StructuredAgentResponse;

class ConceptLocalizeService
{
    public const HTTP_TIMEOUT_SECONDS = 210;

    public const WRITE_BUDGET_SECONDS = 15;

    public const MAX_BATCH_SIZE = 20;

    public const DEFAULT_BATCH_SIZE = 10;

    public function __construct(
        protected ConceptCanonicalizer $canonicalizer,
    ) {}

    /**
     * Worst-case time for one structured localize call plus term writes.
     */
    public static function estimatedWorstCaseSeconds(): int
    {
        return self::HTTP_TIMEOUT_SECONDS + self::WRITE_BUDGET_SECONDS;
    }

    /**
     * Localize preferred terms from one locale onto another for the same concepts.
     *
     * @param  list<int>|null  $conceptIds  When set, only these concept IDs are processed (queued batches).
     * @return array{processed:int,created:int,skipped:int,failed:int,deferred:int,deferredConceptIds:list<int>}
     */
    public function localize(
        string $fromLocale = 'en',
        string $toLocale = 'es',
        ?int $limit = null,
        bool $missingOnly = true,
        int $batchSize = self::DEFAULT_BATCH_SIZE,
        ?object $agent = null,
        ?array $conceptIds = null,
        ?int $deadlineAt = null,
    ): array {
        $fromLocale = ConceptLocale::resolve($fromLocale);
        $toLocale = ConceptLocale::resolve($toLocale);

        if ($fromLocale === $toLocale) {
            throw new \InvalidArgumentException('--from and --to must be different locales.');
        }

        $batchSize = max(1, min(self::MAX_BATCH_SIZE, $batchSize));
        $stats = [
            'processed' => 0,
            'created' => 0,
            'skipped' => 0,
            'failed' => 0,
            'deferred' => 0,
            'deferredConceptIds' => [],
        ];

        $query = Concept::query()
            ->with(['terms'])
            ->whereHas('terms', fn ($q) => $q->where('locale', $fromLocale)->where('is_preferred', true))
            ->orderBy('id');

        if ($conceptIds !== null) {
            $ids = array_values(array_unique(array_map('intval', $conceptIds)));
            if ($ids === []) {
                return $stats;
            }
            $query->whereIn('id', $ids);
        } else {
            if ($missingOnly) {
                $query->whereDoesntHave('terms', fn ($q) => $q->where('locale', $toLocale));
            }

            if ($limit !== null) {
                $query->limit(max(1, $limit));
            }
        }

        $concepts = $query->get();
        if ($concepts->isEmpty()) {
            return $stats;
        }

        $chunks = $concepts->chunk($batchSize)->values();
        foreach ($chunks as $index => $chunk) {
            if ($this->shouldStopBeforeBatch($deadlineAt)) {
                $stats['deferredConceptIds'] = $chunks
                    ->slice($index)
                    ->reduce(function (array $ids, $remaining) {
                        foreach ($remaining as $concept) {
                            $ids[] = (int) $concept->id;
                        }

                        return $ids;
                    }, []);
                $stats['deferred'] = count($stats['deferredConceptIds']);
                Log::info('ConceptLocalizeService: stopping before worker timeout', [
                    'deferred' => $stats['deferred'],
                    'processed' => $stats['processed'],
                    'worst_case_seconds' => self::estimatedWorstCaseSeconds(),
                ]);

                break;
            }

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
                    'retryable' => AiRequestError::isRetryable($e),
                ]);

                throw $e;
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

                // Wiki lookup stays on concepts:complete-info so localisation does not search.
                // Media already stored on the source term is concept-level and can be copied.
                // Sibling batches (or a retry after timeout) can already own (locale, normalized_term).
                try {
                    $attached = $this->canonicalizer->attachLocalizedTerm(
                        concept: $concept,
                        locale: $toLocale,
                        term: $termLabel,
                        shortDescription: $shortDescription !== '' ? $shortDescription : null,
                        wikiUrl: null,
                        mediaUrl: $item['mediaUrl'] ?? null,
                        complexity: (int) ($item['complexity'] ?? config('concepts.default_complexity', 2)),
                    );
                } catch (UniqueConstraintViolationException $e) {
                    Log::info('ConceptLocalizeService: skipped locale_norm unique conflict', [
                        'concept_id' => $concept->id,
                        'locale' => $toLocale,
                        'term' => $termLabel,
                    ]);
                    $stats['skipped']++;

                    continue;
                }

                if ($attached === null) {
                    $stats['skipped']++;

                    continue;
                }

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

    protected function shouldStopBeforeBatch(?int $deadlineAt): bool
    {
        if ($deadlineAt === null) {
            return false;
        }

        return time() + self::estimatedWorstCaseSeconds() >= $deadlineAt;
    }
}
