<?php

namespace App\Ai\Agents;

use App\Ai\Support\AiProviders;
use App\Ai\Support\ConceptGraphStructuredSchema;
use App\Ai\Support\LateralConceptAgentInstructions;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\MaxSteps;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

#[MaxSteps(15)]
#[Temperature(0.88)]
#[Timeout(120)]
class ConceptRelationshipAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    /**
     * Get the instructions that the agent should follow.
     */
    public function instructions(): Stringable|string
    {
        $base = LateralConceptAgentInstructions::core();

        return <<<INSTRUCTIONS
{$base}

IMPORTANT — URLs:
- Leave wikiUrl and mediaUrl as null for every concept. `concepts:complete-info` fills them later. Do NOT guess or invent URLs.

Each concept object MUST use these exact field names:
- `concept` (string): A clear, concise concept name
- `shortDescription` (string): **Required, non-empty.** 1–2 sentences: what the thing is; avoid obvious connection explanations
- `complexity` (integer, 1–5): Label complexity for this concept
- `wikiUrl` (null): Always null
- `mediaUrl` (null): Always null

Each edge object MUST use: `from`, `to`, and `laterality` (integer, 1–5).

CRITICAL: Return `start_concept`, `concepts`, and `edges`. Do not use `related_concepts`, `seed`, `name`, or `description`.
INSTRUCTIONS;
    }

    /**
     * Get the agent's structured output schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return ConceptGraphStructuredSchema::definition($schema);
    }

    /**
     * Get the default provider from config.
     */
    public function provider(): Lab|array|string|null
    {
        return AiProviders::toLab((string) config('ai.default', 'ollama'));
    }

    /**
     * Get the default model from config.
     */
    public function model(): ?string
    {
        return AiProviders::defaultTextModel((string) config('ai.default', 'ollama'));
    }
}
