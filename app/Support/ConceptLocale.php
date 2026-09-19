<?php

namespace App\Support;

class ConceptLocale
{
    /**
     * @return list<string>
     */
    public static function supported(): array
    {
        $locales = config('concepts.supported_locales', ['en', 'es']);

        if (! is_array($locales) || $locales === []) {
            return [(string) config('concepts.default_locale', 'en')];
        }

        return array_values(array_unique(array_map(
            static fn ($locale) => strtolower(trim((string) $locale)),
            $locales
        )));
    }

    public static function default(): string
    {
        $default = strtolower(trim((string) config('concepts.default_locale', 'en')));
        $supported = self::supported();

        return in_array($default, $supported, true) ? $default : ($supported[0] ?? 'en');
    }

    /**
     * Normalize a requested locale to a supported one, falling back to default.
     */
    public static function resolve(?string $locale): string
    {
        if ($locale === null || trim($locale) === '') {
            return self::default();
        }

        $normalized = strtolower(trim($locale));

        // Accept BCP-47 style tags like es-ES → es when the primary subtag is supported.
        $primary = explode('-', $normalized, 2)[0];

        $supported = self::supported();
        if (in_array($normalized, $supported, true)) {
            return $normalized;
        }
        if (in_array($primary, $supported, true)) {
            return $primary;
        }

        return self::default();
    }

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        $options = [];
        foreach (self::supported() as $locale) {
            $options[$locale] = strtoupper($locale);
        }

        return $options;
    }
}
