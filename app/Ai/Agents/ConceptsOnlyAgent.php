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
- Leave wikiUrl and mediaUrl as null for every concept. They will be filled in later by the system. Do NOT guess or invent URLs.

Each concept object MUST use these exact field names:
- `concept` (string): A clear, concise concept name
- `shortDescription` (string): **Required, non-empty.** 1–2 sentences: what the thing is; avoid stating obvious connections
- `complexity` (integer, 1–5): Label complexity for this concept
- `wikiUrl` (null): Always null
- `mediaUrl` (null): Always null

Each edge object MUST use these exact field names:
- `from` (string): concept label of the source endpoint (must match a `concepts[].concept`)
- `to` (string): concept label of the target endpoint (must match a `concepts[].concept`)
- `laterality` (integer, 1–5): Distance across this edge per the scale above

CRITICAL: Use the exact field names shown above. Do not use `name` or `description`. Do not output any keys outside the schema.
INSTRUCTIONS;
    }

    /**
     * Get the agent's structured output schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'start_concept' => $schema->string()->min(1)->required(),
            'concepts' => $schema->array(
                $schema->object([
                    'concept' => $schema->string()->min(1)->required(),
                    'shortDescription' => $schema->string()->min(1)->required(),
                    'complexity' => $schema->integer()->min(1)->max(5)->required(),
                    'wikiUrl' => $schema->string(),
                    'mediaUrl' => $schema->string(),
                ])
            )->required(),
            'edges' => $schema->array(
                $schema->object([
                    'from' => $schema->string()->min(1)->required(),
                    'to' => $schema->string()->min(1)->required(),
                    'laterality' => $schema->integer()->min(1)->max(5)->required(),
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
        return config('ai.models.text', 'phi3.5:latest');
    }

    private function getProviderEnum(string $providerName): Lab
    {
        return match (strtolower($providerName)) {
            'ollama' => Lab::Ollama,
            'openrouter' => Lab::OpenRouter,
            'openai' => Lab::OpenAI,
            'anthropic' => Lab::Anthropic,
            'gemini' => Lab::Gemini,
            default => Lab::Ollama,
        };
    }
}
