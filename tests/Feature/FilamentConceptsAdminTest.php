<?php

namespace Tests\Feature;

use App\Filament\Resources\Concepts\Pages\EditConcept;
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

    public function test_concepts_can_sort_by_term(): void
    {
        $this->actingAsAdmin();

        $zebra = $this->makeConcept('Zebra', 'zebra');
        $apple = $this->makeConcept('Apple', 'apple');

        $this->get('/admin/concepts?sort=display_term:asc')->assertSuccessful();

        Livewire::test(ListConcepts::class)
            ->sortTable('display_term')
            ->assertCanSeeTableRecords([$apple, $zebra], inOrder: true);
    }

    public function test_concepts_can_sort_by_complexity(): void
    {
        $this->actingAsAdmin();

        $simple = $this->makeConcept('Simple', 'simple', complexity: 1);
        $dense = $this->makeConcept('Dense', 'dense', complexity: 5);

        $this->get('/admin/concepts?sort=display_complexity:asc')->assertSuccessful();

        Livewire::test(ListConcepts::class)
            ->sortTable('display_complexity')
            ->assertCanSeeTableRecords([$simple, $dense], inOrder: true);
    }

    public function test_concepts_can_sort_by_wiki_url(): void
    {
        $this->actingAsAdmin();

        $later = $this->makeConcept('Later', 'later', wikiUrl: 'https://en.wikipedia.org/wiki/Zulu');
        $earlier = $this->makeConcept('Earlier', 'earlier', wikiUrl: 'https://en.wikipedia.org/wiki/Apple');

        $this->get('/admin/concepts?sort=display_wiki_url:asc')->assertSuccessful();

        Livewire::test(ListConcepts::class)
            ->sortTable('display_wiki_url')
            ->assertCanSeeTableRecords([$earlier, $later], inOrder: true);
    }

    public function test_concepts_can_sort_by_media_url(): void
    {
        $this->actingAsAdmin();

        $later = $this->makeConcept('Later', 'later-media', mediaUrl: 'https://commons.wikimedia.org/wiki/Zulu');
        $earlier = $this->makeConcept('Earlier', 'earlier-media', mediaUrl: 'https://commons.wikimedia.org/wiki/Apple');

        $this->get('/admin/concepts?sort=display_media_url:asc')->assertSuccessful();

        Livewire::test(ListConcepts::class)
            ->sortTable('display_media_url')
            ->assertCanSeeTableRecords([$earlier, $later], inOrder: true);
    }

    public function test_concept_edit_localized_terms_span_full_width(): void
    {
        $this->actingAsAdmin();

        $concept = $this->makeConcept('Pyramid', 'pyramid-edit');

        $this->get('/admin/concepts/'.$concept->getKey().'/edit')->assertSuccessful();

        $component = Livewire::test(EditConcept::class, ['record' => $concept->getKey()])
            ->assertSuccessful()
            ->assertSee('Localized terms');

        $terms = $component->instance()->getSchemaComponent('form.terms');

        $this->assertNotNull($terms);
        $this->assertSame('full', $terms->getColumnSpan('default'));
    }
}
