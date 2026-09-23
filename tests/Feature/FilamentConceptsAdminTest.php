<?php

namespace Tests\Feature;

use App\Filament\Resources\Concepts\Pages\ListConcepts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Feature\Concerns\InteractsWithFilamentAdmin;
use Tests\TestCase;

class FilamentConceptsAdminTest extends TestCase
{
    use InteractsWithFilamentAdmin;
    use RefreshDatabase;

    public function test_concepts_search_matches_localized_terms(): void
    {
        $this->actingAsAdmin();

        $pyramid = $this->makeConcept('Pyramid', 'pyramid');
        $river = $this->makeConcept('River', 'river');

        $this->get('/admin/concepts?search=pyramid')->assertSuccessful();

        Livewire::test(ListConcepts::class)
            ->searchTable('pyramid')
            ->assertCanSeeTableRecords([$pyramid])
            ->assertCanNotSeeTableRecords([$river]);
    }
}
