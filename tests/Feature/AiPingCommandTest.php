<?php

namespace Tests\Feature;

use Tests\TestCase;

class AiPingCommandTest extends TestCase
{
    public function test_help_lists_openrouter(): void
    {
        $this->artisan('ai:ping', ['--help'])
            ->expectsOutputToContain('openrouter')
            ->assertSuccessful();
    }

    public function test_rejects_unknown_provider(): void
    {
        $this->artisan('ai:ping', ['--provider' => 'not-a-provider'])
            ->expectsOutputToContain('Unknown AI provider [not-a-provider]')
            ->assertFailed();
    }

    public function test_dry_run_prints_resolved_openrouter_provider_and_model(): void
    {
        $this->artisan('ai:ping', [
            '--provider' => 'openrouter',
            '--dry-run' => true,
        ])
            ->expectsOutputToContain('provider=openrouter')
            ->expectsOutputToContain('model=openai/gpt-4o-mini')
            ->assertSuccessful();
    }
}
