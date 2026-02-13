<?php

namespace App\Services;

use App\Ai\Agents\ConceptRelationshipAgent;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Responses\StructuredAgentResponse;

class ConceptRelationshipService
{
    /**
     * Generate laterally related concepts from a seed concept.
     *
     * @param  string  $seedConcept  The seed concept to generate relationships from
     * @param  int|null  $count  Optional number of concepts to generate (default: 3-5)
     * @param  ConceptRelationshipAgent|null  $agent  Optional agent instance (for testing)
     * @return array{seed: string, related_concepts: array<int, array{concept: string, rationale: string|null, strength: float|null}>}
     *
     * @throws \Exception
     */
    public function generateRelationships(string $seedConcept, ?int $count = null, ?ConceptRelationshipAgent $agent = null): array
    {
        $agent = $agent ?? new ConceptRelationshipAgent();

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

        // Handle various response structures that the LLM might return
        $relatedConcepts = [];
        $rawConcepts = $data['related_concepts'] ?? [];

        foreach ($rawConcepts as $concept) {
            // Handle different possible structures - LLM may return concept_name, concept, name, or title
            $conceptName = $concept['concept'] 
                ?? $concept['concept_name'] 
                ?? $concept['name'] 
                ?? $concept['title'] 
                ?? '';
            
            // If concept is still empty, try to extract from rationale or other fields
            if (empty($conceptName) && !empty($concept['rationale'])) {
                // Try to extract concept name from rationale (first few words)
                $words = explode(' ', $concept['rationale'], 3);
                $conceptName = !empty($words[0]) ? $words[0] : '';
            }

            // Skip if we still don't have a concept name
            if (empty($conceptName)) {
                Log::warning('Skipping concept with empty name', ['concept_data' => $concept]);
                continue;
            }

            // Handle strength/score - LLM may return strength, strength_score, or score
            $strength = isset($concept['strength']) 
                ? (float) $concept['strength'] 
                : (isset($concept['strength_score']) 
                    ? (float) $concept['strength_score'] 
                    : (isset($concept['score']) 
                        ? (float) $concept['score'] 
                        : null));

            $relatedConcepts[] = [
                'concept' => trim($conceptName),
                'rationale' => $concept['rationale'] ?? $concept['explanation'] ?? $concept['reason'] ?? null,
                'strength' => $strength,
            ];
        }

        return [
            'seed' => $data['seed'] ?? '',
            'related_concepts' => $relatedConcepts,
        ];
    }
}
