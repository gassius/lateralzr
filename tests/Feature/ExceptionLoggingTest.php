<?php

namespace Tests\Feature;

use Illuminate\Contracts\Debug\ExceptionHandler;
use Tests\TestCase;

class ExceptionLoggingTest extends TestCase
{
    public function test_log_stack_always_includes_stderr_and_ignores_handler_exceptions(): void
    {
        $channels = config('logging.channels.stack.channels');

        $this->assertIsArray($channels);
        $this->assertContains('stderr', $channels);
        $this->assertTrue(config('logging.channels.stack.ignore_exceptions'));
        $this->assertSame('php://stderr', config('logging.channels.emergency.path'));
    }

    public function test_bootstrap_does_not_use_non_compound_throwable_import(): void
    {
        $contents = (string) file_get_contents(base_path('bootstrap/app.php'));

        $this->assertStringNotContainsString('use Throwable;', $contents);
        $this->assertMatchesRegularExpression('/function\s*\(\s*\\\\Throwable\s+\$e\s*\)/', $contents);
    }

    public function test_exceptions_are_mirrored_to_php_error_log(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'lz-error-log-');
        $this->assertNotFalse($path);

        $previous = ini_get('error_log');
        ini_set('error_log', $path);

        try {
            app(ExceptionHandler::class)->report(new \RuntimeException('filament admin exploded'));

            $contents = (string) file_get_contents($path);
            $this->assertStringContainsString('filament admin exploded', $contents);
            $this->assertStringContainsString('[laravel]', $contents);
        } finally {
            ini_set('error_log', $previous ?: '');
            @unlink($path);
        }
    }
}
