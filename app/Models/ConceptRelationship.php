<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConceptRelationship extends Model
{
    protected $table = 'concept_relationships';

    protected $fillable = [
        'from_concept_id',
        'to_concept_id',
        'relationship_type',
        'complexity',
        'strength',
        'last_generated_at',
        'llm_occurrences',
        'user_weight',
        'last_larelality',
    ];

    protected $casts = [
        'complexity' => 'integer',
        'llm_occurrences' => 'integer',
        'user_weight' => 'integer',
        'strength' => 'decimal:5',
        'last_generated_at' => 'datetime',
        'last_larelality' => 'integer',
    ];

    public function fromConcept(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'from_concept_id');
    }

    public function toConcept(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'to_concept_id');
    }

    public function evidences(): HasMany
    {
        return $this->hasMany(RelationshipEvidence::class, 'concept_relationship_id');
    }

    public function feedback(): HasMany
    {
        return $this->hasMany(RelationshipFeedback::class, 'concept_relationship_id');
    }
}

