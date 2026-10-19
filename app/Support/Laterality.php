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
     * Exact-score match window for `laterality_score`.
     */
    public const SCORE_MATCH_TOLERANCE = 0.005;

    /**
     * Half the 0.25 step between legacy grade anchors. Grade g uses
     * [anchor−0.125, anchor+0.125), closed at 0 and 1.
     */
    public const GRADE_HALF_STEP = 0.125;

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

    /**
     * Map a stored 1–5 integer onto 0–1. Out-of-range ints are rejected (not clamped).
     */
    public static function fromLegacyInteger(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value)) {
            return null;
        }

        $int = (int) $value;

        return self::LEGACY_INTEGER_MAP[$int] ?? null;
    }

    /**
     * Nearest 1–5 grade, matching ROUND(score*4)+1 (half-up).
     * Ties at x.125 / x.375 / x.625 / x.875 go to the higher grade.
     */
    public static function toLegacyInteger(?float $value): ?int
    {
        if ($value === null) {
            return null;
        }

        $value = self::clamp($value);
        $grade = (int) round($value * 4) + 1;

        return max(1, min(5, $grade));
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

    /**
     * Resolve the public graph-read params onto the stored 0–1 score.
     * `laterality_score` (0–1) wins when present; otherwise `laterality` is a legacy 1–5 grade.
     */
    public static function fromApiRequest(mixed $legacyGrade, mixed $score): ?float
    {
        if ($score !== null && $score !== '') {
            return self::normalize($score);
        }

        if ($legacyGrade === null || $legacyGrade === '') {
            return null;
        }

        if (! is_numeric($legacyGrade)) {
            return null;
        }

        $int = (int) $legacyGrade;

        return self::LEGACY_INTEGER_MAP[$int] ?? null;
    }

    public static function requestUsesLegacyGrade(mixed $legacyGrade, mixed $score): bool
    {
        if ($score !== null && $score !== '') {
            return false;
        }

        return $legacyGrade !== null && $legacyGrade !== '';
    }

    /**
     * Half-open nearest-grade interval, closed at 0 and 1.
     * Grade 1: [0, 0.125). Grade 5: [0.875, 1].
     *
     * @return array{min: float, max: float, minInclusive: bool, maxInclusive: bool}|null
     */
    public static function gradeInterval(int $grade): ?array
    {
        if (! isset(self::LEGACY_INTEGER_MAP[$grade])) {
            return null;
        }

        $anchor = self::LEGACY_INTEGER_MAP[$grade];

        return [
            'min' => $grade === 1 ? self::MIN : $anchor - self::GRADE_HALF_STEP,
            'max' => $grade === 5 ? self::MAX : $anchor + self::GRADE_HALF_STEP,
            'minInclusive' => true,
            'maxInclusive' => $grade === 5,
        ];
    }

    /**
     * Public graph JSON: `laterality` stays the client 1–5 grade; `laterality_score` is 0–1.
     *
     * @return array{laterality: int, laterality_score: float}
     */
    public static function publicFields(float $score): array
    {
        $score = self::clamp($score);

        return [
            'laterality' => self::toLegacyInteger($score),
            'laterality_score' => $score,
        ];
    }
}
