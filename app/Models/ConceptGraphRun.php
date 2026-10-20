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

    public const TYPE_PIPELINE = 'pipeline';

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

    public function isPipeline(): bool
    {
        return $this->type === self::TYPE_PIPELINE;
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

        if ($this->isPipeline()) {
            $starts = data_get($this->seeds, 'starts', []);
            $preview = is_array($starts) && $starts !== []
                ? implode(', ', array_slice(array_map('strval', $starts), 0, 3))
                : 'pipeline';
            if (is_array($starts) && count($starts) > 3) {
                $preview .= '…';
            }
            $depth = data_get($this->seeds, 'depth', 1);

            return "{$preview} · depth {$depth}";
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

    public function pipelineNodes(): HasMany
    {
        return $this->hasMany(ConceptPipelineNode::class, 'run_uuid', 'run_uuid');
    }

    /**
     * @return array<string, array<string, int>>
     */
    public function pipelineStageAggregates(): array
    {
        $aggregates = [];
        foreach (ConceptPipelineNode::STAGES as $stage) {
            $column = match ($stage) {
                ConceptPipelineNode::STAGE_GENERATE => 'generate_status',
                ConceptPipelineNode::STAGE_LOCALIZE => 'localize_status',
                ConceptPipelineNode::STAGE_COMPLETE_INFO => 'complete_info_status',
            };

            $aggregates[$stage] = $this->pipelineNodes()
                ->selectRaw("{$column} as status, count(*) as total")
                ->groupBy($column)
                ->pluck('total', 'status')
                ->map(fn ($total) => (int) $total)
                ->all();
        }

        return $aggregates;
    }
}
