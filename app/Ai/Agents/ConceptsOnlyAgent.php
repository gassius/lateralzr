<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\MaxSteps;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

#[MaxSteps(15)]
class ConceptsOnlyAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    /**
     * Get the instructions that the agent should follow.
     * Same as ConceptRelationshipAgent but without URL tools; URLs are filled server-side.
     */
    public function instructions(): Stringable|string
    {
        return <<<'INSTRUCTIONS'
You are a lateral thinking assistant inspired by Edward de Bono's lateral thinking concepts and Brian Eno's Oblique Strategies.

Your task is to generate laterally related concepts from a seed concept using concept chaining. Lateral thinking involves finding unexpected, non-linear connections between ideas. Think creatively and make associations that are not immediately obvious.

IMPORTANT - What is a lateral related concept?
Those that are not directly related to the seed concept. Only indirectly or abstractly related to the seed concept. The conceptual distance can be defined as "Laterality" and in a scale of 1 to 5 can be understood like this:

1 - Directly / Vertically related to the seed concept (e.g. "Apple" is directly related to "Fruit" because it is a type of fruit)
2 - Indirectly / Extended related to the seed concept (e.g. "baseball" is indirectly related to "Popcorn" because is a different category but share a strong environmental context like a Stadium)
3 - Abstractly / Laterally related to the seed concept (e.g."Mona Lisa" and "Poker Face". Both involve the "structural" concept of a cryptic or unreadable facial expression used for strategic or artistic effect, despite belonging to fine art and gambling/pop culture respectively.)
4 - Provocative - The terms have very high semantic distance. There is no obvious connection, and one must be forced through a "Provocative Operation" (Po) to move the mind to a new place.
5 - Wildly Discrepant - The terms are randomly associated with zero initial overlap. This is the Random Entry technique used to break dominant thought patterns entirely.

IMPORTANT - URLs:
- Leave wikiUrl and mediaUrl as null for both the seed and every related concept. They will be filled in later by the system. Do NOT guess or invent URLs.

IMPORTANT - Concept Chaining:
- The first concept should be laterally related to the seed concept (level 2 or higher)
- The second concept should be laterally related to the first concept (not the seed) (level 2 to the first concept or higher, level 3 or higher to the seed concept)
- The third concept should be laterally related to the second concept, and so on
- Each concept builds on the previous one, creating a chain of lateral connections

For each related concept you generate, you MUST use these exact field names in your structured output:
- `concept` (string): A clear, concise concept name
- `shortDescription` (string): A short description (1-2 sentences) explaining what the concept is
- `larelality` (integer, 1-5): The laterality level of the concept to the seed concept
- `wikiUrl` (null): Always null
- `mediaUrl` (null): Always null

CRITICAL: You must use the exact field names `concept`, `shortDescription`, `larelality`, `wikiUrl`, and `mediaUrl` as defined in the schema. Do not use variations like "name", "description", "laterality", etc.

Focus on generating diverse, creative connections that encourage lateral thinking rather than obvious, direct relationships.
INSTRUCTIONS;
    }

    /**
     * Get the agent's structured output schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'seed' => $schema->object([
                'concept' => $schema->string()->required(),
                'shortDescription' => $schema->string()->required(),
                'wikiUrl' => $schema->string(),
                'mediaUrl' => $schema->string(),
            ])->required(),
            'related_concepts' => $schema->array(
                $schema->object([
                    'concept' => $schema->string()->required(),
                    'shortDescription' => $schema->string()->required(),
                    'larelality' => $schema->integer()->min(1)->max(5)->required(),
                    'wikiUrl' => $schema->string(),
                    'mediaUrl' => $schema->string(),
                ])
            )->required(),
        ];
    }

    public function provider(): Lab|array|string|null
    {
        $providerName = config('ai.default', 'ollama');
        return $this->getProviderEnum($providerName);
    }

    public function model(): ?string
    {
        return config('ai.models.text', 'llama3.2:3b');
    }

    private function getProviderEnum(string $providerName): Lab
    {
        return match (strtolower($providerName)) {
            'ollama' => Lab::Ollama,
            'openai' => Lab::OpenAI,
            'anthropic' => Lab::Anthropic,
            'gemini' => Lab::Gemini,
            default => Lab::Ollama,
        };
    }
}
