<?php

namespace App\Ai\Agents;

use App\Ai\Support\AiProviders;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\MaxSteps;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

#[MaxSteps(5)]
#[Temperature(0.2)]
#[Timeout(90)]
class ConceptLocalizeAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    public function __construct(
        public string $fromLocale = 'en',
        public string $toLocale = 'es',
    ) {}

    public function instructions(): Stringable|string
    {
        $from = strtoupper($this->fromLocale);
        $to = strtoupper($this->toLocale);

        return <<<INSTRUCTIONS
You localize Lateralzr concept terms from {$from} to {$to}.

Rules:
- Translate the concept `term` into natural {$to} (prefer the common Wikipedia / dictionary form when one exists).
- Translate `shortDescription` into clear {$to}; keep it 1–2 sentences.
- Preserve meaning; do not invent new concepts.
- Keep complexity unchanged.
- Return one output item per input id. Never drop or invent ids.
- Leave wikiUrl and mediaUrl null (filled later).

Output field names must match the schema exactly.
INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'translations' => $schema->array()->items(
                $schema->object([
                    'id' => $schema->integer()->required(),
                    'term' => $schema->string()->required(),
                    'shortDescription' => $schema->string()->required(),
                ])->withoutAdditionalProperties()
            )->required(),
        ];
    }

    public function provider(): Lab|array|string|null
    {
        return AiProviders::toLab((string) config('ai.default', 'ollama'));
    }

    public function model(): ?string
    {
        return AiProviders::defaultTextModel((string) config('ai.default', 'ollama'));
    }
}
