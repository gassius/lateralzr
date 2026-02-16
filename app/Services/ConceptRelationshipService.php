<?php

namespace App\Services;

use App\Ai\Agents\ConceptRelationshipAgent;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Responses\StructuredAgentResponse;

class ConceptRelationshipService
{
    /**
     * Generate laterally related concepts from a seed concept.
     *
     * @param  string  $seedConcept  The seed concept to generate relationships from
     * @param  int|null  $count  Optional number of concepts to generate (default: 3-5)
     * @param  ConceptRelationshipAgent|null  $agent  Optional agent instance (for testing)
     * @return array{seed: string, related_concepts: array<int, array{concept: string, shortDescription: string, laterality: int, wikiUrl: string|null, mediaUrl: string|null}>}
     *
     * @throws \Exception
     */
    public function generateRelationships(string $seedConcept, ?int $count = null, ?ConceptRelationshipAgent $agent = null): array
    {
        $agent = $agent ?? new ConceptRelationshipAgent();

        // Let the agent's instructions and schema drive the behavior.
        // We only provide the seed concept and an optional count hint.
        $countText = $count
            ? "Generate exactly {$count} related concepts."
            : 'Generate 3 to 5 related concepts.';

        $userPrompt = "Seed concept: \"{$seedConcept}\"\n\n{$countText}\n\nFollow your instructions, schema, and tools to produce the structured response.";

        // Agent handles config reading internally
        $response = $agent->prompt($userPrompt);

        if (! $response instanceof StructuredAgentResponse) {
            throw new \Exception('Expected structured response from agent');
        }

        $data = $response->toArray();

        // Basic safety: ensure we always return the seed and an array of concepts.
        $seed = $data['seed'] ?? $seedConcept;
        $related = $data['related_concepts'] ?? [];

        if (! is_array($related)) {
            Log::warning('ConceptRelationshipService: related_concepts was not an array', [
                'type' => gettype($related),
            ]);
            $related = [];
        }

        // Normalize field names to ensure consistency (handle LLM variations)
        $related = array_map(function ($concept) {
            if (! is_array($concept)) {
                return $concept;
            }

            // Normalize field names: handle common LLM variations
            $normalized = [];
            $normalized['concept'] = $concept['concept'] ?? $concept['name'] ?? '';
            $normalized['shortDescription'] = $concept['shortDescription'] ?? $concept['description'] ?? '';
            $normalized['laterality'] = $concept['laterality'] ?? $concept['laterality'] ?? 1;
            $normalized['wikiUrl'] = $concept['wikiUrl'] ?? null;
            $normalized['mediaUrl'] = $concept['mediaUrl'] ?? null;

            return $normalized;
        }, $related);

        return [
            'seed' => $seed,
            'related_concepts' => $related,
        ];
    }
}
