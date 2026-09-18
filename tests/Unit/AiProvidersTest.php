<?php

namespace Tests\Unit;

use App\Ai\Support\AiProviders;
use InvalidArgumentException;
use Laravel\Ai\Enums\Lab;
use Tests\TestCase;

class AiProvidersTest extends TestCase
{
    public function test_names_include_openrouter(): void
    {
        $this->assertContains('openrouter', AiProviders::names());
        $this->assertArrayHasKey('openrouter', AiProviders::options());
        $this->assertStringContainsString('openrouter', AiProviders::signatureHint());
    }

    public function test_normalize_rejects_unknown_provider(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Unknown AI provider [not-a-provider]');

        AiProviders::normalize('not-a-provider');
    }

    public function test_normalize_accepts_openrouter(): void
    {
        $this->assertSame('openrouter', AiProviders::normalize('OpenRouter'));
        $this->assertSame(Lab::OpenRouter, AiProviders::toLab('openrouter'));
    }

    public function test_openrouter_default_model_falls_back_when_env_empty(): void
    {
        $this->assertSame('openai/gpt-4o-mini', AiProviders::defaultTextModel('openrouter'));
    }

    public function test_filled_env_treats_blank_as_missing(): void
    {
        $this->assertSame('openai/gpt-4o-mini', AiProviders::filledEnv('OPENROUTER_DEFAULT_MODEL', 'openai/gpt-4o-mini'));
    }
}
