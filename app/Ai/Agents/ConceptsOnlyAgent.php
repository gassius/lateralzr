<?php

namespace App\Ai\Agents;

use App\Ai\Support\AiProviders;
use App\Ai\Support\ConceptGraphStructuredSchema;
use App\Ai\Support\LateralConceptAgentInstructions;
use App\Services\ConceptGenerationSettings;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\MaxSteps;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

#[MaxSteps(self::MAX_STEPS)]
#[Temperature(0.88)]
#[Timeout(self::HTTP_TIMEOUT_SECONDS)]
class ConceptsOnlyAgent implements Agent, HasStructuredOutput
{
    public const HTTP_TIMEOUT_SECONDS = 180;

    public const MAX_STEPS = 1;

    use Promptable;

    /**
     * Get the instructions that the agent should follow.
     * Concept prefetch. Wiki and media URLs stay null; `concepts:complete-info` fills them later.
     */
    public function instructions(): Stringable|string
    {
        $band = app(ConceptGenerationSettings::class)->band();
        $base = LateralConceptAgentInstructions::core($band['min'], $band['max']);
        $bandMin = number_format($band['min'], 2, '.', '');
        $bandMax = number_format($band['max'], 2, '.', '');

        return <<<INSTRUCTIONS
{$base}

IMPORTANT — URLs:
- Leave wikiUrl and mediaUrl as null for every concept. `concepts:complete-info` fills them later. Do NOT guess or invent URLs.

Each concept object MUST use these exact field names:
- `concept` (string): A clear, concise concept name
- `shortDescription` (string): **Required, non-empty.** 1–2 sentences: what the thing is; avoid stating obvious connections
- `complexity` (integer, 1–5): Conceptual difficulty / specialism for this concept (not label length)
- `wikiUrl` (null): Always null
- `mediaUrl` (null): Always null

Each edge object MUST use these exact field names:
- `from` (string): concept label of the source endpoint (must match a `concepts[].concept`)
- `to` (string): concept label of the target endpoint (must match a `concepts[].concept`)
- `laterality` (number, 0–1): Distance across this edge per the scale above; MUST be inside {$bandMin}–{$bandMax}

CRITICAL: Use the exact field names shown above. Do not use `name` or `description`. Do not output any keys outside the schema.
INSTRUCTIONS;
    }

    /**
     * Get the agent's structured output schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return ConceptGraphStructuredSchema::definition($schema);
    }

    public function provider(): Lab|array|string|null
    {
        return AiProviders::toLab((string) config('ai.default', 'ollama'));
    }

    public function model(): ?string
    {
        return AiProviders::effectiveTextModel((string) config('ai.default', 'ollama'));
    }
}
