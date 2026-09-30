<?php

namespace App\Ai\Support;

final class AiConfigOverride
{
    /**
     * Temporarily apply provider/model config for one AI call, then restore.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public static function run(?string $provider, ?string $model, callable $callback): mixed
    {
        $previousProvider = config('ai.default');
        $previousModel = config('ai.models.text');

        if ($provider) {
            config()->set('ai.default', $provider);
        }
        if ($model) {
            config()->set('ai.models.text', $model);
        }

        try {
            return $callback();
        } finally {
            config()->set('ai.default', $previousProvider);
            config()->set('ai.models.text', $previousModel);
        }
    }
}
