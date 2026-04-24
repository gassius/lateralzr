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
     * Generate laterally related concepts from a seed concept.
     * Phase 1: Get concepts from LLM (no URL tools). Phase 2: Resolve URLs from cache or tools, persist misses.
     * When $seedConcept is null or empty, a random seed is chosen (from DB or config).
     *
     * @param  string|null  $seedConcept  The seed concept to generate relationships from; null for cold start (random seed)
     * @param  int|null  $count  Optional number of concepts to generate (default: 3-5)
     * @param  object|null  $agent  Optional agent instance (for testing; must implement prompt() and return StructuredAgentResponse)
     * @param  int|null  $complexity  Concept name complexity 1–5; null uses config `concepts.default_complexity`
     * @return array{complexity: int, seed: array{concept: string, shortDescription: string, wikiUrl: string|null, mediaUrl: string|null}, related_concepts: array<int, array{concept: string, shortDescription: string, larelality: int, wikiUrl: string|null, mediaUrl: string|null}>}
     *
     * @throws \Exception
     */
    public function generateRelationships(?string $seedConcept, ?int $count = null, ?object $agent = null, ?int $complexity = null): array
    {
        if ($seedConcept === null || trim($seedConcept) === '') {
            $seedConcept = $this->resolveRandomSeed();
        } else {
            $seedConcept = trim($seedConcept);
        }

        $agent = $agent ?? new ConceptsOnlyAgent;

        $complexity = $complexity ?? (int) config('concepts.default_complexity', 2);
        $complexity = max(1, min(5, $complexity));

        $countText = $count
            ? "Generate exactly {$count} related concepts."
            : 'Generate 3 to 5 related concepts.';

        $complexityBlock = LateralConceptAgentInstructions::complexityUserInstructions($complexity);

        $userPrompt = <<<PROMPT
Seed concept: "{$seedConcept}"

{$countText}

{$complexityBlock}

Requirements:
- The first related concept must not be a same-domain / encyclopedia-neighbor of the seed (avoid catalog walks in one field).
- If a candidate is really just "more of the same subject area" as the seed, score it 1 and pick a different concept instead.
- Only explain an obvious vertical link to the seed in shortDescription when larelality is 1; for 2+ keep the description neutral or oblique (see system instructions).
- Every `shortDescription` must be non-empty (at least one sentence describing what the concept is). Never return blank descriptions.
- Leave wikiUrl and mediaUrl null for every item; follow the schema and system instructions.
PROMPT;

        $response = $agent->prompt($userPrompt);

        if (! $response instanceof StructuredAgentResponse) {
            throw new \Exception('Expected structured response from agent');
        }

        $data = $response->toArray();

        $seedData = $data['seed'] ?? [];
        if (! is_array($seedData)) {
            $seedData = ['concept' => is_string($seedData) ? $seedData : $seedConcept];
        }

        // Do not truncate concept labels to match complexity caps.
        // Complexity is a *request hint* for the model; importer must keep whatever label the model returns
        // (truncation can produce meaningless tokens like "The").
        $seedConceptName = trim((string) ($seedData['concept'] ?? $seedData['name'] ?? $seedConcept));

        $seed = [
            'concept' => $seedConceptName,
            'shortDescription' => $this->normalizeShortDescription(
                $seedConceptName,
                $seedData['shortDescription'] ?? $seedData['description'] ?? ''
            ),
            'wikiUrl' => $seedData['wikiUrl'] ?? null,
            'mediaUrl' => $seedData['mediaUrl'] ?? null,
        ];

        $related = $data['related_concepts'] ?? [];
        if (! is_array($related)) {
            Log::warning('ConceptRelationshipService: related_concepts was not an array', [
                'type' => gettype($related),
            ]);
            $related = [];
        }

        $related = array_map(function ($concept) {
            if (! is_array($concept)) {
                return $concept;
            }

            $name = trim((string) ($concept['concept'] ?? $concept['name'] ?? ''));

            return [
                'concept' => $name,
                'shortDescription' => $this->normalizeShortDescription(
                    $name,
                    $concept['shortDescription'] ?? $concept['description'] ?? ''
                ),
                'larelality' => $concept['larelality'] ?? $concept['laterality'] ?? 1,
                'wikiUrl' => $concept['wikiUrl'] ?? null,
                'mediaUrl' => $concept['mediaUrl'] ?? null,
            ];
        }, $related);

        // Phase 2: Resolve URLs from cache or tools for seed and each related concept
        $seed = $this->resolveUrlsForConcept($seed);
        $related = array_map(fn ($c) => $this->resolveUrlsForConcept($c), $related);

        return [
            'complexity' => $complexity,
            'seed' => $seed,
            'related_concepts' => $related,
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
