<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SchedulerTest extends Command
{
    protected $signature = 'scheduler:test';

    protected $description = 'Log a heartbeat proving the Laravel scheduler is running.';

    public function handle(): int
    {
        $message = sprintf(
            'Scheduler Test ran at %s on %s',
            now()->format('H:i:s'),
            now()->format('d/m/Y')
        );

        Log::info($message);
        $this->info($message);

        return self::SUCCESS;
    }
}
