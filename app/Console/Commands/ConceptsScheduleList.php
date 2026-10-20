<?php

namespace App\Console\Commands;

use App\Models\ScheduledTask;
use App\Services\ScheduledTasks\ScheduledTaskCatalog;
use Illuminate\Console\Command;

class ConceptsScheduleList extends Command
{
    protected $signature = 'concepts:schedule:list';

    protected $description = 'List scheduled concept maintenance tasks.';

    public function handle(): int
    {
        $rows = ScheduledTask::query()->orderBy('id')->get()->map(function (ScheduledTask $task): array {
            return [
                $task->key,
                ScheduledTaskCatalog::label($task->key),
                $task->enabled ? 'enabled' : 'disabled',
                $task->cadence,
                (string) $task->per_run_cap,
                $task->last_run_at?->toDateTimeString() ?? '—',
                $task->next_run_at?->toDateTimeString() ?? '—',
            ];
        })->all();

        $this->table(
            ['Task', 'Label', 'Status', 'Cadence', 'Cap', 'Last run', 'Next run'],
            $rows
        );

        return self::SUCCESS;
    }
}
