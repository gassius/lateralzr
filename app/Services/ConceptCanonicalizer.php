<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptTerm;
use App\Support\ConceptLocale;
use Illuminate\Support\Facades\DB;

class ConceptCanonicalizer
{
    public function defaultLocale(): string
    {
        return ConceptLocale::default();
    }

    /**
     * Language-neutral identity key for a concept (no locale prefix).
     * Locale-specific labels live on concept_terms.
     */
    public function canonicalKeyFor(string $term, ?string $locale = null): string
    {
        return ConceptTerm::normalizeTerm($term);
    }

    /**
     * Resolve (or create) a canonical concept + preferred term for the given label.
     *
     * Pipeline:
     * - exact normalized term match in the requested locale
     * - else exact normalized term match in any supported locale (attach new locale term)
     * - else create new concept + preferred term
     */
    public function resolveOrCreate(
        string $term,
        ?string $locale = null,
        ?string $shortDescription = null,
        ?string $wikiUrl = null,
        ?string $mediaUrl = null,
        ?int $complexity = null
    ): Concept {
        $locale = ConceptLocale::resolve($locale);
        $normalized = ConceptTerm::normalizeTerm($term);
        $complexity = $complexity !== null
            ? max(1, min(5, $complexity))
            : (int) config('concepts.default_complexity', 2);

        return DB::transaction(function () use ($term, $locale, $normalized, $shortDescription, $wikiUrl, $mediaUrl, $complexity) {
            $existingTerm = ConceptTerm::query()
                ->where('locale', $locale)
                ->where('normalized_term', $normalized)
                ->first();

            if ($existingTerm) {
                $this->enrichTerm($existingTerm, $shortDescription, $wikiUrl, $mediaUrl, $complexity);

                return $existingTerm->concept()->firstOrFail();
            }

            // Same label already exists in another locale → reuse that concept identity.
            $crossLocaleTerm = ConceptTerm::query()
                ->where('normalized_term', $normalized)
                ->orderByRaw('CASE WHEN locale = ? THEN 0 ELSE 1 END', [$this->defaultLocale()])
                ->first();

            if ($crossLocaleTerm) {
                $concept = $crossLocaleTerm->concept()->firstOrFail();
                $this->attachPreferredTerm(
                    $concept,
                    $locale,
                    $term,
                    $normalized,
                    $shortDescription,
                    $wikiUrl,
                    $mediaUrl,
                    $complexity
                );

                return $concept;
            }

            $concept = Concept::query()->create([
                'canonical_key' => $this->canonicalKeyFor($term, $locale),
            ]);

            $this->attachPreferredTerm(
                $concept,
                $locale,
                $term,
                $normalized,
                $shortDescription,
                $wikiUrl,
                $mediaUrl,
                $complexity
            );

            return $concept;
        });
    }

    /**
     * Attach a localized preferred term to an existing concept (used by localize command).
     */
    public function attachLocalizedTerm(
        Concept $concept,
        string $locale,
        string $term,
        ?string $shortDescription = null,
        ?string $wikiUrl = null,
        ?string $mediaUrl = null,
        ?int $complexity = null
    ): ConceptTerm {
        $locale = ConceptLocale::resolve($locale);
        $normalized = ConceptTerm::normalizeTerm($term);
        $complexity = $complexity !== null
            ? max(1, min(5, $complexity))
            : (int) config('concepts.default_complexity', 2);

        return $this->attachPreferredTerm(
            $concept,
            $locale,
            $term,
            $normalized,
            $shortDescription,
            $wikiUrl,
            $mediaUrl,
            $complexity
        );
    }

    protected function attachPreferredTerm(
        Concept $concept,
        string $locale,
        string $term,
        string $normalized,
        ?string $shortDescription,
        ?string $wikiUrl,
        ?string $mediaUrl,
        int $complexity
    ): ConceptTerm {
        $existing = ConceptTerm::query()
            ->where('concept_id', $concept->id)
            ->where('locale', $locale)
            ->where('is_preferred', true)
            ->first();

        if ($existing) {
            $this->enrichTerm($existing, $shortDescription, $wikiUrl, $mediaUrl, $complexity);
            if ($existing->term !== trim($term) || $existing->normalized_term !== $normalized) {
                $existing->fill([
                    'term' => trim($term),
                    'normalized_term' => $normalized,
                ])->save();
            }

            return $existing->fresh();
        }

        return ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => $locale,
            'term' => trim($term),
            'normalized_term' => $normalized,
            'short_description' => $shortDescription,
            'wiki_url' => $wikiUrl,
            'media_url' => $mediaUrl,
            'complexity' => $complexity,
            'is_preferred' => true,
        ]);
    }

    protected function enrichTerm(
        ConceptTerm $existingTerm,
        ?string $shortDescription,
        ?string $wikiUrl,
        ?string $mediaUrl,
        int $complexity
    ): void {
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
        if ((int) ($existingTerm->complexity ?? 0) !== $complexity) {
            $updates['complexity'] = $complexity;
        }
        if ($updates !== []) {
            $existingTerm->fill($updates)->save();
        }
    }
}
