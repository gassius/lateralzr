<?php

namespace App\Services;

use App\Ai\Agents\ConceptsOnlyAgent;
use App\Ai\Support\LateralConceptAgentInstructions;
use App\Models\ConceptTerm;
use App\Support\ConceptSeed;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Responses\StructuredAgentResponse;

class ConceptRelationshipService
{
    /**
     * Generate an interwoven concept graph from a starting concept.
     * Wiki and media URLs are not looked up here. Already stored URLs are copied onto the response;
     * missing URLs stay empty until `concepts:complete-info` runs.
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
            $startConcept = ConceptSeed::randomTerm();
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

        // Copy URLs that were already stored. Do not search or attach new ones.
        $concepts = array_map(fn ($c) => $this->resolveUrlsForConcept($c), $concepts);

        return [
            'complexity' => $complexity,
            'start_concept' => $startConceptName,
            'concepts' => $concepts,
            'edges' => $edges,
        ];
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
