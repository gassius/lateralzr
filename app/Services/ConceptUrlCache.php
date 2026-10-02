<?php

namespace App\Services;

use App\Models\ConceptTerm;

class ConceptUrlCache
{
    /**
     * Find a concept URL record by normalized concept name.
     */
    public function findByConcept(string $concept): ?ConceptTerm
    {
        $locale = (string) config('concepts.default_locale', 'en');
        $normalized = ConceptTerm::normalizeTerm($concept);

        return ConceptTerm::query()
            ->where('locale', $locale)
            ->where('normalized_term', $normalized)
            ->first();
    }
}
