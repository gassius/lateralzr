<?php

namespace App\Services\Enrichment;

/**
 * Commercial use with no royalties and no attribution.
 * CC0 and public domain qualify. CC-BY, SA, NC, GFDL, and unclear terms do not.
 */
final class MediaLicense
{
    /**
     * @param  array<string, mixed>|null  $extmetadata
     */
    public static function qualify(?array $extmetadata): ?string
    {
        if ($extmetadata === null || $extmetadata === []) {
            return null;
        }

        $short = self::plain(self::meta($extmetadata, 'LicenseShortName'));
        $usage = self::plain(self::meta($extmetadata, 'UsageTerms'));
        $licenseUrl = strtolower(self::plain(self::meta($extmetadata, 'LicenseUrl')));
        $attribution = strtolower(self::plain(self::meta($extmetadata, 'AttributionRequired')));
        $restrictions = strtolower(self::plain(self::meta($extmetadata, 'Restrictions')));

        if ($short === '' && $usage === '' && $licenseUrl === '') {
            return null;
        }

        if ($attribution === 'true') {
            return null;
        }

        if (self::blockedRestrictions($restrictions)) {
            return null;
        }

        $blob = strtolower(trim($short.' '.$usage.' '.$licenseUrl));
        if (self::blockedLicense($blob)) {
            return null;
        }

        if (self::isCc0($blob)) {
            return 'CC0';
        }

        if (self::isPublicDomain($blob)) {
            return 'Public domain';
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $extmetadata
     */
    private static function meta(array $extmetadata, string $key): string
    {
        $entry = $extmetadata[$key] ?? null;
        if (is_array($entry)) {
            $value = $entry['value'] ?? '';

            return is_string($value) ? $value : '';
        }

        return is_string($entry) ? $entry : '';
    }

    private static function plain(string $value): string
    {
        $text = html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return trim($text);
    }

    private static function blockedRestrictions(string $restrictions): bool
    {
        if ($restrictions === '') {
            return false;
        }

        return (bool) preg_match('/attribution|non-?commercial|share-?alike|trademark|copyright/i', $restrictions);
    }

    private static function blockedLicense(string $blob): bool
    {
        return (bool) preg_match(
            '/\b(by-sa|by-nc|by-nd|gfdl|share-?alike|non-?commercial|attribution|all rights reserved|copyrighted free use|fair use)\b|\bcc\s*by\b/i',
            $blob
        );
    }

    private static function isCc0(string $blob): bool
    {
        return (bool) preg_match('/\bcc0\b|cc-?zero|publicdomain\/zero/i', $blob);
    }

    private static function isPublicDomain(string $blob): bool
    {
        return (bool) preg_match('/public domain|publicdomain\/mark|\bpdm\b/i', $blob);
    }
}
