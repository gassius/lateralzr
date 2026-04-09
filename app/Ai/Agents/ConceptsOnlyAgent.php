<?php

namespace App\Ai\Agents;

use App\Ai\Support\LateralConceptAgentInstructions;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\MaxSteps;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

#[MaxSteps(15)]
#[Temperature(0.88)]
class ConceptsOnlyAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    /**
     * Get the instructions that the agent should follow.
     * Same as ConceptRelationshipAgent but without URL tools; URLs are filled server-side.
     */
    public function instructions(): Stringable|string
    {
        $base = LateralConceptAgentInstructions::core();

        return <<<INSTRUCTIONS
{$base}

IMPORTANT — URLs:
- Leave wikiUrl and mediaUrl as null for both the seed and every related concept. They will be filled in later by the system. Do NOT guess or invent URLs.

For each related concept you MUST use these exact field names in your structured output:
- `concept` (string): A clear, concise concept name
- `shortDescription` (string): **Required, non-empty.** 1–2 sentences: what the thing is (plain gloss); for larelality 2+ avoid stating the obvious link to the seed, but never leave this field blank
- `larelality` (integer, 1–5): Distance from the **seed** concept per the scale above
- `wikiUrl` (null): Always null
- `mediaUrl` (null): Always null

CRITICAL: Use the exact field names `concept`, `shortDescription`, `larelality`, `wikiUrl`, and `mediaUrl`. Do not use `name`, `description`, or `laterality`.
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
                'shortDescription' => $schema->string()->min(1)->required(),
                'wikiUrl' => $schema->string(),
                'mediaUrl' => $schema->string(),
            ])->required(),
            'related_concepts' => $schema->array(
                $schema->object([
                    'concept' => $schema->string()->required(),
                    'shortDescription' => $schema->string()->min(1)->required(),
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
