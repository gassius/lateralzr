<?php

namespace App\Models;

use App\Services\ScheduledTasks\ScheduledTaskCatalog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class ScheduledTask extends Model
{
    protected $table = 'scheduled_tasks';

    protected $fillable = [
        'key',
        'enabled',
        'cadence',
        'per_run_cap',
        'options',
        'last_run_at',
        'next_run_at',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'per_run_cap' => 'integer',
        'options' => 'array',
        'last_run_at' => 'datetime',
        'next_run_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (ScheduledTask $task): void {
            if ($task->enabled && $task->next_run_at === null) {
                $task->next_run_at = now();
            }

            if ($task->isDirty('cadence') && $task->last_run_at !== null) {
                $task->next_run_at = ScheduledTaskCatalog::nextRunAt(
                    (string) $task->cadence,
                    Carbon::parse($task->last_run_at)
                );
            }
        });
    }

    public function runs(): HasMany
    {
        return $this->hasMany(ScheduledTaskRun::class)->orderByDesc('id');
    }

    public function isDue(?Carbon $now = null): bool
    {
        if (! $this->enabled) {
            return false;
        }

        $now ??= now();

        if ($this->next_run_at === null) {
            return true;
        }

        return $this->next_run_at->lte($now);
    }

    public function option(string $name, mixed $default = null): mixed
    {
        $options = is_array($this->options) ? $this->options : [];
        if (array_key_exists($name, $options)) {
            return $options[$name];
        }

        try {
            return ScheduledTaskCatalog::defaults($this->key)['options'][$name] ?? $default;
        } catch (\InvalidArgumentException) {
            return $default;
        }
    }

    public function markRan(?Carbon $at = null): void
    {
        $at ??= now();
        $this->last_run_at = $at;
        $this->next_run_at = ScheduledTaskCatalog::nextRunAt((string) $this->cadence, $at);
        $this->save();
    }
}
