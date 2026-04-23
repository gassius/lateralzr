<?php

namespace App\Services;

use App\Models\ConceptTerm;
use Illuminate\Support\Facades\Log;

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

    /**
     * Find or create a concept URL record; update URLs if provided.
     */
    public function remember(string $concept, ?string $wikiUrl, ?string $mediaUrl): ConceptTerm
    {
        $locale = (string) config('concepts.default_locale', 'en');
        $normalized = ConceptTerm::normalizeTerm($concept);

        $record = ConceptTerm::query()
            ->where('locale', $locale)
            ->where('normalized_term', $normalized)
            ->first();

        if ($record) {
            $updated = false;
            if ($wikiUrl !== null && $record->wiki_url !== $wikiUrl) {
                $record->wiki_url = $wikiUrl;
                $updated = true;
            }
            if ($mediaUrl !== null && $record->media_url !== $mediaUrl) {
                $record->media_url = $mediaUrl;
                $updated = true;
            }
            if ($updated) {
                $record->save();
            }

            return $record;
        }

        $canonicalizer = app(ConceptCanonicalizer::class);
        $conceptModel = $canonicalizer->resolveOrCreate(
            term: $concept,
            locale: $locale,
            shortDescription: null,
            wikiUrl: $wikiUrl,
            mediaUrl: $mediaUrl
        );

        $record = ConceptTerm::query()
            ->where('concept_id', $conceptModel->id)
            ->where('locale', $locale)
            ->where('normalized_term', $normalized)
            ->firstOrFail();

        Log::info('ConceptUrlCache: created new term record', ['concept' => $normalized, 'locale' => $locale]);

        return $record;
    }
}
