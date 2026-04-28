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

    public function getDisplayStatusAttribute(): string
    {
        if ($this->isStaleProcessing()) {
            return 'timed_out';
        }

        return (string) $this->status;
    }

    public function getDisplayErrorAttribute(): ?string
    {
        if ($this->error_message) {
            return $this->error_message;
        }

        if ($this->isStaleProcessing()) {
            return 'Still marked processing after the expected worker timeout. This is probably a legacy timeout before failure details were recorded; check failed queue jobs or retry this batch.';
        }

        return null;
    }

    protected function isStaleProcessing(): bool
    {
        return $this->status === 'processing'
            && $this->started_at?->lt(now()->subMinutes(5));
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(ConceptGraphRun::class, 'run_uuid', 'run_uuid');
    }
}
