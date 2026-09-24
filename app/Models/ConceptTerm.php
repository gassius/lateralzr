<?php

namespace App\Models;

use App\Support\ConceptLocale;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConceptTerm extends Model
{
    protected $table = 'concept_terms';

    protected $fillable = [
        'concept_id',
        'locale',
        'term',
        'normalized_term',
        'short_description',
        'wiki_url',
        'media_url',
        'complexity',
        'is_preferred',
    ];

    protected $casts = [
        'is_preferred' => 'boolean',
        'complexity' => 'integer',
    ];

    public function concept(): BelongsTo
    {
        return $this->belongsTo(Concept::class);
    }

    public static function normalizeTerm(string $term): string
    {
        $t = trim(mb_strtolower($term));
        $t = preg_replace('/\s+/u', ' ', $t) ?? $t;
        $t = trim($t, " \t\n\r\0\x0B\"'`.,;:!?()[]{}<>");

        return $t;
    }

    /**
     * Apply locale / normalized_term / complexity / is_preferred defaults after Filament persists terms.
     */
    public static function applyPersistedDefaults(HasMany $terms): void
    {
        $terms->each(function (self $term): void {
            if ($term->locale === null || $term->locale === '') {
                $term->locale = ConceptLocale::default();
            }
            $term->normalized_term = self::normalizeTerm((string) $term->term);
            $term->complexity = max(1, min(5, (int) ($term->complexity ?? config('concepts.default_complexity', 2))));
            if ($term->is_preferred === null) {
                $term->is_preferred = true;
            }
            $term->save();
        });
    }
}
