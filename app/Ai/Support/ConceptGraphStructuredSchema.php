<?php

namespace App\Ai\Support;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Illuminate\JsonSchema\Types\Type;
use Laravel\Ai\Contracts\HasStructuredOutput;

/**
 * Structured output schema for concept-graph agents.
 *
 * Laravel's JsonSchemaTypeFactory::array() takes no arguments. Passing an object
 * type as the first argument is ignored, so OpenRouter receives
 * `{ "type": "array" }` without `items` and rejects the request:
 * "array schema missing items". Always chain ->items($schema->object(...)).
 */
final class ConceptGraphStructuredSchema
{
    /**
     * @return array<string, Type>
     */
    public static function definition(JsonSchema $schema): array
    {
        return [
            'start_concept' => $schema->string()->min(1)->required(),
            'concepts' => $schema->array()
                ->items(
                    $schema->object([
                        'concept' => $schema->string()->min(1)->required(),
                        'shortDescription' => $schema->string()->min(1)->required(),
                        'complexity' => $schema->integer()->min(1)->max(5)->required(),
                        'wikiUrl' => $schema->string()->nullable()->required(),
                        'mediaUrl' => $schema->string()->nullable()->required(),
                    ])->withoutAdditionalProperties()
                )
                ->required(),
            'edges' => $schema->array()
                ->items(
                    $schema->object([
                        'from' => $schema->string()->min(1)->required(),
                        'to' => $schema->string()->min(1)->required(),
                        'laterality' => $schema->integer()->min(1)->max(5)->required(),
                    ])->withoutAdditionalProperties()
                )
                ->required(),
        ];
    }

    /**
     * JSON Schema property map as sent to providers (OpenRouter json_schema.schema.properties).
     *
     * @return array<string, array<string, mixed>>
     */
    public static function exportProperties(?HasStructuredOutput $agent = null): array
    {
        $definition = $agent === null
            ? self::definition(new JsonSchemaTypeFactory)
            : $agent->schema(new JsonSchemaTypeFactory);

        $properties = [];

        foreach ($definition as $key => $type) {
            $properties[$key] = $type instanceof Type ? $type->toArray() : $type;
        }

        return $properties;
    }
}
