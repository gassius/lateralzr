<?php

namespace Tests\Feature;

use Tests\TestCase;

class AiConfigTest extends TestCase
{
    public function test_openrouter_provider_matches_laravel_ai_driver_and_key_only(): void
    {
        $config = config('ai.providers.openrouter');

        $this->assertIsArray($config);
        $this->assertSame('openrouter', $config['driver']);
        $this->assertArrayHasKey('key', $config);
        $this->assertArrayNotHasKey('url', $config);
    }

    public function test_configured_providers_include_openrouter(): void
    {
        $this->assertArrayHasKey('openrouter', config('ai.providers'));
        $this->assertArrayHasKey('ollama', config('ai.providers'));
    }
}
