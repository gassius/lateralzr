<?php

namespace Tests\Unit;

use App\Support\EnsureApplicationStorage;
use PHPUnit\Framework\TestCase;

class EnsureApplicationStorageTest extends TestCase
{
    public function test_creates_missing_framework_and_log_directories(): void
    {
        $root = sys_get_temp_dir().'/lz-storage-'.uniqid('', true);
        mkdir($root, 0777, true);

        try {
            $this->assertDirectoryDoesNotExist($root.'/framework/views');
            $this->assertDirectoryDoesNotExist($root.'/logs');

            EnsureApplicationStorage::bootstrap($root);

            foreach (EnsureApplicationStorage::directories() as $relative) {
                $this->assertDirectoryExists($root.'/'.$relative);
            }
        } finally {
            $this->removeDirectory($root);
        }
    }

    public function test_is_idempotent_when_directories_already_exist(): void
    {
        $root = sys_get_temp_dir().'/lz-storage-'.uniqid('', true);
        mkdir($root.'/framework/views', 0777, true);

        try {
            EnsureApplicationStorage::bootstrap($root);
            EnsureApplicationStorage::bootstrap($root);

            $this->assertDirectoryExists($root.'/framework/views');
            $this->assertDirectoryExists($root.'/logs');
        } finally {
            $this->removeDirectory($root);
        }
    }

    private function removeDirectory(string $directory): void
    {
        if (! is_dir($directory)) {
            return;
        }

        $items = scandir($directory);
        if ($items === false) {
            return;
        }

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $path = $directory.DIRECTORY_SEPARATOR.$item;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                unlink($path);
            }
        }

        rmdir($directory);
    }
}
