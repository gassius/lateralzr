<?php

namespace App\Models;

use App\Filament\Pages\GenerationProgress;
use App\Filament\Resources\ConceptGraphRuns\ConceptGraphRunResource;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduledTaskRun extends Model
{
    public const STATUS_RUNNING = 'running';

    public const STATUS_SUCCEEDED = 'succeeded';

    public const STATUS_FAILED = 'failed';

    public const TRIGGER_SCHEDULED = 'scheduled';

    public const TRIGGER_MANUAL = 'manual';

    protected $table = 'scheduled_task_runs';

    protected $fillable = [
        'scheduled_task_id',
        'task_key',
        'trigger',
        'status',
        'items_processed',
        'pipeline_run_uuid',
        'details',
        'error',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'items_processed' => 'integer',
        'details' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(ScheduledTask::class, 'scheduled_task_id');
    }

    public function linkedGraphRun(): ?ConceptGraphRun
    {
        if ($this->pipeline_run_uuid === null || $this->pipeline_run_uuid === '') {
            return null;
        }

        return ConceptGraphRun::query()->where('run_uuid', $this->pipeline_run_uuid)->first();
    }

    /**
     * @return list<ConceptGraphRun>
     */
    public function linkedGraphRuns(): array
    {
        $uuids = data_get($this->details, 'run_uuids', []);
        if (! is_array($uuids) || $uuids === []) {
            $uuids = array_filter([(string) $this->pipeline_run_uuid]);
        }

        $uuids = array_values(array_unique(array_filter(array_map('strval', $uuids))));
        if ($uuids === []) {
            return [];
        }

        return ConceptGraphRun::query()
            ->whereIn('run_uuid', $uuids)
            ->get()
            ->all();
    }

    public function urlForGraphRun(ConceptGraphRun $run): string
    {
        if ($run->isPipeline()) {
            return GenerationProgress::getUrl(['record' => $run]);
        }

        return ConceptGraphRunResource::getUrl('view', ['record' => $run]);
    }
}
