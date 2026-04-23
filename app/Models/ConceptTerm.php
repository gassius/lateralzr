<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
        'is_preferred',
    ];

    protected $casts = [
        'is_preferred' => 'boolean',
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
}

