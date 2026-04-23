<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RelationshipFeedback extends Model
{
    public $timestamps = false;

    protected $table = 'relationship_feedback';

    protected $fillable = [
        'concept_relationship_id',
        'user_id',
        'weight',
        'meta',
        'created_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'weight' => 'integer',
        'created_at' => 'datetime',
    ];

    public function relationship(): BelongsTo
    {
        return $this->belongsTo(ConceptRelationship::class, 'concept_relationship_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

