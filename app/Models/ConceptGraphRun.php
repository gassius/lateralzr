<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConceptGraphRun extends Model
{
    protected $table = 'concept_graph_runs';

    public const TYPE_GRAPH = 'graph';

    public const TYPE_LOCALIZE = 'localize';

    protected $fillable = [
        'run_uuid',
        'type',
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

    public function isLocalize(): bool
    {
        return $this->type === self::TYPE_LOCALIZE;
    }

    public function isGraph(): bool
    {
        return ! $this->isLocalize();
    }

    public function getTargetCountAttribute(): ?int
    {
        $value = data_get($this->seeds, 'targetCount');

        return is_numeric($value) ? (int) $value : null;
    }

    public function getSummaryAttribute(): string
    {
        if ($this->isLocalize()) {
            $from = (string) data_get($this->seeds, 'from', '?');
            $to = (string) data_get($this->seeds, 'to', '?');
            $missing = data_get($this->seeds, 'missingOnly', true) ? 'missing-only' : 'all';

            return "{$from} → {$to} ({$missing})";
        }

        $starts = data_get($this->seeds, 'starts', []);
        if (is_array($starts) && count($starts) > 0) {
            $preview = implode(', ', array_slice(array_map('strval', $starts), 0, 3));
            if (count($starts) > 3) {
                $preview .= '…';
            }

            return $preview;
        }

        return data_get($this->seeds, 'randomIdea') ? 'random idea' : '—';
    }

    public function jobs(): HasMany
    {
        return $this->hasMany(ConceptGraphRunJob::class, 'run_uuid', 'run_uuid');
    }
}
