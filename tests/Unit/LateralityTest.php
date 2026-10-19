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
}
