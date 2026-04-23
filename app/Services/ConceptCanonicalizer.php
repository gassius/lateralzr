<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptTerm;
use Illuminate\Support\Facades\DB;

class ConceptCanonicalizer
{
    public function defaultLocale(): string
    {
        return (string) config('concepts.default_locale', 'en');
    }

    public function canonicalKeyFor(string $term, string $locale): string
    {
        return $locale.':'.ConceptTerm::normalizeTerm($term);
    }

    /**
     * Resolve (or create) a canonical concept + preferred term for the given label.
     *
     * Implements the POC pipeline:
     * - exact normalized term match in locale
     * - else create new concept + preferred term
     */
    public function resolveOrCreate(
        string $term,
        ?string $locale = null,
        ?string $shortDescription = null,
        ?string $wikiUrl = null,
        ?string $mediaUrl = null
    ): Concept {
        $locale = $locale ?: $this->defaultLocale();
        $normalized = ConceptTerm::normalizeTerm($term);

        return DB::transaction(function () use ($term, $locale, $normalized, $shortDescription, $wikiUrl, $mediaUrl) {
            $existingTerm = ConceptTerm::query()
                ->where('locale', $locale)
                ->where('normalized_term', $normalized)
                ->first();

            if ($existingTerm) {
                // Best-effort enrichment for preferred term.
                $updates = [];
                if ($shortDescription !== null && ($existingTerm->short_description === null || $existingTerm->short_description === '')) {
                    $updates['short_description'] = $shortDescription;
                }
                if ($wikiUrl !== null && ($existingTerm->wiki_url === null || $existingTerm->wiki_url === '')) {
                    $updates['wiki_url'] = $wikiUrl;
                }
                if ($mediaUrl !== null && ($existingTerm->media_url === null || $existingTerm->media_url === '')) {
                    $updates['media_url'] = $mediaUrl;
                }
                if ($updates !== []) {
                    $existingTerm->fill($updates)->save();
                }

                return $existingTerm->concept()->firstOrFail();
            }

            $concept = Concept::query()->create([
                'canonical_key' => $this->canonicalKeyFor($term, $locale),
            ]);

            ConceptTerm::query()->create([
                'concept_id' => $concept->id,
                'locale' => $locale,
                'term' => trim($term),
                'normalized_term' => $normalized,
                'short_description' => $shortDescription,
                'wiki_url' => $wikiUrl,
                'media_url' => $mediaUrl,
                'is_preferred' => true,
            ]);

            return $concept;
        });
    }
}

