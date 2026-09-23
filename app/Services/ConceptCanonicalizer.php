<?php

namespace App\Services;

use App\Models\Concept;
use App\Models\ConceptTerm;
use App\Support\ConceptLocale;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

        try {
            return DB::transaction(function () use ($term, $locale, $normalized, $shortDescription, $wikiUrl, $mediaUrl, $complexity) {
                $existingTerm = $this->findExistingLocaleTerm($locale, $normalized);

                if ($existingTerm) {
                    $this->enrichTerm($existingTerm, $shortDescription, $wikiUrl, $mediaUrl, $complexity);

                    return $existingTerm->concept()->firstOrFail();
                }

                // Same label already exists in another locale → reuse that concept identity.
                $crossLocaleTerm = $this->findCrossLocaleTerm($normalized);

                if ($crossLocaleTerm) {
                    $concept = $crossLocaleTerm->concept()->firstOrFail();
                    $attached = $this->attachPreferredTerm(
                        $concept,
                        $locale,
                        $term,
                        $normalized,
                        $shortDescription,
                        $wikiUrl,
                        $mediaUrl,
                        $complexity
                    );

                    if ($attached instanceof ConceptTerm) {
                        return $attached->concept()->firstOrFail();
                    }

                    return $concept;
                }

                $concept = Concept::query()->create([
                    'canonical_key' => $this->canonicalKeyFor($term, $locale),
                ]);

                $attached = $this->attachPreferredTerm(
                    $concept,
                    $locale,
                    $term,
                    $normalized,
                    $shortDescription,
                    $wikiUrl,
                    $mediaUrl,
                    $complexity
                );

                if ($attached instanceof ConceptTerm) {
                    return $attached->concept()->firstOrFail();
                }

                return $concept;
            });
        } catch (UniqueConstraintViolationException $e) {
            $existingTerm = ConceptTerm::query()
                ->where('locale', $locale)
                ->where('normalized_term', $normalized)
                ->first();

            if ($existingTerm instanceof ConceptTerm) {
                $this->enrichTerm($existingTerm, $shortDescription, $wikiUrl, $mediaUrl, $complexity);

                return $existingTerm->concept()->firstOrFail();
            }

            throw $e;
        }
    }

    /**
     * Attach a localized preferred term to an existing concept (used by localize command).
     *
     * Returns null when (locale, normalized_term) is already owned by a different
     * concept. Localization must not steal a surface form or merge identities.
     */
    public function attachLocalizedTerm(
        Concept $concept,
        string $locale,
        string $term,
        ?string $shortDescription = null,
        ?string $wikiUrl = null,
        ?string $mediaUrl = null,
        ?int $complexity = null
    ): ?ConceptTerm {
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
            $complexity,
            onConflict: 'skip'
        );
    }

    /**
     * @param  'adopt'|'skip'  $onConflict
     */
    protected function attachPreferredTerm(
        Concept $concept,
        string $locale,
        string $term,
        string $normalized,
        ?string $shortDescription,
        ?string $wikiUrl,
        ?string $mediaUrl,
        int $complexity,
        string $onConflict = 'adopt'
    ): ?ConceptTerm {
        return DB::transaction(function () use (
            $concept,
            $locale,
            $term,
            $normalized,
            $shortDescription,
            $wikiUrl,
            $mediaUrl,
            $complexity,
            $onConflict
        ) {
            $owned = $this->lockedTerm($locale, $normalized);
            if ($owned instanceof ConceptTerm) {
                return $this->resolveOwnedTerm(
                    $owned,
                    $concept,
                    $term,
                    $normalized,
                    $shortDescription,
                    $wikiUrl,
                    $mediaUrl,
                    $complexity,
                    $onConflict
                );
            }

            $existing = ConceptTerm::query()
                ->where('concept_id', $concept->id)
                ->where('locale', $locale)
                ->where('is_preferred', true)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                $this->enrichTerm($existing, $shortDescription, $wikiUrl, $mediaUrl, $complexity);
                if ($existing->term !== trim($term) || $existing->normalized_term !== $normalized) {
                    try {
                        $existing->fill([
                            'term' => trim($term),
                            'normalized_term' => $normalized,
                        ])->save();
                    } catch (UniqueConstraintViolationException $e) {
                        return $this->resolveUniqueConflict(
                            $e,
                            $onConflict,
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
                }

                return $existing->fresh();
            }

            try {
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
            } catch (UniqueConstraintViolationException $e) {
                return $this->resolveUniqueConflict(
                    $e,
                    $onConflict,
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
        });
    }

    protected function findExistingLocaleTerm(string $locale, string $normalized): ?ConceptTerm
    {
        return $this->findTermByLocaleNorm($locale, $normalized, lock: false);
    }

    protected function findCrossLocaleTerm(string $normalized): ?ConceptTerm
    {
        return ConceptTerm::query()
            ->where('normalized_term', $normalized)
            ->orderByRaw('CASE WHEN locale = ? THEN 0 ELSE 1 END', [$this->defaultLocale()])
            ->first();
    }

    protected function lockedTerm(string $locale, string $normalized): ?ConceptTerm
    {
        return $this->findTermByLocaleNorm($locale, $normalized, lock: true);
    }

    protected function findTermByLocaleNorm(string $locale, string $normalized, bool $lock = false): ?ConceptTerm
    {
        $query = ConceptTerm::query()
            ->where('locale', $locale)
            ->where('normalized_term', $normalized);

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    protected function demoteOtherPreferredTerms(ConceptTerm $preferred): void
    {
        ConceptTerm::query()
            ->where('concept_id', $preferred->concept_id)
            ->where('locale', $preferred->locale)
            ->where('id', '!=', $preferred->id)
            ->where('is_preferred', true)
            ->update(['is_preferred' => false]);
    }

    /**
     * @param  'adopt'|'skip'  $onConflict
     */
    protected function resolveOwnedTerm(
        ConceptTerm $owned,
        Concept $concept,
        string $term,
        string $normalized,
        ?string $shortDescription,
        ?string $wikiUrl,
        ?string $mediaUrl,
        int $complexity,
        string $onConflict
    ): ?ConceptTerm {
        if ((int) $owned->concept_id === (int) $concept->id) {
            $this->enrichTerm($owned, $shortDescription, $wikiUrl, $mediaUrl, $complexity);
            $updates = [];
            if ($owned->term !== trim($term) || $owned->normalized_term !== $normalized) {
                $updates['term'] = trim($term);
                $updates['normalized_term'] = $normalized;
            }
            if (! $owned->is_preferred) {
                $updates['is_preferred'] = true;
            }
            if ($updates !== []) {
                $owned->fill($updates)->save();
            }
            if (($updates['is_preferred'] ?? false) === true) {
                $this->demoteOtherPreferredTerms($owned);
            }

            return $owned->fresh();
        }

        if ($onConflict === 'skip') {
            Log::info('ConceptCanonicalizer: locale term already owned by another concept', [
                'locale' => $owned->locale,
                'normalized_term' => $owned->normalized_term,
                'owner_concept_id' => $owned->concept_id,
                'requested_concept_id' => $concept->id,
            ]);

            return null;
        }

        throw new UniqueConstraintViolationException(
            (string) DB::getDefaultConnection(),
            'concept_terms.concept_terms_locale_norm_unique',
            [$owned->locale, $owned->normalized_term],
            new \RuntimeException(sprintf(
                'Duplicate locale_norm %s-%s already owned by concept %d (requested %d)',
                $owned->locale,
                $owned->normalized_term,
                (int) $owned->concept_id,
                (int) $concept->id
            )),
        );
    }

    /**
     * @param  'adopt'|'skip'  $onConflict
     */
    protected function resolveUniqueConflict(
        UniqueConstraintViolationException $e,
        string $onConflict,
        Concept $concept,
        string $locale,
        string $term,
        string $normalized,
        ?string $shortDescription,
        ?string $wikiUrl,
        ?string $mediaUrl,
        int $complexity
    ): ?ConceptTerm {
        $owned = ConceptTerm::query()
            ->where('locale', $locale)
            ->where('normalized_term', $normalized)
            ->first();

        if ($owned instanceof ConceptTerm) {
            return $this->resolveOwnedTerm(
                $owned,
                $concept,
                $term,
                $normalized,
                $shortDescription,
                $wikiUrl,
                $mediaUrl,
                $complexity,
                $onConflict
            );
        }

        throw $e;
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
