<?php

namespace Tests\Unit;

use App\Services\Enrichment\MediaLicense;
use PHPUnit\Framework\TestCase;

class MediaLicenseTest extends TestCase
{
    public function test_accepts_cc0_and_public_domain(): void
    {
        $this->assertSame('CC0', MediaLicense::qualify([
            'LicenseShortName' => ['value' => 'CC0'],
            'LicenseUrl' => ['value' => 'https://creativecommons.org/publicdomain/zero/1.0/'],
            'UsageTerms' => ['value' => 'Creative Commons Zero'],
            'AttributionRequired' => ['value' => 'false'],
        ]));

        $this->assertSame('Public domain', MediaLicense::qualify([
            'LicenseShortName' => ['value' => 'Public domain'],
            'UsageTerms' => ['value' => 'Public domain'],
            'AttributionRequired' => ['value' => 'false'],
        ]));
    }

    public function test_rejects_barque_solaire_cc_by_sa(): void
    {
        // The often-cited Khufu ship photo requires attribution and share-alike.
        $this->assertNull(MediaLicense::qualify([
            'LicenseShortName' => ['value' => 'CC BY-SA 3.0'],
            'LicenseUrl' => ['value' => 'http://creativecommons.org/licenses/by-sa/3.0/'],
            'UsageTerms' => ['value' => 'Creative Commons Attribution-Share Alike 3.0'],
            'AttributionRequired' => ['value' => 'true'],
            'Restrictions' => ['value' => ''],
        ]));
    }

    public function test_rejects_attribution_sharealike_noncommercial_and_unclear_terms(): void
    {
        $this->assertNull(MediaLicense::qualify([
            'LicenseShortName' => ['value' => 'CC BY 3.0'],
            'AttributionRequired' => ['value' => 'true'],
        ]));

        $this->assertNull(MediaLicense::qualify([
            'LicenseShortName' => ['value' => 'CC BY-NC-SA 4.0'],
            'AttributionRequired' => ['value' => 'false'],
        ]));

        $this->assertNull(MediaLicense::qualify([
            'LicenseShortName' => ['value' => 'Copyrighted free use'],
            'AttributionRequired' => ['value' => 'false'],
        ]));

        $this->assertNull(MediaLicense::qualify([
            'LicenseShortName' => ['value' => 'GFDL'],
            'AttributionRequired' => ['value' => 'false'],
        ]));

        $this->assertNull(MediaLicense::qualify([
            'LicenseShortName' => ['value' => 'Public domain'],
            'AttributionRequired' => ['value' => 'false'],
            'Restrictions' => ['value' => 'trademarked'],
        ]));

        $this->assertNull(MediaLicense::qualify([]));
        $this->assertNull(MediaLicense::qualify(null));
    }
}
