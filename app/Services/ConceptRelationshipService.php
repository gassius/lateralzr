<?php

namespace App\Services;

use App\Ai\Agents\ConceptsOnlyAgent;
use App\Ai\Support\AiPrompt;
use App\Ai\Support\LateralConceptAgentInstructions;
use App\Jobs\GenerateConceptGraphJob;
use App\Models\ConceptTerm;
use App\Support\ConceptSeed;
use App\Support\Laterality;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Responses\StructuredAgentResponse;

class ConceptRelationshipService
{
    public const MAX_GENERATION_ATTEMPTS = 3;

    public function __construct(
        protected ConceptGenerationSettings $settings,
    ) {}

    /**
     * Generate an interwoven concept graph from a starting concept.
     * Wiki and media URLs are not looked up here. Already stored URLs are copied onto the response;
     * missing URLs stay empty until `concepts:complete-info` runs.
     * When $startConcept is null or empty, a random starting concept is chosen (from DB or config).
     *
     * Edges outside the configured laterality band are dropped. Concept complexity may differ
     * from the request by ± GeneratedGraphConstraints::COMPLEXITY_TOLERANCE. Shortfalls are
     * topped up with further prompts while the Lz-62 time budget remains.
     *
     * @param  string|null  $startConcept  Starting concept; null for cold start (random start)
     * @param  int|null  $count  Optional number of concepts to generate (default: 12)
     * @param  object|null  $agent  Optional agent instance (for testing; must implement prompt() and return StructuredAgentResponse)
     * @param  int|null  $complexity  Concept complexity 1–5; null uses config `concepts.default_complexity`
     * @param  int|null  $deadlineAt  Unix timestamp; stop starting new LLM calls at/after this minus HTTP+persist budget
     * @return array{
     *     complexity: int,
     *     start_concept: string,
     *     concepts: array<int, array{concept: string, shortDescription: string, complexity: int, wikiUrl: string|null, mediaUrl: string|null}>,
     *     edges: array<int, array{from: string, to: string, laterality: float}>,
     *     complete: bool,
     *     attempts: int,
     *     shortfall: array{requested_count: int, kept_count: int, rejected_laterality: int, rejected_complexity: int, message: string|null}
     * }
     *
     * @throws \Exception
     */
    public function generateRelationships(
        ?string $startConcept,
        ?int $count = null,
        ?object $agent = null,
        ?int $complexity = null,
        ?int $deadlineAt = null,
    ): array {
        if ($startConcept === null || trim($startConcept) === '') {
            $startConcept = ConceptSeed::randomTerm();
        } else {
            $startConcept = trim($startConcept);
        }

        $agent = $agent ?? new ConceptsOnlyAgent;

        $complexity = $complexity ?? (int) config('concepts.default_complexity', 3);
        $complexity = max(1, min(5, $complexity));

        $count = $count !== null ? max(3, min(100, (int) $count)) : 12;
        $band = $this->settings->band();

        $merged = [
            'start_concept' => $startConcept,
            'concepts' => [],
            'edges' => [],
        ];
        $rejectedLaterality = 0;
        $rejectedComplexity = 0;
        $attempts = 0;

        while ($attempts < self::MAX_GENERATION_ATTEMPTS) {
            if (! $this->hasTimeForAnotherPrompt($deadlineAt)) {
                break;
            }

            $attempts++;
            $needed = max(0, $count - count($merged['concepts']));
            if ($needed === 0 && $this->graphMeetsCount($merged, $count)) {
                break;
            }

            $batchCount = $needed > 0 ? max(3, $needed) : $count;
            $raw = $this->promptOnce(
                $agent,
                $startConcept,
                $batchCount,
                $complexity,
                $band,
                $merged['concepts'],
            );
            $filtered = GeneratedGraphConstraints::apply($raw, $complexity, $band['min'], $band['max']);
            $rejectedLaterality += $filtered['rejected_laterality'];
            $rejectedComplexity += $filtered['rejected_complexity'];
            $merged = $this->mergeGraphs($merged, $filtered);

            if ($this->graphMeetsCount($merged, $count)) {
                break;
            }
        }

        $merged['concepts'] = array_map(fn ($c) => $this->resolveUrlsForConcept($c), $merged['concepts']);

        $keptCount = count($merged['concepts']);
        $complete = $keptCount >= $count && $merged['edges'] !== [];
        $message = $complete ? null : $this->shortfallMessage(
            $count,
            $keptCount,
            $rejectedLaterality,
            $rejectedComplexity,
            $attempts,
            $band,
        );

        return [
            'complexity' => $complexity,
            'start_concept' => $merged['start_concept'],
            'concepts' => $merged['concepts'],
            'edges' => $merged['edges'],
            'complete' => $complete,
            'attempts' => $attempts,
            'shortfall' => [
                'requested_count' => $count,
                'kept_count' => $keptCount,
                'rejected_laterality' => $rejectedLaterality,
                'rejected_complexity' => $rejectedComplexity,
                'message' => $message,
            ],
        ];
    }

    /**
     * @param  array<int, array{concept: string, shortDescription: string, complexity?: int, wikiUrl?: string|null, mediaUrl?: string|null}>  $acceptedConcepts
     * @param  array{min: float, max: float}  $band
     * @return array{start_concept: string, concepts: array<int, array<string, mixed>>, edges: array<int, array<string, mixed>>}
     */
    protected function promptOnce(
        object $agent,
        string $startConcept,
        int $count,
        int $complexity,
        array $band,
        array $acceptedConcepts,
    ): array {
        $userPrompt = $this->buildUserPrompt($startConcept, $count, $complexity, $band, $acceptedConcepts);
        $response = AiPrompt::send($agent, $userPrompt);

        if (! $response instanceof StructuredAgentResponse) {
            throw new \Exception('Expected structured response from agent');
        }

        return $this->normalizeAgentPayload($response->toArray(), $startConcept, $complexity);
    }

    /**
     * @param  array{min: float, max: float}  $band
     * @param  array<int, array{concept: string}>  $acceptedConcepts
     */
    protected function buildUserPrompt(
        string $startConcept,
        int $count,
        int $complexity,
        array $band,
        array $acceptedConcepts,
    ): string {
        $complexityBlock = LateralConceptAgentInstructions::complexityUserInstructions($complexity);
        $bandMin = number_format($band['min'], 2, '.', '');
        $bandMax = number_format($band['max'], 2, '.', '');
        $countText = "Generate exactly {$count} concepts (including the starting concept).";
        $acceptedBlock = '';

        if ($acceptedConcepts !== []) {
            $labels = collect($acceptedConcepts)
                ->pluck('concept')
                ->filter()
                ->map(fn ($label) => '- '.$label)
                ->implode("\n");
            $acceptedBlock = <<<ACCEPTED

Already accepted concepts (keep these; add new ones to reach {$count} total including the start):
{$labels}
Do not duplicate those labels. Every new edge laterality must be in [{$bandMin}, {$bandMax}].
ACCEPTED;
            $countText = "Generate additional concepts so the graph has exactly {$count} unique concepts including the starting concept. Return the full updated concept list and edges.";
        }

        return <<<PROMPT
Starting concept: "{$startConcept}"

{$countText}
{$acceptedBlock}

{$complexityBlock}

Target laterality band: {$bandMin}–{$bandMax} (Ball–Baseball = 0, Ball–Algorithm = 1). Every edge laterality MUST fall in this band.

Requirements:
- Concepts must be interwoven: include cross-links between non-start concepts. Avoid star graphs.
- Every concept must have at least one edge.
- At least 30% of concepts must have degree >= 2.
- Avoid obvious neighbor clusters (do not keep returning to the same domain).
- Every `shortDescription` must be non-empty (at least one sentence describing what the concept is). Never return blank descriptions.
- Leave wikiUrl and mediaUrl null for every concept; follow the schema and system instructions.
PROMPT;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{start_concept: string, concepts: array<int, array<string, mixed>>, edges: array<int, array<string, mixed>>}
     */
    protected function normalizeAgentPayload(array $data, string $fallbackStart, int $complexity): array
    {
        $startConceptName = trim((string) ($data['start_concept'] ?? $fallbackStart));
        if ($startConceptName === '') {
            $startConceptName = $fallbackStart;
        }

        $concepts = $data['concepts'] ?? [];
        if (! is_array($concepts)) {
            Log::warning('ConceptRelationshipService: concepts was not an array', [
                'type' => gettype($concepts),
            ]);
            $concepts = [];
        }

        $concepts = array_values(array_filter(array_map(function ($concept) use ($complexity) {
            if (! is_array($concept)) {
                return null;
            }

            $name = trim((string) ($concept['concept'] ?? $concept['name'] ?? ''));
            if ($name === '') {
                return null;
            }

            return [
                'concept' => $name,
                'shortDescription' => $this->normalizeShortDescription(
                    $name,
                    $concept['shortDescription'] ?? $concept['description'] ?? ''
                ),
                'complexity' => max(1, min(5, (int) ($concept['complexity'] ?? $complexity))),
                'wikiUrl' => $concept['wikiUrl'] ?? null,
                'mediaUrl' => $concept['mediaUrl'] ?? null,
            ];
        }, $concepts)));

        $hasStart = collect($concepts)->contains(
            fn ($c) => isset($c['concept']) && ConceptTerm::normalizeTerm((string) $c['concept']) === ConceptTerm::normalizeTerm($startConceptName)
        );
        if (! $hasStart) {
            array_unshift($concepts, [
                'concept' => $startConceptName,
                'shortDescription' => $this->normalizeShortDescription($startConceptName, ''),
                'complexity' => $complexity,
                'wikiUrl' => null,
                'mediaUrl' => null,
            ]);
        }

        $edges = $data['edges'] ?? [];
        if (! is_array($edges)) {
            Log::warning('ConceptRelationshipService: edges was not an array', [
                'type' => gettype($edges),
            ]);
            $edges = [];
        }

        $edges = array_values(array_filter(array_map(function ($edge) {
            if (! is_array($edge)) {
                return null;
            }

            $from = trim((string) ($edge['from'] ?? ''));
            $to = trim((string) ($edge['to'] ?? ''));
            if ($from === '' || $to === '' || ConceptTerm::normalizeTerm($from) === ConceptTerm::normalizeTerm($to)) {
                return null;
            }

            $laterality = Laterality::normalize($edge['laterality'] ?? $edge['larelality'] ?? null);

            return [
                'from' => $from,
                'to' => $to,
                'laterality' => $laterality,
            ];
        }, $edges)));

        return [
            'start_concept' => $startConceptName,
            'concepts' => $concepts,
            'edges' => $edges,
        ];
    }

    /**
     * @param  array{start_concept: string, concepts: array<int, array<string, mixed>>, edges: array<int, array<string, mixed>>}  $into
     * @param  array{start_concept: string, concepts: array<int, array<string, mixed>>, edges: array<int, array<string, mixed>>}  $batch
     * @return array{start_concept: string, concepts: array<int, array<string, mixed>>, edges: array<int, array<string, mixed>>}
     */
    protected function mergeGraphs(array $into, array $batch): array
    {
        $concepts = [];
        foreach (array_merge($into['concepts'], $batch['concepts']) as $concept) {
            $key = ConceptTerm::normalizeTerm((string) ($concept['concept'] ?? ''));
            if ($key === '') {
                continue;
            }
            if (! isset($concepts[$key])) {
                $concepts[$key] = $concept;
            }
        }

        $edges = [];
        foreach (array_merge($into['edges'], $batch['edges']) as $edge) {
            $fromKey = ConceptTerm::normalizeTerm((string) ($edge['from'] ?? ''));
            $toKey = ConceptTerm::normalizeTerm((string) ($edge['to'] ?? ''));
            if ($fromKey === '' || $toKey === '' || $fromKey === $toKey) {
                continue;
            }
            $edges[$fromKey.'|'.$toKey] = $edge;
        }

        return [
            'start_concept' => $batch['start_concept'] !== '' ? $batch['start_concept'] : $into['start_concept'],
            'concepts' => array_values($concepts),
            'edges' => array_values($edges),
        ];
    }

    /**
     * @param  array{concepts: array<int, mixed>, edges: array<int, mixed>}  $graph
     */
    protected function graphMeetsCount(array $graph, int $count): bool
    {
        return count($graph['concepts']) >= $count && $graph['edges'] !== [];
    }

    protected function hasTimeForAnotherPrompt(?int $deadlineAt): bool
    {
        if ($deadlineAt === null) {
            return true;
        }

        $needed = ConceptsOnlyAgent::HTTP_TIMEOUT_SECONDS + GenerateConceptGraphJob::PERSIST_BUDGET_SECONDS;

        return time() + $needed < $deadlineAt;
    }

    /**
     * @param  array{min: float, max: float}  $band
     */
    protected function shortfallMessage(
        int $requested,
        int $kept,
        int $rejectedLaterality,
        int $rejectedComplexity,
        int $attempts,
        array $band,
    ): string {
        $bandMin = number_format($band['min'], 2, '.', '');
        $bandMax = number_format($band['max'], 2, '.', '');

        return "Generated {$kept}/{$requested} concepts after {$attempts} attempt(s); dropped {$rejectedLaterality} edge(s) outside laterality {$bandMin}–{$bandMax} and {$rejectedComplexity} concept(s) outside complexity ±".GeneratedGraphConstraints::COMPLEXITY_TOLERANCE.'.';
    }

    /**
     * Ensure shortDescription is never blank (models sometimes omit when asked to stay "oblique").
     */
    protected function normalizeShortDescription(string $concept, ?string $shortDescription): string
    {
        $text = trim((string) $shortDescription);
        if ($text !== '') {
            return $text;
        }

        $label = trim($concept);
        if ($label === '') {
            Log::debug('ConceptRelationshipService: empty shortDescription and concept; using generic fallback');

            return 'A concept in this lateral chain.';
        }

        Log::debug('ConceptRelationshipService: empty shortDescription filled from concept label', [
            'concept' => $label,
        ]);

        return "Short label in this chain: {$label}.";
    }

    /**
     * Surface wiki and media already stored for this concept. Never searches.
     * Model-invented URLs are discarded when nothing is stored yet.
     *
     * @param  array{concept: string, shortDescription: string, wikiUrl: string|null, mediaUrl: string|null}  $item
     * @return array{concept: string, shortDescription: string, wikiUrl: string|null, mediaUrl: string|null}
     */
    protected function resolveUrlsForConcept(array $item): array
    {
        $concept = (string) ($item['concept'] ?? '');
        $locale = (string) config('concepts.default_locale', 'en');
        $normalized = ConceptTerm::normalizeTerm($concept);

        $stored = ConceptTerm::query()
            ->where('locale', $locale)
            ->where('normalized_term', $normalized)
            ->first();

        if ($stored !== null) {
            Log::debug('ConceptRelationshipService: using stored wiki/media URLs', [
                'concept' => $normalized,
            ]);
            $item['wikiUrl'] = $stored->wiki_url;
            $item['mediaUrl'] = $stored->media_url;

            return $item;
        }

        $item['wikiUrl'] = null;
        $item['mediaUrl'] = null;

        return $item;
    }
}
