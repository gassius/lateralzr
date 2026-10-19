<?php

namespace App\Console\Commands;

use App\Services\ScheduledTasks\ScheduledTaskRunner;
use Illuminate\Console\Command;
use InvalidArgumentException;
use Throwable;

class ConceptsScheduleRun extends Command
{
    protected $signature = 'concepts:schedule:run {task : Task key (grow-sparse|fill-missing)}';

    protected $description = 'Manually run a scheduled concept maintenance task and record history.';

    public function handle(ScheduledTaskRunner $runner): int
    {
        try {
            $history = $runner->run((string) $this->argument('task'));
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $uuid = $history->pipeline_run_uuid ?? '—';
        $this->info("Ran {$history->task_key}. status={$history->status} items={$history->items_processed} run_uuid={$uuid}");

        return self::SUCCESS;
    }
}
