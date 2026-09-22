<?php

use Illuminate\Support\Facades\Schedule;

// Class-based commands in app/Console/Commands are auto-discovered by Laravel 12.
// Schedules belong here (or bootstrap/app.php withSchedule).

Schedule::command('scheduler:test')
    ->everyFifteenMinutes()
    ->appendOutputTo(storage_path('logs/scheduler-test.log'));
