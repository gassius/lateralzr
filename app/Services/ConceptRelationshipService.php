<?php

namespace App\Services;

use App\Ai\Agents\ConceptRelationshipAgent;
use App\Ai\Tools\WikipediaSearchTool;
use App\Ai\Tools\WikimediaCommonsSearchTool;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Responses\StructuredAgentResponse;
use Laravel\Ai\Tools\Request;

class ConceptRelationshipService
{
    /**
     * Generate laterally related concepts from a seed concept.
     *
     * @param  string  $seedConcept  The seed concept to generate relationships from
     * @param  int|null  $count  Optional number of concepts to generate (default: 3-5)
     * @param  ConceptRelationshipAgent|null  $agent  Optional agent instance (for testing)
     * @return array{seed: string, related_concepts: array<int, array{concept: string, shortDescription: string, wikiUrl: string|null, mediaUrl: string|null}>}
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

IMPORTANT - Concept Chaining:
- The first concept should be laterally related to the seed concept "{$seedConcept}"
- The second concept should be laterally related to the first concept (not the seed)
- The third concept should be laterally related to the second concept, and so on
- Each concept builds on the previous one, creating a chain of lateral connections

Think laterally and creatively. Find unexpected connections, analogies, or associations that encourage lateral thinking. Avoid obvious or direct relationships.

For each concept, provide:
- A clear, concise concept name
- A short description (1-2 sentences) explaining what the concept is

Return the seed concept and the laterally related concepts with their names and short descriptions.
PROMPT;
    }

    /**
     * Normalize the structured agent response to a consistent format.
     *
     * @param  StructuredAgentResponse  $response
     * @return array{seed: string, related_concepts: array<int, array{concept: string, shortDescription: string, wikiUrl: string|null, mediaUrl: string|null}>}
     */
    protected function normalizeResponse(StructuredAgentResponse $response): array
    {
        $data = $response->toArray();

        // Log the raw response for debugging
        Log::channel('single')->debug('ConceptRelationshipService: Raw LLM response', [
            'response_keys' => array_keys($data),
            'has_related_concepts' => isset($data['related_concepts']),
            'related_concepts_type' => gettype($data['related_concepts'] ?? null),
            'related_concepts_count' => is_array($data['related_concepts'] ?? null) ? count($data['related_concepts']) : 0,
        ]);

        // Handle various response structures that the LLM might return
        $relatedConcepts = [];
        
        // Try multiple possible keys for related concepts
        $rawConcepts = $data['related_concepts'] 
            ?? $data['relatedConcepts'] 
            ?? $data['concepts'] 
            ?? $data['related_concepts_array']
            ?? [];

        // Ensure rawConcepts is an array
        if (!is_array($rawConcepts)) {
            Log::warning('related_concepts is not an array', [
                'type' => gettype($rawConcepts),
                'value' => $rawConcepts,
                'available_keys' => array_keys($data),
                'full_response' => $data,
            ]);
            $rawConcepts = [];
        }

        // Log if no concepts found for debugging
        if (empty($rawConcepts)) {
            Log::warning('No related_concepts found in LLM response', [
                'response_keys' => array_keys($data),
                'full_response' => $data,
            ]);
        } else {
            Log::channel('single')->debug('ConceptRelationshipService: Processing concepts', [
                'count' => count($rawConcepts),
                'first_concept_keys' => !empty($rawConcepts[0]) ? array_keys($rawConcepts[0]) : [],
            ]);
        }

        foreach ($rawConcepts as $index => $concept) {
            // Ensure concept is an array
            if (!is_array($concept)) {
                Log::warning('Concept at index is not an array', [
                    'index' => $index,
                    'type' => gettype($concept),
                    'value' => $concept,
                ]);
                continue;
            }

            // Handle different possible structures - LLM may return concept_name, concept, name, or title
            $conceptName = $concept['concept'] 
                ?? $concept['concept_name'] 
                ?? $concept['name'] 
                ?? $concept['title'] 
                ?? '';
            
            // If concept is still empty, try to extract from shortDescription or other fields
            if (empty($conceptName)) {
                if (!empty($concept['shortDescription'])) {
                    // Try to extract concept name from shortDescription (first few words)
                    $words = explode(' ', $concept['shortDescription'], 3);
                    $conceptName = !empty($words[0]) ? $words[0] : '';
                }
                
                // Try other common field names
                if (empty($conceptName)) {
                    $conceptName = $concept['text'] ?? $concept['label'] ?? '';
                }
            }

            // Skip if we still don't have a concept name, but log more details
            if (empty($conceptName)) {
                Log::warning('Skipping concept with empty name', [
                    'index' => $index,
                    'concept_data' => $concept,
                    'concept_keys' => array_keys($concept),
                ]);
                continue;
            }

            // Handle shortDescription - LLM may return shortDescription, description, or desc
            $shortDescription = $concept['shortDescription'] 
                ?? $concept['description'] 
                ?? $concept['desc'] 
                ?? $concept['summary'] 
                ?? $concept['text'] 
                ?? '';

            $relatedConcepts[] = [
                'concept' => trim($conceptName),
                'shortDescription' => trim($shortDescription),
                'wikiUrl' => null, // Will be enriched by tools
                'mediaUrl' => null, // Will be enriched by tools
            ];
        }

        Log::channel('single')->debug('ConceptRelationshipService: Normalized concepts', [
            'count' => count($relatedConcepts),
            'concepts' => array_map(fn($c) => $c['concept'], $relatedConcepts),
        ]);

        // Enrich concepts with URLs from tools
        $enrichedConcepts = $this->enrichConceptsWithTools($relatedConcepts);

        Log::channel('single')->debug('ConceptRelationshipService: Final enriched concepts', [
            'count' => count($enrichedConcepts),
        ]);

        return [
            'seed' => $data['seed'] ?? '',
            'related_concepts' => $enrichedConcepts,
        ];
    }

    /**
     * Enrich concepts with Wikipedia and Wikimedia Commons URLs using tools.
     *
     * @param  array<int, array{concept: string, shortDescription: string, wikiUrl: string|null, mediaUrl: string|null}>  $concepts
     * @return array<int, array{concept: string, shortDescription: string, wikiUrl: string|null, mediaUrl: string|null}>
     */
    protected function enrichConceptsWithTools(array $concepts): array
    {
        if (empty($concepts)) {
            Log::warning('enrichConceptsWithTools called with empty concepts array');
            return [];
        }

        Log::channel('single')->debug('ConceptRelationshipService: Enriching concepts', [
            'count' => count($concepts),
        ]);

        $wikipediaTool = new WikipediaSearchTool();
        $wikimediaTool = new WikimediaCommonsSearchTool();

        $enrichedConcepts = [];

        foreach ($concepts as $index => $concept) {
            // Ensure we have required fields
            if (empty($concept['concept'])) {
                Log::warning('Skipping concept enrichment - missing concept name', [
                    'index' => $index,
                    'concept_data' => $concept,
                ]);
                // Still include it in the result, just without URLs
                $enrichedConcepts[] = [
                    'concept' => $concept['concept'] ?? '',
                    'shortDescription' => $concept['shortDescription'] ?? '',
                    'wikiUrl' => null,
                    'mediaUrl' => null,
                ];
                continue;
            }

            $conceptName = $concept['concept'];
            $shortDescription = $concept['shortDescription'] ?? '';

            // Initialize enriched concept
            $enrichedConcept = [
                'concept' => trim($conceptName),
                'shortDescription' => trim($shortDescription),
                'wikiUrl' => null,
                'mediaUrl' => null,
            ];

            // Fetch Wikipedia URL (pass shortDescription to avoid disambiguation pages)
            try {
                $wikiRequest = new Request([
                    'concept' => $conceptName,
                    'shortDescription' => $shortDescription,
                ]);
                $wikiUrl = $wikipediaTool->handle($wikiRequest);
                $enrichedConcept['wikiUrl'] = !empty($wikiUrl) && $wikiUrl !== '' ? (string) $wikiUrl : null;
            } catch (\Exception $e) {
                Log::warning('Failed to fetch Wikipedia URL for concept', [
                    'concept' => $conceptName,
                    'error' => $e->getMessage(),
                ]);
                $enrichedConcept['wikiUrl'] = null;
            }

            // Fetch Wikimedia Commons URL (pass shortDescription for better search relevance)
            try {
                $mediaRequest = new Request([
                    'concept' => $conceptName,
                    'shortDescription' => $shortDescription,
                ]);
                $mediaUrl = $wikimediaTool->handle($mediaRequest);
                $enrichedConcept['mediaUrl'] = !empty($mediaUrl) && $mediaUrl !== '' ? (string) $mediaUrl : null;
            } catch (\Exception $e) {
                Log::warning('Failed to fetch Wikimedia Commons URL for concept', [
                    'concept' => $conceptName,
                    'error' => $e->getMessage(),
                ]);
                $enrichedConcept['mediaUrl'] = null;
            }

            $enrichedConcepts[] = $enrichedConcept;
        }

        Log::channel('single')->debug('ConceptRelationshipService: Enrichment complete', [
            'input_count' => count($concepts),
            'output_count' => count($enrichedConcepts),
        ]);

        return $enrichedConcepts;
    }
}
