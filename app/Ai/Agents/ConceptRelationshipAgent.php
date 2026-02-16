<?php

namespace App\Ai\Agents;

use App\Ai\Tools\WikipediaSearchTool;
use App\Ai\Tools\WikimediaCommonsSearchTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

class ConceptRelationshipAgent implements Agent, HasStructuredOutput, HasTools
{
    use Promptable;

    /**
     * Get the instructions that the agent should follow.
     */
    public function instructions(): Stringable|string
    {
        return <<<'INSTRUCTIONS'
You are a lateral thinking assistant inspired by Edward de Bono's lateral thinking concepts and Brian Eno's Oblique Strategies.

Your task is to generate laterally related concepts from a seed concept using concept chaining. Lateral thinking involves finding unexpected, non-linear connections between ideas. Think creatively and make associations that are not immediately obvious.

IMPORTANT - What is a lateral related concept?
Those that are not direclty related to the seed concept. Only indirectly or abstractly related to the seed concept. The conceptual distance can be defined as "Laterality" and in a scale of 1 o 5 can be understood like this:

1 - Directly / Vertically related to the seed concept (e.g. "Apple" is directly related to "Fruit" because it is a type of fruit)
2 - Indirectly / Extended related to the seed concept (e.g. "baseball" is indirectly related to "Porcorn" because is a differen category but share a strong enviromental context like a Stadium)
3 - Abstractly / Laterally related to the seed concept (e.g."Mona Lisa" and "Poker Face". Both involve the "structural" concept of a cryptic or unreadable facial expression used for strategic or artistic effect, despite belonging to fine art and gambling/pop culture respectively.)
4 - Provocative -  The terms have very high semantic distance. There is no obvious connection, and one must be forced through a "Provocative Operation" (Po) to move the mind to a new place. (e.g. "Keep" and "Exoplanet". A bridge requires a leap—perhaps "keeping" a planet's atmosphere or the "keep" (fortress) of a distant solar system)
5 - Wildly Discrepant - The terms are randomly associated with zero initial overlap. This is the Random Entry technique used to break dominant thought patterns entirely. (e.g "Standardized Testing" and "Marshmallows". The distance is so great that any connection formed is entirely original)

IMPORTANT - Tools and URLs:
- You have access to tools that can fetch Wikipedia URLs and Wikimedia Commons image URLs for concepts.
- For the seed concept AND each related concept, you MUST invoke these tools as needed and then fill the `wikiUrl` and `mediaUrl` fields in your structured output.
- The seed object must include: `concept` (the seed concept name), `shortDescription` (a brief description), `wikiUrl`, and `mediaUrl`.
- If a tool cannot find a suitable URL or fails, set the corresponding field to null.

IMPORTANT - Concept Chaining:
- The first concept should be laterally related to the seed concept (level 2 or higher)
- The second concept should be laterally related to the first concept (not the seed) (level 2 to the first concept or higher, level 3 or higher to the seed concept)
- The third concept should be laterally related to the second concept, and so on (level 2 to the second concept or higher, level 3 or higher to the first concept, level 4 or higher to the seed concept)
- The fourth concept should be laterally related to the third concept, and so on (level 2 to the third concept or higher, level 3 or higher to the second concept, level 4 or higher to the first concept, level 5 or higher to the seed concept)
- Each concept builds on the previous one, creating a chain of lateral connections

For each related concept you generate, you MUST use these exact field names in your structured output:
- `concept` (string): A clear, concise concept name
- `shortDescription` (string): A short description (1-2 sentences) explaining what the concept is
- `larelality` (integer, 1-5): The laterality level of the concept to the seed concept
- `wikiUrl` (string, nullable): The Wikipedia article URL for the concept (use tools to fetch this)
- `mediaUrl` (string, nullable): The Wikimedia Commons image URL for the concept (use tools to fetch this)

CRITICAL: You must use the exact field names `concept`, `shortDescription`, `larelality`, `wikiUrl`, and `mediaUrl` as defined in the schema. Do not use variations like "name", "description", "laterality", etc.

Focus on generating diverse, creative connections that encourage lateral thinking rather than obvious, direct relationships.
INSTRUCTIONS;
    }

    /**
     * Get the tools available to the agent.
     *
     * @return Tool[]
     */
    public function tools(): iterable
    {
        return [
            new WikipediaSearchTool(),
            new WikimediaCommonsSearchTool(),
        ];
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
                // URLs are populated via tools; may be null if tools fail
                'wikiUrl' => $schema->string(),
                'mediaUrl' => $schema->string(),
            ])->required(),
            'related_concepts' => $schema->array(
                $schema->object([
                    'concept' => $schema->string()->required(),
                    'shortDescription' => $schema->string()->required(),
                    // Laterality level 1–5 as described in the instructions
                    'larelality' => $schema->integer()->min(1)->max(5)->required(),
                    // URLs are populated via tools; may be null if tools fail
                    'wikiUrl' => $schema->string(),
                    'mediaUrl' => $schema->string(),
                ])
            )->required(),
        ];
    }

    /**
     * Get the default provider from config.
     */
    public function provider(): Lab|array|string|null
    {
        $providerName = config('ai.default', 'ollama');
        return $this->getProviderEnum($providerName);
    }

    /**
     * Get the default model from config.
     */
    public function model(): ?string
    {
        return config('ai.models.text', 'llama3.2:3b');
    }

    /**
     * Map provider string from config to Lab enum.
     */
    private function getProviderEnum(string $providerName): Lab
    {
        return match (strtolower($providerName)) {
            'ollama' => Lab::Ollama,
            'openai' => Lab::OpenAI,
            'anthropic' => Lab::Anthropic,
            'gemini' => Lab::Gemini,
            default => Lab::Ollama, // Fallback to Ollama
        };
    }
}
