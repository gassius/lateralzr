<?php

namespace App\Console\Commands;

use App\Services\ScheduledTasks\ScheduledTaskRunner;
use Illuminate\Console\Command;
use InvalidArgumentException;

class ConceptsScheduleDisable extends Command
{
    protected $signature = 'concepts:schedule:disable {task : Task key (grow-sparse|fill-missing)}';

    protected $description = 'Disable a scheduled concept maintenance task.';

    public function handle(ScheduledTaskRunner $runner): int
    {
        try {
            $task = $runner->disable((string) $this->argument('task'));
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Disabled {$task->key}.");

        return self::SUCCESS;
    }
}
