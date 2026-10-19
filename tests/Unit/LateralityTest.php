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
