<?php

namespace App\Support;

/**
 * Relationship laterality on a 0–1 scale.
 *
 * Anchors: Ball–Baseball = 0 (same domain), Ball–Algorithm = 1 (no surface link).
 * Legacy integer grades 1–5 map to 0, 0.25, 0.5, 0.75, 1.
 */
final class Laterality
{
    public const MIN = 0.0;

    public const MAX = 1.0;

    /**
     * NULL stored laterality is treated as this value (legacy grade 3).
     */
    public const NULL_DEFAULT = 0.5;

    public const PRECISION = 2;

    /**
     * @var array<int, float>
     */
    public const LEGACY_INTEGER_MAP = [
        1 => 0.0,
        2 => 0.25,
        3 => 0.5,
        4 => 0.75,
        5 => 1.0,
    ];

    public static function clamp(float $value): float
    {
        return round(max(self::MIN, min(self::MAX, $value)), self::PRECISION);
    }

    /**
     * Parse a 0–1 laterality. Values outside [0, 1] are rejected (not clamped)
     * so a model still emitting the old 1–5 integers does not silently store 1.0.
     */
    public static function normalize(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value)) {
            return null;
        }

        $float = (float) $value;
        if ($float < self::MIN || $float > self::MAX) {
            return null;
        }

        return self::clamp($float);
    }

    public static function fromLegacyInteger(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value)) {
            return null;
        }

        $int = (int) $value;

        return self::LEGACY_INTEGER_MAP[$int] ?? self::clamp(($int - 1) / 4);
    }

    public static function toLegacyInteger(?float $value): ?int
    {
        if ($value === null) {
            return null;
        }

        $value = self::clamp($value);
        $best = 3;
        $bestDistance = PHP_FLOAT_MAX;

        foreach (self::LEGACY_INTEGER_MAP as $grade => $mapped) {
            $distance = abs($value - $mapped);
            if ($distance < $bestDistance) {
                $bestDistance = $distance;
                $best = $grade;
            }
        }

        return $best;
    }

    public static function inBand(float $value, float $min, float $max): bool
    {
        $value = self::clamp($value);
        $min = self::clamp($min);
        $max = self::clamp($max);

        if ($min > $max) {
            [$min, $max] = [$max, $min];
        }

        return $value + 1e-9 >= $min && $value - 1e-9 <= $max;
    }
}
