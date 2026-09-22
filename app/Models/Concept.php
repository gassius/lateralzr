<?php

namespace App\Models;

use App\Support\ConceptLocale;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Concept extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'concepts';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'canonical_key',
        'merged_into_concept_id',
    ];

    protected $casts = [
        'merged_into_concept_id' => 'integer',
    ];

    public function terms(): HasMany
    {
        return $this->hasMany(ConceptTerm::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(ConceptMedia::class)->orderBy('position')->orderBy('id');
    }

    public function preferredTerm(): HasOne
    {
        $locale = ConceptLocale::default();

        return $this->hasOne(ConceptTerm::class)
            ->where('locale', $locale)
            ->where('is_preferred', true);
    }

    /**
     * Preferred term for a locale, falling back to the default locale when missing.
     */
    public function termForLocale(?string $locale = null, bool $fallback = true): ?ConceptTerm
    {
        $locale = ConceptLocale::resolve($locale);

        $terms = $this->relationLoaded('terms') ? $this->terms : null;

        $match = function (string $wanted) use ($terms): ?ConceptTerm {
            if ($terms !== null) {
                return $terms
                    ->where('locale', $wanted)
                    ->sortByDesc(fn (ConceptTerm $term) => $term->is_preferred ? 1 : 0)
                    ->first();
            }

            return $this->terms()
                ->where('locale', $wanted)
                ->orderByDesc('is_preferred')
                ->first();
        };

        $term = $match($locale);
        if ($term !== null) {
            return $term;
        }

        if ($fallback && $locale !== ConceptLocale::default()) {
            return $match(ConceptLocale::default());
        }

        return null;
    }

    public function getDisplayTermAttribute(): ?string
    {
        return $this->preferredTerm?->term;
    }

    public function getDisplayShortDescriptionAttribute(): ?string
    {
        return $this->preferredTerm?->short_description;
    }

    public function getDisplayWikiUrlAttribute(): ?string
    {
        return $this->preferredTerm?->wiki_url;
    }

    public function getDisplayMediaUrlAttribute(): ?string
    {
        return $this->preferredTerm?->media_url;
    }

    public function getDisplayComplexityAttribute(): int
    {
        return (int) ($this->preferredTerm?->complexity ?? config('concepts.default_complexity', 2));
    }
}
