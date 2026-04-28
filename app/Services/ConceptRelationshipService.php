<?php

namespace App\Services;

use App\Ai\Agents\ConceptsOnlyAgent;
use App\Ai\Support\LateralConceptAgentInstructions;
use App\Ai\Tools\WikimediaCommonsSearchTool;
use App\Ai\Tools\WikipediaSearchTool;
use App\Models\Concept;
use App\Models\ConceptTerm;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Responses\StructuredAgentResponse;
use Laravel\Ai\Tools\Request;

class ConceptRelationshipService
{
    public function __construct(
        protected ConceptUrlCache $urlCache,
        protected WikipediaSearchTool $wikipediaTool,
        protected WikimediaCommonsSearchTool $commonsTool
    ) {}

    /**
     * Generate an interwoven concept graph from a starting concept.
     * Phase 1: Get concepts from LLM (no URL tools). Phase 2: Resolve URLs from cache or tools, persist misses.
     * When $startConcept is null or empty, a random starting concept is chosen (from DB or config).
     *
     * @param  string|null  $startConcept  Starting concept; null for cold start (random start)
     * @param  int|null  $count  Optional number of concepts to generate (default: 12)
     * @param  object|null  $agent  Optional agent instance (for testing; must implement prompt() and return StructuredAgentResponse)
     * @param  int|null  $complexity  Concept name complexity 1–5; null uses config `concepts.default_complexity`
     * @return array{complexity: int, start_concept: string, concepts: array<int, array{concept: string, shortDescription: string, wikiUrl: string|null, mediaUrl: string|null}>, edges: array<int, array{from: string, to: string, laterality: int}>}
     *
     * @throws \Exception
     */
    public function generateRelationships(?string $startConcept, ?int $count = null, ?object $agent = null, ?int $complexity = null): array
    {
        if ($startConcept === null || trim($startConcept) === '') {
            $startConcept = $this->resolveRandomSeed();
        } else {
            $startConcept = trim($startConcept);
        }

        $agent = $agent ?? new ConceptsOnlyAgent;

        $complexity = $complexity ?? (int) config('concepts.default_complexity', 2);
        $complexity = max(1, min(5, $complexity));

        $count = $count !== null ? max(3, min(100, (int) $count)) : 12;
        $countText = "Generate exactly {$count} concepts (including the starting concept).";

        $complexityBlock = LateralConceptAgentInstructions::complexityUserInstructions($complexity);

        $userPrompt = <<<PROMPT
Starting concept: "{$startConcept}"

{$countText}

{$complexityBlock}

Requirements:
- Concepts must be interwoven: include cross-links between non-start concepts. Avoid star graphs.
- Every concept must have at least one edge.
- At least 30% of concepts must have degree >= 2.
- Avoid obvious neighbor clusters (do not keep returning to the same domain).
- Every `shortDescription` must be non-empty (at least one sentence describing what the concept is). Never return blank descriptions.
- Leave wikiUrl and mediaUrl null for every concept; follow the schema and system instructions.
PROMPT;

        $response = $agent->prompt($userPrompt);

        if (! $response instanceof StructuredAgentResponse) {
            throw new \Exception('Expected structured response from agent');
        }

        $data = $response->toArray();

        $startConceptName = trim((string) ($data['start_concept'] ?? $startConcept));
        if ($startConceptName === '') {
            $startConceptName = $startConcept;
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

        // Ensure starting concept exists as a node.
        $hasStart = collect($concepts)->contains(fn ($c) => isset($c['concept']) && ConceptTerm::normalizeTerm((string) $c['concept']) === ConceptTerm::normalizeTerm($startConceptName));
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

            $laterality = (int) ($edge['laterality'] ?? $edge['larelality'] ?? 3);
            $laterality = max(1, min(5, $laterality));

            return [
                'from' => $from,
                'to' => $to,
                'laterality' => $laterality,
            ];
        }, $edges)));

        // Phase 2: Resolve URLs from cache or tools for each concept node
        $concepts = array_map(fn ($c) => $this->resolveUrlsForConcept($c), $concepts);

        return [
            'complexity' => $complexity,
            'start_concept' => $startConceptName,
            'concepts' => $concepts,
            'edges' => $edges,
        ];
    }

    // Note: concept label truncation removed intentionally (see above).

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
     * Resolve a random seed concept for cold start (no user-provided seed).
     * Prefers a random concept from the database; falls back to config default_seeds.
     */
    protected function resolveRandomSeed(): string
    {
        $locale = (string) config('concepts.default_locale', 'en');
        $fromDb = ConceptTerm::query()->where('locale', $locale)->inRandomOrder()->first()?->term;
        if ($fromDb !== null && $fromDb !== '') {
            return (string) $fromDb;
        }

        $defaults = config('concepts.default_seeds', []);
        if ($defaults !== []) {
            return (string) Arr::random($defaults);
        }

        return 'creativity';
    }

    /**
     * Resolve wikiUrl and mediaUrl for a single concept (seed or related). Uses cache first, then tools + persist.
     *
     * @param  array{concept: string, shortDescription: string, wikiUrl: string|null, mediaUrl: string|null, larelality?: int}  $item
     * @return array with wikiUrl and mediaUrl set (possibly null if tools return empty)
     */
    protected function resolveUrlsForConcept(array $item): array
    {
        $concept = $item['concept'] ?? '';
        $shortDescription = $item['shortDescription'] ?? '';
        $normalized = ConceptTerm::normalizeTerm($concept);

        $cached = $this->urlCache->findByConcept($concept);

        if ($cached !== null) {
            Log::info('ConceptUrlCache: using stored record', ['concept' => $normalized]);
            $item['wikiUrl'] = $cached->wiki_url;
            $item['mediaUrl'] = $cached->media_url;

            return $item;
        }

        $request = new Request([
            'concept' => $concept,
            'shortDescription' => $shortDescription,
        ]);

        $wikiUrl = $this->wikipediaTool->handle($request);
        $wikiUrl = is_string($wikiUrl) ? $wikiUrl : (string) $wikiUrl;
        $wikiUrl = $wikiUrl !== '' ? $wikiUrl : null;

        $mediaUrl = $this->commonsTool->handle($request);
        $mediaUrl = is_string($mediaUrl) ? $mediaUrl : (string) $mediaUrl;
        $mediaUrl = $mediaUrl !== '' ? $mediaUrl : null;

        $this->urlCache->remember($concept, $wikiUrl, $mediaUrl);

        $item['wikiUrl'] = $wikiUrl;
        $item['mediaUrl'] = $mediaUrl;

        return $item;
    }
}
