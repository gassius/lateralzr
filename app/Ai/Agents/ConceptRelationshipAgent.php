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

IMPORTANT - Concept Chaining:
- The first concept should be laterally related to the seed concept
- The second concept should be laterally related to the first concept (not the seed)
- The third concept should be laterally related to the second concept, and so on
- Each concept builds on the previous one, creating a chain of lateral connections

For each related concept you generate, provide:
- A clear, concise concept name
- A short description (1-2 sentences) explaining what the concept is

You have access to tools that will automatically fetch Wikipedia URLs and Wikimedia Commons image URLs for each concept you generate. You do not need to provide URLs yourself - the tools will handle that.

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
            'seed' => $schema->string()->required(),
            'related_concepts' => $schema->array(
                $schema->object([
                    'concept' => $schema->string()->required(),
                    'shortDescription' => $schema->string()->required(),
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
