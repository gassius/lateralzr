<?php

namespace App\Ai\Support;

use InvalidArgumentException;
use Laravel\Ai\Enums\Lab;

final class AiProviders
{
    /**
     * @return list<string>
     */
    public static function names(): array
    {
        return array_keys(config('ai.providers', []));
    }

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        $names = self::names();

        return array_combine($names, $names) ?: [];
    }

    public static function signatureHint(): string
    {
        $names = self::names();

        return $names === [] ? 'ollama|openrouter|openai|anthropic|gemini' : implode('|', $names);
    }

    public static function normalize(?string $provider): string
    {
        $provider = $provider !== null && trim($provider) !== ''
            ? strtolower(trim($provider))
            : strtolower((string) config('ai.default', 'ollama'));

        self::assertConfigured($provider);

        return $provider;
    }

    public static function assertConfigured(string $provider): void
    {
        if (! array_key_exists($provider, config('ai.providers', []))) {
            throw new InvalidArgumentException(
                "Unknown AI provider [{$provider}]. Configured providers: ".self::signatureHint().'.'
            );
        }
    }

    public static function toLab(string $provider): Lab
    {
        $provider = strtolower(trim($provider));

        return match ($provider) {
            'ollama' => Lab::Ollama,
            'openrouter' => Lab::OpenRouter,
            'openai' => Lab::OpenAI,
            'anthropic' => Lab::Anthropic,
            'gemini' => Lab::Gemini,
            default => throw new InvalidArgumentException(
                "Unknown AI provider [{$provider}]. Configured providers: ".self::signatureHint().'.'
            ),
        };
    }

    public static function defaultTextModel(?string $provider = null): string
    {
        $provider = $provider !== null && $provider !== ''
            ? strtolower($provider)
            : strtolower((string) config('ai.default', 'ollama'));

        return match ($provider) {
            'openrouter' => self::filledEnv('OPENROUTER_DEFAULT_MODEL', 'openai/gpt-4o-mini'),
            default => (string) (config('ai.models.text') ?: self::filledEnv('OLLAMA_MODEL', 'llama3.2:3b')),
        };
    }

    public static function filledEnv(string $key, string $default): string
    {
        $value = env($key);

        if (! is_string($value) || trim($value) === '') {
            return $default;
        }

        return trim($value);
    }
}
