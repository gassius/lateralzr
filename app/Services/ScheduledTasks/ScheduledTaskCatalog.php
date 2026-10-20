<?php

namespace App\Services\ScheduledTasks;

use App\Support\ConceptLocale;
use Cron\CronExpression;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

class ScheduledTaskCatalog
{
    public const GROW_SPARSE = 'grow-sparse';

    public const FILL_MISSING = 'fill-missing';

    public const NAMED_CADENCES = ['hourly', 'daily', 'weekly'];

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return [self::GROW_SPARSE, self::FILL_MISSING];
    }

    public static function label(string $key): string
    {
        return match ($key) {
            self::GROW_SPARSE => 'Grow sparse graph',
            self::FILL_MISSING => 'Fill missing locale/images',
            default => $key,
        };
    }

    /**
     * @return array{cadence: string, per_run_cap: int, options: array<string, mixed>}
     */
    public static function defaults(string $key): array
    {
        $configured = config('concepts.scheduled_tasks.'.$key, []);

        return match ($key) {
            self::GROW_SPARSE => [
                'cadence' => (string) ($configured['cadence'] ?? 'daily'),
                'per_run_cap' => (int) ($configured['per_run_cap'] ?? 10),
                'options' => array_merge([
                    'threshold' => 2,
                    'count' => 10,
                    'complexity' => 3,
                    'depth' => 1,
                ], is_array($configured['options'] ?? null) ? $configured['options'] : []),
            ],
            self::FILL_MISSING => [
                'cadence' => (string) ($configured['cadence'] ?? 'daily'),
                'per_run_cap' => (int) ($configured['per_run_cap'] ?? 20),
                'options' => array_merge([
                    'locale' => 'es',
                    'from' => 'en',
                    'fill_locale' => true,
                    'fill_images' => true,
                ], is_array($configured['options'] ?? null) ? $configured['options'] : []),
            ],
            default => throw new InvalidArgumentException("Unknown scheduled task [{$key}]."),
        };
    }

    public static function normalizeCadence(string $cadence): string
    {
        $cadence = strtolower(trim($cadence));
        if ($cadence === '') {
            throw new InvalidArgumentException('Cadence cannot be empty.');
        }

        if (in_array($cadence, self::NAMED_CADENCES, true)) {
            return $cadence;
        }

        if (CronExpression::isValidExpression($cadence)) {
            return $cadence;
        }

        throw new InvalidArgumentException(
            "Invalid cadence [{$cadence}]. Use hourly, daily, weekly, or a cron expression."
        );
    }

    public static function normalizeCap(int $cap): int
    {
        if ($cap < 1) {
            throw new InvalidArgumentException('Per-run cap must be at least 1.');
        }

        return min(200, $cap);
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public static function normalizeOptions(string $key, array $options): array
    {
        $defaults = self::defaults($key)['options'];

        return match ($key) {
            self::GROW_SPARSE => [
                'threshold' => max(0, (int) ($options['threshold'] ?? $defaults['threshold'])),
                'count' => max(1, min(100, (int) ($options['count'] ?? $defaults['count']))),
                'complexity' => max(1, min(5, (int) ($options['complexity'] ?? $defaults['complexity']))),
                'depth' => max(1, min(3, (int) ($options['depth'] ?? $defaults['depth']))),
            ],
            self::FILL_MISSING => self::normalizeFillMissingOptions($options, $defaults),
            default => throw new InvalidArgumentException("Unknown scheduled task [{$key}]."),
        };
    }

    public static function nextRunAt(string $cadence, Carbon $from): Carbon
    {
        $cadence = self::normalizeCadence($cadence);

        return match ($cadence) {
            'hourly' => $from->copy()->addHour(),
            'daily' => $from->copy()->addDay(),
            'weekly' => $from->copy()->addWeek(),
            default => Carbon::instance((new CronExpression($cadence))->getNextRunDate($from)),
        };
    }

    /**
     * @param  array<string, mixed>  $options
     * @param  array<string, mixed>  $defaults
     * @return array<string, mixed>
     */
    protected static function normalizeFillMissingOptions(array $options, array $defaults): array
    {
        $locale = strtolower(trim((string) ($options['locale'] ?? $defaults['locale'])));
        $from = strtolower(trim((string) ($options['from'] ?? $defaults['from'])));
        $supported = ConceptLocale::supported();

        if (! in_array($locale, $supported, true) || ! in_array($from, $supported, true)) {
            throw new InvalidArgumentException(
                'Locale must be in supported list: '.implode(', ', $supported)
            );
        }

        if ($locale === $from) {
            throw new InvalidArgumentException('Fill-missing locale and from must differ.');
        }

        return [
            'locale' => $locale,
            'from' => $from,
            'fill_locale' => self::bool($options['fill_locale'] ?? $defaults['fill_locale']),
            'fill_images' => self::bool($options['fill_images'] ?? $defaults['fill_images']),
        ];
    }

    public static function assertKnown(string $key): string
    {
        if (! in_array($key, self::keys(), true)) {
            throw new InvalidArgumentException("Unknown scheduled task [{$key}].");
        }

        return $key;
    }

    protected static function bool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'on'], true);
    }
}
