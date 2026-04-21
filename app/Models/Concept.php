<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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
        'concept',
        'complexity',
        'short_description',
        'wiki_url',
        'media_url',
    ];

    protected $casts = [
        'complexity' => 'integer',
    ];

    /**
     * Normalize a concept string for consistent lookup (trim + lowercase).
     */
    public static function normalizeConcept(string $concept): string
    {
        return strtolower(trim($concept));
    }
}
