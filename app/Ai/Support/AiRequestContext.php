<?php

namespace App\Ai\Support;

final class AiRequestContext
{
    private static ?string $runUuid = null;

    private static ?string $jobKey = null;

    private static ?string $sentProvider = null;

    private static ?string $sentModel = null;

    /**
     * @var array{prompt:?int,completion:?int,total:?int}|null
     */
    private static ?array $usage = null;

    /**
     * Bind run/job identity for LLM logs, then restore the previous context.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public static function using(?string $runUuid, ?string $jobKey, callable $callback): mixed
    {
        $previous = [
            self::$runUuid,
            self::$jobKey,
            self::$sentProvider,
            self::$sentModel,
            self::$usage,
        ];

        self::$runUuid = $runUuid;
        self::$jobKey = $jobKey;
        self::$sentProvider = null;
        self::$sentModel = null;
        self::$usage = null;

        try {
            return $callback();
        } finally {
            [
                self::$runUuid,
                self::$jobKey,
                self::$sentProvider,
                self::$sentModel,
                self::$usage,
            ] = $previous;
        }
    }

    public static function runUuid(): ?string
    {
        return self::$runUuid;
    }

    public static function jobKey(): ?string
    {
        return self::$jobKey;
    }

    /**
     * @param  array{prompt:?int,completion:?int,total:?int}|null  $usage
     */
    public static function rememberSent(string $provider, string $model, ?array $usage = null): void
    {
        self::$sentProvider = $provider;
        self::$sentModel = $model;

        if ($usage !== null) {
            self::$usage = $usage;
        }
    }

    public static function lastSentProvider(): ?string
    {
        return self::$sentProvider;
    }

    public static function lastSentModel(): ?string
    {
        return self::$sentModel;
    }

    /**
     * @return array{prompt:?int,completion:?int,total:?int}|null
     */
    public static function lastUsage(): ?array
    {
        return self::$usage;
    }
}
