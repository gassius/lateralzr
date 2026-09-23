<?php

namespace Tests\Feature\Concerns;

use App\Models\Concept;
use App\Models\ConceptTerm;
use App\Models\User;
use App\Support\SuperAdminRole;
use Filament\Facades\Filament;

trait InteractsWithFilamentAdmin
{
    protected function actingAsAdmin(): User
    {
        SuperAdminRole::ensureExists();
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        $user = User::factory()->create();
        $user->assignRole(SuperAdminRole::NAME);
        $this->actingAs($user);

        return $user;
    }

    protected function makeConcept(
        string $term,
        string $canonicalKey,
        int $complexity = 2,
        ?string $wikiUrl = null,
        ?string $mediaUrl = null,
        string $locale = 'en',
    ): Concept {
        $concept = Concept::query()->create([
            'canonical_key' => $canonicalKey,
        ]);

        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => $locale,
            'term' => $term,
            'normalized_term' => ConceptTerm::normalizeTerm($term),
            'wiki_url' => $wikiUrl,
            'media_url' => $mediaUrl,
            'complexity' => $complexity,
            'is_preferred' => true,
        ]);

        return $concept->fresh(['preferredTerm']);
    }
}
