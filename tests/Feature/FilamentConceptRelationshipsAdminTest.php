<?php

namespace Tests\Feature;

use App\Filament\Resources\ConceptRelationships\Pages\ListConceptRelationships;
use App\Models\ConceptRelationship;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Feature\Concerns\InteractsWithFilamentAdmin;
use Tests\TestCase;

class FilamentConceptRelationshipsAdminTest extends TestCase
{
    use InteractsWithFilamentAdmin;
    use RefreshDatabase;

    public function test_concept_relationships_can_sort_by_from_term(): void
    {
        $this->actingAsAdmin();

        $zebra = $this->makeConcept('Zebra', 'zebra');
        $apple = $this->makeConcept('Apple', 'apple');
        $target = $this->makeConcept('Target', 'target');

        $fromZebra = ConceptRelationship::query()->create([
            'from_concept_id' => $zebra->id,
            'to_concept_id' => $target->id,
            'strength' => 0.4,
        ]);
        $fromApple = ConceptRelationship::query()->create([
            'from_concept_id' => $apple->id,
            'to_concept_id' => $target->id,
            'strength' => 0.6,
        ]);

        $this->get('/admin/concept-relationships?sort=fromConcept.display_term:asc')->assertSuccessful();

        Livewire::test(ListConceptRelationships::class)
            ->sortTable('fromConcept.display_term')
            ->assertCanSeeTableRecords([$fromApple, $fromZebra], inOrder: true);
    }
}
