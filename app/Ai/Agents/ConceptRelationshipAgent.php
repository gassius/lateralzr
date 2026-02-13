<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

class ConceptRelationshipAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    /**
     * Get the instructions that the agent should follow.
     */
    public function instructions(): Stringable|string
    {
        return <<<'INSTRUCTIONS'
You are a lateral thinking assistant inspired by Edward de Bono's lateral thinking concepts and Brian Eno's Oblique Strategies.

Your task is to generate laterally related concepts from a seed concept. Lateral thinking involves finding unexpected, non-linear connections between ideas. Think creatively and make associations that are not immediately obvious.

For each related concept you generate:
- Provide a clear, concise concept name
- Explain the lateral connection or rationale (why this concept relates laterally to the seed)
- Optionally provide a strength score (0.0 to 1.0) indicating how strong or interesting the lateral connection is

Focus on generating diverse, creative connections that encourage lateral thinking rather than obvious, direct relationships.
INSTRUCTIONS;
    }

    /**
     * Get the agent's structured output schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'seed' => $schema->string()->required(),
            'related_concepts' => $schema->array(
                $schema->object([
                    'concept' => $schema->string()->required(),
                    'rationale' => $schema->string()->nullable(),
                    'strength' => $schema->number()->min(0)->max(1)->nullable(),
                ])
            )->required(),
        ];
    }

    /**
     * Get the default provider for this agent.
     */
    protected function defaultProvider(): string
    {
        return Lab::Ollama->value;
    }

    /**
     * Get the default model for this agent.
     */
    protected function defaultModel(): ?string
    {
        return config('ai.models.text', 'llama3.2:3b');
    }
}
