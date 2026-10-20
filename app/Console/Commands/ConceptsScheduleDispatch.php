<?php

namespace App\Console\Commands;

use App\Services\ScheduledTasks\ScheduledTaskRunner;
use Illuminate\Console\Command;

class ConceptsScheduleDispatch extends Command
{
    protected $signature = 'concepts:schedule:dispatch';

    protected $description = 'Run enabled scheduled concept maintenance tasks that are due.';

    public function handle(ScheduledTaskRunner $runner): int
    {
        $ran = $runner->dispatchDue();

        if ($ran === 0) {
            $this->info('No due scheduled tasks.');

            return self::SUCCESS;
        }

        $this->info("Ran {$ran} scheduled task(s).");

        return self::SUCCESS;
    }
}
