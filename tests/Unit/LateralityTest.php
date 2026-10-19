<?php

namespace Tests\Unit;

use App\Support\Laterality;
use Tests\TestCase;

class LateralityTest extends TestCase
{
    public function test_legacy_integers_round_trip(): void
    {
        foreach (Laterality::LEGACY_INTEGER_MAP as $grade => $mapped) {
            $this->assertSame($mapped, Laterality::fromLegacyInteger($grade));
            $this->assertSame($grade, Laterality::toLegacyInteger($mapped));
        }

        $this->assertNull(Laterality::fromLegacyInteger(0));
        $this->assertNull(Laterality::fromLegacyInteger(9));
    }

    public function test_to_legacy_integer_uses_round_half_up_matching_down_migration(): void
    {
        $this->assertSame(1, Laterality::toLegacyInteger(0.0));
        $this->assertSame(2, Laterality::toLegacyInteger(0.125));
        $this->assertSame(2, Laterality::toLegacyInteger(0.25));
        $this->assertSame(3, Laterality::toLegacyInteger(0.375));
        $this->assertSame(3, Laterality::toLegacyInteger(0.45));
        $this->assertSame(3, Laterality::toLegacyInteger(0.5));
        $this->assertSame(4, Laterality::toLegacyInteger(0.625));
        $this->assertSame(5, Laterality::toLegacyInteger(0.875));
        $this->assertSame(5, Laterality::toLegacyInteger(1.0));
        $this->assertSame(3, (int) round(0.45 * 4) + 1);
    }

    public function test_grade_interval_is_half_open_and_matches_to_legacy_integer(): void
    {
        $samples = [0.0, 0.12, 0.125, 0.25, 0.375, 0.45, 0.5, 0.6, 0.625, 0.75, 0.875, 1.0];
        foreach ($samples as $score) {
            $grade = Laterality::toLegacyInteger($score);
            $this->assertNotNull($grade);
            $interval = Laterality::gradeInterval($grade);
            $this->assertNotNull($interval);
            $minOk = $interval['minInclusive'] ? $score + 1e-12 >= $interval['min'] : $score > $interval['min'];
            $maxOk = $interval['maxInclusive'] ? $score - 1e-12 <= $interval['max'] : $score < $interval['max'];
            $this->assertTrue($minOk && $maxOk, "score {$score} should sit in grade {$grade} interval");

            foreach ([1, 2, 3, 4, 5] as $other) {
                if ($other === $grade) {
                    continue;
                }
                $otherInterval = Laterality::gradeInterval($other);
                $this->assertNotNull($otherInterval);
                $inOtherMin = $otherInterval['minInclusive'] ? $score + 1e-12 >= $otherInterval['min'] : $score > $otherInterval['min'];
                $inOtherMax = $otherInterval['maxInclusive'] ? $score - 1e-12 <= $otherInterval['max'] : $score < $otherInterval['max'];
                $this->assertFalse($inOtherMin && $inOtherMax, "score {$score} must not also sit in grade {$other}");
            }
        }
    }

    public function test_normalize_rejects_old_integer_grades(): void
    {
        $this->assertNull(Laterality::normalize(3));
        $this->assertNull(Laterality::normalize(4));
        $this->assertNull(Laterality::normalize(-0.1));
        $this->assertNull(Laterality::normalize(1.01));
        $this->assertSame(0.0, Laterality::normalize(0));
        $this->assertSame(1.0, Laterality::normalize(1));
        $this->assertSame(0.47, Laterality::normalize(0.47));
    }

    public function test_in_band_uses_inclusive_bounds(): void
    {
        $this->assertTrue(Laterality::inBand(0.4, 0.4, 0.6));
        $this->assertTrue(Laterality::inBand(0.6, 0.4, 0.6));
        $this->assertTrue(Laterality::inBand(0.5, 0.4, 0.6));
        $this->assertFalse(Laterality::inBand(0.25, 0.4, 0.6));
        $this->assertFalse(Laterality::inBand(0.75, 0.4, 0.6));
    }

    public function test_from_api_request_maps_legacy_grade_and_prefers_score(): void
    {
        $this->assertSame(0.0, Laterality::fromApiRequest(1, null));
        $this->assertSame(0.25, Laterality::fromApiRequest(2, null));
        $this->assertSame(0.5, Laterality::fromApiRequest(3, null));
        $this->assertSame(0.75, Laterality::fromApiRequest(4, null));
        $this->assertSame(1.0, Laterality::fromApiRequest(5, null));
        $this->assertNull(Laterality::fromApiRequest(6, null));
        $this->assertNull(Laterality::fromApiRequest(null, null));

        $this->assertSame(0.47, Laterality::fromApiRequest(null, 0.47));
        $this->assertSame(0.0, Laterality::fromApiRequest(5, 0.0));
        $this->assertSame(1.0, Laterality::fromApiRequest(1, 1));
    }

    public function test_public_fields_keep_legacy_grade_and_score(): void
    {
        $this->assertSame(['laterality' => 1, 'laterality_score' => 0.0], Laterality::publicFields(0.0));
        $this->assertSame(['laterality' => 4, 'laterality_score' => 0.75], Laterality::publicFields(0.75));
        $this->assertSame(['laterality' => 5, 'laterality_score' => 1.0], Laterality::publicFields(1.0));
        $this->assertSame(['laterality' => 3, 'laterality_score' => 0.5], Laterality::publicFields(0.5));
    }
}
