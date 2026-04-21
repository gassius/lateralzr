<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConceptRelationship extends Model
{
    protected $table = 'concept_relationships';

    protected $fillable = [
        'from_concept_id',
        'to_concept_id',
        'complexity',
        'larelality',
        'llm_occurrences',
        'user_weight',
        'strength',
        'provider',
        'model',
        'last_run_uuid',
        'last_generated_at',
    ];

    protected $casts = [
        'complexity' => 'integer',
        'larelality' => 'integer',
        'llm_occurrences' => 'integer',
        'user_weight' => 'integer',
        'strength' => 'decimal:5',
        'last_generated_at' => 'datetime',
    ];

    public function fromConcept(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'from_concept_id');
    }

    public function toConcept(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'to_concept_id');
    }
}

