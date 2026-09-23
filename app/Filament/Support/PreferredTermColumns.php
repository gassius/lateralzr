<?php

namespace App\Filament\Support;

use App\Models\ConceptTerm;
use App\Support\ConceptLocale;
use Illuminate\Database\Eloquent\Builder;

final class PreferredTermColumns
{
    /**
     * Search localized concept terms instead of the display_term accessor.
     */
    public static function searchTerms(Builder $query, string $search): Builder
    {
        $normalized = ConceptTerm::normalizeTerm($search);

        return $query->whereHas('terms', function (Builder $q) use ($search, $normalized): void {
            $q->where(function (Builder $inner) use ($search, $normalized): void {
                $inner->where('term', 'like', '%'.$search.'%')
                    ->orWhere('normalized_term', 'like', '%'.$normalized.'%');
            });
        });
    }

    /**
     * Sort by a preferred-term column via subquery (accessors are not SQL columns).
     */
    public static function orderByPreferred(
        Builder $query,
        string $column,
        string $direction,
        string $conceptIdColumn = 'concepts.id',
    ): Builder {
        $direction = strtolower($direction) === 'desc' ? 'desc' : 'asc';

        $allowed = ['term', 'complexity', 'wiki_url', 'media_url'];
        if (! in_array($column, $allowed, true)) {
            return $query;
        }

        return $query->orderBy(
            ConceptTerm::query()
                ->select($column)
                ->whereColumn('concept_terms.concept_id', $conceptIdColumn)
                ->where('locale', ConceptLocale::default())
                ->where('is_preferred', true)
                ->limit(1),
            $direction
        );
    }
}
