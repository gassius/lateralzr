<?php

namespace Tests\Feature;

use App\Models\ConceptRelationship;
use App\Models\RelationshipEvidence;
use App\Services\ConceptGraphStore;
use App\Support\Laterality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LateralityStorageTest extends TestCase
{
    use RefreshDatabase;

    public function test_laterality_columns_are_decimal_and_store_zero_one_floats(): void
    {
        app(ConceptGraphStore::class)->storeGraph(
            concepts: [
                ['concept' => 'Ball', 'shortDescription' => 'A round toy.', 'complexity' => 3],
                ['concept' => 'Algorithm', 'shortDescription' => 'A finite procedure.', 'complexity' => 3],
            ],
            edges: [
                ['from' => 'Ball', 'to' => 'Algorithm', 'laterality' => 0.47],
            ],
            complexity: 3,
            provider: 'test',
            model: 'test',
            runUuid: 'run-laterality',
        );

        $edge = ConceptRelationship::query()->first();

        $this->assertNotNull($edge);
        $this->assertEqualsWithDelta(0.47, (float) $edge->last_laterality, 0.001);

        $evidence = RelationshipEvidence::query()
            ->where('concept_relationship_id', $edge->id)
            ->first();
        $this->assertNotNull($evidence);
        $this->assertEqualsWithDelta(0.47, (float) $evidence->laterality, 0.001);

        $this->assertSame(0.0, Laterality::fromLegacyInteger(1));
        $this->assertSame(1.0, Laterality::fromLegacyInteger(5));
        $this->assertSame(1, Laterality::toLegacyInteger(0.0));
        $this->assertSame(5, Laterality::toLegacyInteger(1.0));

        $relationshipType = Schema::getColumnType('concept_relationships', 'last_laterality');
        $evidenceType = Schema::getColumnType('relationship_evidences', 'laterality');
        $this->assertTrue(
            in_array($relationshipType, ['decimal', 'numeric', 'float', 'double', 'real'], true),
            'last_laterality should be a decimal/float column, got '.$relationshipType
        );
        $this->assertTrue(
            in_array($evidenceType, ['decimal', 'numeric', 'float', 'double', 'real'], true),
            'laterality should be a decimal/float column, got '.$evidenceType
        );
    }
}
