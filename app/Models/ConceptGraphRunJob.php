<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConceptGraphRunJob extends Model
{
    protected $table = 'concept_graph_run_jobs';

    protected $fillable = [
        'run_uuid',
        'seed',
        'status',
        'attempts',
        'started_at',
        'finished_at',
        'error_message',
    ];

    protected $casts = [
        'attempts' => 'integer',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(ConceptGraphRun::class, 'run_uuid', 'run_uuid');
    }
}

