<?php

namespace App\Console\Commands;

use App\Services\ScheduledTasks\ScheduledTaskRunner;
use Illuminate\Console\Command;
use InvalidArgumentException;

class ConceptsScheduleSet extends Command
{
    protected $signature = 'concepts:schedule:set
        {task : Task key (grow-sparse|fill-missing)}
        {--cadence= : hourly, daily, weekly, or a cron expression}
        {--cap= : Per-run cap}';

    protected $description = 'Update cadence and/or per-run cap for a scheduled concept maintenance task.';

    public function handle(ScheduledTaskRunner $runner): int
    {
        $cadence = $this->option('cadence');
        $cap = $this->option('cap');

        if (($cadence === null || $cadence === '') && ($cap === null || $cap === '')) {
            $this->error('Provide --cadence and/or --cap.');

            return self::FAILURE;
        }

        try {
            $task = $runner->configure(
                key: (string) $this->argument('task'),
                cadence: is_string($cadence) && $cadence !== '' ? $cadence : null,
                cap: $cap !== null && $cap !== '' ? (int) $cap : null,
            );
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Updated {$task->key}. cadence={$task->cadence} cap={$task->per_run_cap} next_run_at=".($task->next_run_at?->toDateTimeString() ?? '—'));

        return self::SUCCESS;
    }
}
