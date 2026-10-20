<?php

namespace Tests\Unit;

use App\Services\ScheduledTasks\ScheduledTaskCatalog;
use Illuminate\Support\Carbon;
use InvalidArgumentException;
use Tests\TestCase;

class ScheduledTaskCadenceTest extends TestCase
{
    public function test_named_cadences_advance_from_the_given_instant(): void
    {
        $from = Carbon::parse('2026-10-19 12:00:00');

        $this->assertSame('2026-10-19 13:00:00', ScheduledTaskCatalog::nextRunAt('hourly', $from)->toDateTimeString());
        $this->assertSame('2026-10-20 12:00:00', ScheduledTaskCatalog::nextRunAt('daily', $from)->toDateTimeString());
        $this->assertSame('2026-10-26 12:00:00', ScheduledTaskCatalog::nextRunAt('weekly', $from)->toDateTimeString());
    }

    public function test_cron_cadence_uses_the_next_matching_time(): void
    {
        $from = Carbon::parse('2026-10-19 12:15:00');

        $this->assertSame('2026-10-20 03:00:00', ScheduledTaskCatalog::nextRunAt('0 3 * * *', $from)->toDateTimeString());
    }

    public function test_invalid_cadence_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ScheduledTaskCatalog::normalizeCadence('sometimes');
    }

    public function test_fill_missing_options_reject_matching_locales(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('must differ');

        ScheduledTaskCatalog::normalizeOptions('fill-missing', [
            'locale' => 'es',
            'from' => 'es',
            'fill_locale' => true,
            'fill_images' => true,
        ]);
    }

    public function test_fill_missing_options_reject_unsupported_locale(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('supported list');

        ScheduledTaskCatalog::normalizeOptions('fill-missing', [
            'locale' => 'xx',
            'from' => 'en',
            'fill_locale' => true,
            'fill_images' => true,
        ]);
    }
}
