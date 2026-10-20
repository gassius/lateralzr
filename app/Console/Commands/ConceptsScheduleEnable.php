<?php

namespace App\Console\Commands;

use App\Services\ScheduledTasks\ScheduledTaskRunner;
use Illuminate\Console\Command;
use InvalidArgumentException;

class ConceptsScheduleEnable extends Command
{
    protected $signature = 'concepts:schedule:enable {task : Task key (grow-sparse|fill-missing)}';

    protected $description = 'Enable a scheduled concept maintenance task.';

    public function handle(ScheduledTaskRunner $runner): int
    {
        try {
            $task = $runner->enable((string) $this->argument('task'));
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Enabled {$task->key}. cadence={$task->cadence} cap={$task->per_run_cap} next_run_at=".($task->next_run_at?->toDateTimeString() ?? '—'));

        return self::SUCCESS;
    }
}
