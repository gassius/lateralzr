<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConceptGraphRun extends Model
{
    protected $table = 'concept_graph_runs';

    protected $fillable = [
        'run_uuid',
        'provider',
        'model',
        'complexity',
        'queue',
        'seed_count',
        'seeds',
        'related_count',
        'dispatched_at',
    ];

    protected $casts = [
        'complexity' => 'integer',
        'seed_count' => 'integer',
        'seeds' => 'array',
        'related_count' => 'integer',
        'dispatched_at' => 'datetime',
    ];

    public function jobs(): HasMany
    {
        return $this->hasMany(ConceptGraphRunJob::class, 'run_uuid', 'run_uuid');
    }
}

