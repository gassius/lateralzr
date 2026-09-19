<?php

namespace Tests\Feature;

use Tests\TestCase;

class LocalizeConceptTermsCommandTest extends TestCase
{
    public function test_command_rejects_identical_locales(): void
    {
        $this->artisan('concepts:localize', ['--from' => 'en', '--to' => 'en'])
            ->expectsOutputToContain('must differ')
            ->assertFailed();
    }

    public function test_command_rejects_unsupported_locale(): void
    {
        $this->artisan('concepts:localize', ['--from' => 'en', '--to' => 'fr'])
            ->expectsOutputToContain('supported list')
            ->assertFailed();
    }
}
