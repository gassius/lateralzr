<?php

namespace Tests\Feature;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class SchedulerTestCommandTest extends TestCase
{
    public function test_scheduler_test_command_logs_expected_message(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 9, 17, 14, 30, 5));

        Log::shouldReceive('info')
            ->once()
            ->with('Scheduler Test ran at 14:30:05 on 17/09/2026');

        $this->artisan('scheduler:test')
            ->expectsOutput('Scheduler Test ran at 14:30:05 on 17/09/2026')
            ->assertSuccessful();
    }

    public function test_scheduler_test_is_scheduled_every_fifteen_minutes(): void
    {
        $this->artisan('schedule:list')
            ->expectsOutputToContain('scheduler:test')
            ->assertSuccessful();

        $event = collect(app(Schedule::class)->events())
            ->first(function ($event) {
                $haystack = implode(' ', array_filter([
                    $event->command ?? null,
                    $event->description ?? null,
                ]));

                return str_contains($haystack, 'scheduler:test');
            });

        $this->assertNotNull($event, 'scheduler:test should be registered on the Laravel schedule.');
        $this->assertSame('*/15 * * * *', $event->expression);
    }
}
