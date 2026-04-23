<?php

namespace App\Models;

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

    public function preferredTerm(): HasOne
    {
        $locale = (string) config('concepts.default_locale', 'en');

        return $this->hasOne(ConceptTerm::class)
            ->where('locale', $locale)
            ->where('is_preferred', true);
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
}
