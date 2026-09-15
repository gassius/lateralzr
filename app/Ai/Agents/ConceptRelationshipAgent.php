<?php

namespace App\Ai\Agents;

use App\Ai\Support\LateralConceptAgentInstructions;
use App\Ai\Tools\WikimediaCommonsSearchTool;
use App\Ai\Tools\WikipediaSearchTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\MaxSteps;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

#[MaxSteps(25)]
#[Temperature(0.88)]
class ConceptRelationshipAgent implements Agent, HasStructuredOutput, HasTools
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

IMPORTANT — Tools (MANDATORY):
- You have two tools: WikipediaSearchTool (returns a Wikipedia article URL) and WikimediaCommonsSearchTool (returns a direct image URL on upload.wikimedia.org).
- You MUST call WikipediaSearchTool for EACH concept. Pass "concept" and "shortDescription" to get the article URL. Put the result in wikiUrl (or null if empty).
- You MUST call WikimediaCommonsSearchTool for EACH concept. Pass "concept" and "shortDescription". Put the result in mediaUrl (or null if empty). The tool returns a direct image URL only—never use or invent a commons.wikimedia.org/wiki/File: page URL.
- Do NOT guess or invent URLs. Use only the strings returned by the tools. If a tool returns empty, set that field to null.

Each concept object MUST use these exact field names:
- `concept` (string): A clear, concise concept name
- `shortDescription` (string): **Required, non-empty.** 1–2 sentences: what the thing is; avoid obvious connection explanations
- `complexity` (integer, 1–5): Label complexity for this concept
- `wikiUrl` (string, nullable): From WikipediaSearchTool
- `mediaUrl` (string, nullable): From WikimediaCommonsSearchTool

Each edge object MUST use: `from`, `to`, and `laterality` (integer, 1–5).

CRITICAL: Return `start_concept`, `concepts`, and `edges`. Do not use `related_concepts`, `seed`, `name`, or `description`.
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
            new WikipediaSearchTool,
            new WikimediaCommonsSearchTool,
        ];
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
                    // URLs are populated via tools; may be null if tools fail
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
        return config('ai.models.text', 'phi3.5:latest');
    }

    /**
     * Map provider string from config to Lab enum.
     */
    private function getProviderEnum(string $providerName): Lab
    {
        return match (strtolower($providerName)) {
            'ollama' => Lab::Ollama,
            'openrouter' => Lab::OpenRouter,
            'openai' => Lab::OpenAI,
            'anthropic' => Lab::Anthropic,
            'gemini' => Lab::Gemini,
            default => Lab::Ollama, // Fallback to Ollama
        };
    }
}
