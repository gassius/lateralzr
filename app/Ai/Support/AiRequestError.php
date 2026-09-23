<?php

namespace App\Ai\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Queue\TimeoutExceededException;
use Throwable;

final class AiRequestError
{
    public static function displayMessage(Throwable $e, ?string $provider = null, ?string $model = null): string
    {
        $raw = $e->getMessage();
        $provider = $provider !== null && $provider !== '' ? $provider : (string) config('ai.default');
        $model = $model !== null && $model !== '' ? $model : (string) config('ai.models.text');

        if (self::isInvalidSchema($e)) {
            return "{$provider} rejected the structured output schema (missing array `items` or invalid JSON Schema). This is a code bug, not an API key/model issue. Original: {$raw}";
        }

        if (self::isInvalidModel($e)) {
            return "{$provider} rejected model [{$model}] (not found / no endpoints). Set OPENROUTER_DEFAULT_MODEL to a valid OpenRouter id such as openai/gpt-4o-mini — do not invent model slugs. Original: {$raw}";
        }

        if (self::isTimeout($e)) {
            return "{$provider} request timed out for model [{$model}]. Transient network/provider delay; the job will retry a limited number of times. Original: {$raw}";
        }

        if (self::isRateLimited($e)) {
            return "{$provider} rate-limited the request for model [{$model}] (HTTP 429). The job will retry with backoff. Original: {$raw}";
        }

        if (self::isServerError($e)) {
            return "{$provider} returned a transient server error for model [{$model}]. The job will retry with backoff. Original: {$raw}";
        }

        return $raw !== '' ? $raw : 'AI provider request failed.';
    }

    public static function isRetryable(Throwable $e): bool
    {
        if (self::isInvalidSchema($e) || self::isInvalidModel($e) || self::isPermanentClientError($e)) {
            return false;
        }

        return self::isTimeout($e)
            || self::isRateLimited($e)
            || self::isServerError($e)
            || $e instanceof ConnectionException;
    }

    public static function isInvalidSchema(Throwable $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, 'invalid schema')
            || str_contains($message, 'array schema missing items')
            || str_contains($message, 'missing items');
    }

    public static function isInvalidModel(Throwable $e): bool
    {
        $message = strtolower($e->getMessage());

        if (preg_match('/\b404\b/', $message) === 1 && (
            str_contains($message, 'model')
            || str_contains($message, 'not found')
            || str_contains($message, 'no endpoints')
        )) {
            return true;
        }

        return str_contains($message, 'no endpoints found')
            || str_contains($message, 'is not a valid model')
            || str_contains($message, 'invalid model')
            || str_contains($message, 'model not found');
    }

    public static function isTimeout(Throwable $e): bool
    {
        if ($e instanceof TimeoutExceededException) {
            return true;
        }

        $message = strtolower($e->getMessage());

        return str_contains($message, 'curl error 28')
            || str_contains($message, 'operation timed out')
            || str_contains($message, 'timed out')
            || str_contains($message, 'timeout')
            || str_contains($message, 'request timeout');
    }

    public static function isRateLimited(Throwable $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, '429')
            || str_contains($message, 'rate limit')
            || str_contains($message, 'rate-limited')
            || str_contains($message, 'too many requests');
    }

    public static function isServerError(Throwable $e): bool
    {
        $message = strtolower($e->getMessage());

        if ($e instanceof RequestException && $e->response?->serverError()) {
            return true;
        }

        return (bool) preg_match('/\b(500|502|503|504)\b/', $message)
            || str_contains($message, 'overloaded')
            || str_contains($message, 'provider overloaded')
            || str_contains($message, 'bad gateway');
    }

    public static function isPermanentClientError(Throwable $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, 'authentication')
            || str_contains($message, '401')
            || str_contains($message, 'insufficient credits')
            || str_contains($message, '402')
            || str_contains($message, 'moderation')
            || (str_contains($message, '400') && ! self::isRetryableStatusOverride($message));
    }

    private static function isRetryableStatusOverride(string $message): bool
    {
        return str_contains($message, '429') || str_contains($message, 'timeout');
    }
}
