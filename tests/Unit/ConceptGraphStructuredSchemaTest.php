<?php

namespace Tests\Unit;

use App\Ai\Agents\ConceptsOnlyAgent;
use App\Ai\Support\ConceptGraphStructuredSchema;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Illuminate\JsonSchema\Types\Type;
use Tests\TestCase;

class ConceptGraphStructuredSchemaTest extends TestCase
{
    public function test_exported_concepts_and_edges_include_items_for_openrouter(): void
    {
        $properties = ConceptGraphStructuredSchema::exportProperties();

        $this->assertArraySchemaHasObjectItems($properties['concepts'], ['concept', 'shortDescription', 'complexity', 'wikiUrl', 'mediaUrl']);
        $this->assertArraySchemaHasObjectItems($properties['edges'], ['from', 'to', 'laterality']);
        $this->assertSame('string', $properties['start_concept']['type'] ?? null);
    }

    public function test_concepts_only_agent_schema_matches_shared_definition(): void
    {
        $fromAgent = $this->schemaToArray((new ConceptsOnlyAgent)->schema(new JsonSchemaTypeFactory));
        $fromShared = ConceptGraphStructuredSchema::exportProperties();

        $this->assertSame($fromShared['concepts'], $fromAgent['concepts']);
        $this->assertSame($fromShared['edges'], $fromAgent['edges']);
        $this->assertArrayHasKey('items', $fromAgent['concepts']);
        $this->assertArrayHasKey('items', $fromAgent['edges']);
    }

    /**
     * @param  array<string, mixed>  $definition
     * @return array<string, array<string, mixed>>
     */
    private function schemaToArray(array $definition): array
    {
        $properties = [];

        foreach ($definition as $key => $type) {
            $properties[$key] = $type instanceof Type ? $type->toArray() : $type;
        }

        return $properties;
    }

    /**
     * @param  array<string, mixed>  $schema
     * @param  list<string>  $propertyNames
     */
    private function assertArraySchemaHasObjectItems(array $schema, array $propertyNames): void
    {
        $this->assertSame('array', $schema['type'] ?? null);
        $this->assertArrayHasKey('items', $schema, 'OpenRouter requires array schemas to include items.');
        $this->assertIsArray($schema['items']);
        $this->assertSame('object', $schema['items']['type'] ?? null);
        $this->assertArrayHasKey('properties', $schema['items']);

        foreach ($propertyNames as $name) {
            $this->assertArrayHasKey($name, $schema['items']['properties']);
        }
    }
}
