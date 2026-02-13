<?php

namespace App\Services;

use App\Ai\Agents\ConceptRelationshipAgent;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Responses\StructuredAgentResponse;

class ConceptRelationshipService
{
    /**
     * Generate laterally related concepts from a seed concept.
     *
     * @param  string  $seedConcept  The seed concept to generate relationships from
     * @param  int|null  $count  Optional number of concepts to generate (default: 3-5)
     * @return array{seed: string, related_concepts: array<int, array{concept: string, rationale: string|null, strength: float|null}>}
     *
     * @throws \Exception
     */
    public function generateRelationships(string $seedConcept, ?int $count = null): array
    {
        $agent = ConceptRelationshipAgent::make();

        $prompt = $this->buildPrompt($seedConcept, $count);

        $response = $agent->prompt(
            $prompt,
            provider: Lab::Ollama,
            model: config('ai.models.text', 'llama3.2:3b'),
            timeout: 120, // Local models may need more time
        );

        if (! $response instanceof StructuredAgentResponse) {
            throw new \Exception('Expected structured response from agent');
        }

        return $this->normalizeResponse($response);
    }

    /**
     * Build the prompt for the agent.
     */
    protected function buildPrompt(string $seedConcept, ?int $count = null): string
    {
        $countText = $count ? "Generate exactly {$count} related concepts." : 'Generate 3 to 5 related concepts.';

        return <<<PROMPT
Given the seed concept: "{$seedConcept}"

{$countText}

Think laterally and creatively. Find unexpected connections, analogies, or associations that encourage lateral thinking. Avoid obvious or direct relationships.

Return the seed concept and the laterally related concepts with their rationales and strength scores.
PROMPT;
    }

    /**
     * Normalize the structured agent response to a consistent format.
     *
     * @param  StructuredAgentResponse  $response
     * @return array{seed: string, related_concepts: array<int, array{concept: string, rationale: string|null, strength: float|null}>}
     */
    protected function normalizeResponse(StructuredAgentResponse $response): array
    {
        $data = $response->toArray();

        return [
            'seed' => $data['seed'] ?? '',
            'related_concepts' => array_map(function ($concept) {
                return [
                    'concept' => $concept['concept'] ?? '',
                    'rationale' => $concept['rationale'] ?? null,
                    'strength' => isset($concept['strength']) ? (float) $concept['strength'] : null,
                ];
            }, $data['related_concepts'] ?? []),
        ];
    }
}
