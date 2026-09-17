<?php

namespace App\Support;

/**
 * Recreate Laravel-writable storage subdirectories.
 *
 * Production bind-mounts the host `./storage` over the image's storage tree.
 * If the host checkout is missing framework/log dirs (or they were never
 * created after clone), Blade compilation and file logging 500 before
 * Laravel can write laravel.log.
 */
class EnsureApplicationStorage
{
    /**
     * Relative paths under storage/ that must exist and be directories.
     *
     * @return list<string>
     */
    public static function directories(): array
    {
        return [
            'app/public',
            'app/private',
            'framework/cache/data',
            'framework/sessions',
            'framework/testing',
            'framework/views',
            'logs',
        ];
    }

    public static function bootstrap(?string $storagePath = null): void
    {
        $root = $storagePath ?? storage_path();

        foreach (self::directories() as $relative) {
            $dir = $root.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relative);

            if (! is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
        }
    }
}
