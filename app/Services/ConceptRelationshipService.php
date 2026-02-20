<?php

namespace App\Services;

use App\Ai\Agents\ConceptsOnlyAgent;
use App\Ai\Tools\WikimediaCommonsSearchTool;
use App\Ai\Tools\WikipediaSearchTool;
use App\Models\Concept;
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
     *
     * @param  string  $seedConcept  The seed concept to generate relationships from
     * @param  int|null  $count  Optional number of concepts to generate (default: 3-5)
     * @param  object|null  $agent  Optional agent instance (for testing; must implement prompt() and return StructuredAgentResponse)
     * @return array{seed: array{concept: string, shortDescription: string, wikiUrl: string|null, mediaUrl: string|null}, related_concepts: array<int, array{concept: string, shortDescription: string, larelality: int, wikiUrl: string|null, mediaUrl: string|null}>}
     *
     * @throws \Exception
     */
    public function generateRelationships(string $seedConcept, ?int $count = null, ?object $agent = null): array
    {
        $agent = $agent ?? new ConceptsOnlyAgent();

        $countText = $count
            ? "Generate exactly {$count} related concepts."
            : 'Generate 3 to 5 related concepts.';

        $userPrompt = "Seed concept: \"{$seedConcept}\"\n\n{$countText}\n\nFollow your instructions and schema. Leave wikiUrl and mediaUrl as null for all concepts.";

        $response = $agent->prompt($userPrompt);

        if (! $response instanceof StructuredAgentResponse) {
            throw new \Exception('Expected structured response from agent');
        }

        $data = $response->toArray();

        $seedData = $data['seed'] ?? [];
        if (! is_array($seedData)) {
            $seedData = ['concept' => is_string($seedData) ? $seedData : $seedConcept];
        }

        $seed = [
            'concept' => $seedData['concept'] ?? $seedData['name'] ?? $seedConcept,
            'shortDescription' => $seedData['shortDescription'] ?? $seedData['description'] ?? '',
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
            return [
                'concept' => $concept['concept'] ?? $concept['name'] ?? '',
                'shortDescription' => $concept['shortDescription'] ?? $concept['description'] ?? '',
                'larelality' => $concept['larelality'] ?? $concept['laterality'] ?? 1,
                'wikiUrl' => $concept['wikiUrl'] ?? null,
                'mediaUrl' => $concept['mediaUrl'] ?? null,
            ];
        }, $related);

        // Phase 2: Resolve URLs from cache or tools for seed and each related concept
        $seed = $this->resolveUrlsForConcept($seed);
        $related = array_map(fn ($c) => $this->resolveUrlsForConcept($c), $related);

        return [
            'seed' => $seed,
            'related_concepts' => $related,
        ];
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
        $normalized = Concept::normalizeConcept($concept);

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
