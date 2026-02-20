<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConceptUrl extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'concept',
        'wiki_url',
        'media_url',
    ];

    /**
     * Normalize a concept string for consistent lookup (trim + lowercase).
     */
    public static function normalizeConcept(string $concept): string
    {
        return strtolower(trim($concept));
    }
}
