<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Class-based commands in app/Console/Commands are auto-discovered by Laravel 12.
// Schedules belong here (or bootstrap/app.php withSchedule) — App\Console\Kernel is not used.

Schedule::command('scheduler:test')
    ->everyFifteenMinutes()
    ->appendOutputTo(storage_path('logs/scheduler-test.log'));
