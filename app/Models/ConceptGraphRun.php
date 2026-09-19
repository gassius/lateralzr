<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConceptGraphRun extends Model
{
    protected $table = 'concept_graph_runs';

    public const TYPE_GRAPH = 'graph';

    public const TYPE_LOCALIZE = 'localize';

    public const TYPE_COMPLETE_INFO = 'complete_info';

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

    public function isCompleteInfo(): bool
    {
        return $this->type === self::TYPE_COMPLETE_INFO;
    }

    public function isGraph(): bool
    {
        return $this->type === self::TYPE_GRAPH || (! $this->isLocalize() && ! $this->isCompleteInfo());
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

        if ($this->isCompleteInfo()) {
            $locale = data_get($this->seeds, 'locale');
            $mode = (string) data_get($this->seeds, 'mode', 'both');
            $localeLabel = is_string($locale) && $locale !== '' ? $locale : 'all locales';

            return "{$localeLabel} · {$mode}";
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
