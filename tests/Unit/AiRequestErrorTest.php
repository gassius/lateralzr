<?php

namespace Tests\Unit;

use App\Ai\Support\AiRequestError;
use RuntimeException;
use Tests\TestCase;

class AiRequestErrorTest extends TestCase
{
    public function test_maps_openrouter_missing_items_schema_error(): void
    {
        $e = new RuntimeException(
            "OpenRouter Bad Request: Invalid schema for response_format 'schema_definition': In context=('properties', 'concepts'), array schema missing items."
        );

        $this->assertTrue(AiRequestError::isInvalidSchema($e));
        $this->assertFalse(AiRequestError::isRetryable($e));
        $this->assertStringContainsString('structured output schema', AiRequestError::displayMessage($e, 'openrouter', 'openai/gpt-4o-mini'));
    }

    public function test_maps_invalid_model_404_as_permanent(): void
    {
        $e = new RuntimeException('OpenRouter Error: HTTP 404 for model deepseek/deepseek-v4-flash-0731');

        $this->assertTrue(AiRequestError::isInvalidModel($e));
        $this->assertFalse(AiRequestError::isRetryable($e));
        $this->assertStringContainsString('openai/gpt-4o-mini', AiRequestError::displayMessage($e, 'openrouter', 'deepseek/deepseek-v4-flash-0731'));
    }

    public function test_timeouts_and_429_and_5xx_are_retryable(): void
    {
        $timeout = new RuntimeException('cURL error 28: Operation timed out after 60001 milliseconds');
        $rate = new RuntimeException('OpenRouter rate limit (HTTP 429)');
        $server = new RuntimeException('OpenRouter Model Error: 502 Bad Gateway');

        $this->assertTrue(AiRequestError::isRetryable($timeout));
        $this->assertTrue(AiRequestError::isRetryable($rate));
        $this->assertTrue(AiRequestError::isRetryable($server));
        $this->assertStringContainsString('timed out', AiRequestError::displayMessage($timeout, 'openrouter', 'openai/gpt-4o-mini'));
    }

    public function test_auth_errors_are_not_retryable(): void
    {
        $e = new RuntimeException('OpenRouter Authentication Error: 401 invalid api key');

        $this->assertFalse(AiRequestError::isRetryable($e));
    }
}
