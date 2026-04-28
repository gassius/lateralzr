<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RelationshipEvidence extends Model
{
    public $timestamps = false;

    protected $table = 'relationship_evidences';

    protected $fillable = [
        'concept_relationship_id',
        'provider',
        'model',
        'run_uuid',
        'laterality',
        'from_term',
        'to_term',
        'raw_json',
        'created_at',
    ];

    protected $casts = [
        'raw_json' => 'array',
        'laterality' => 'integer',
        'created_at' => 'datetime',
    ];

    public function relationship(): BelongsTo
    {
        return $this->belongsTo(ConceptRelationship::class, 'concept_relationship_id');
    }
}
