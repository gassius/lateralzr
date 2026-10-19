<?php

namespace App\Ai\Support;

use Laravel\Ai\Contracts\Agent;

final class AiPrompt
{
    /**
     * Invoke an agent with the effective provider/model (real agents) or a
     * test double that only implements prompt($prompt).
     */
    public static function send(object $agent, string $prompt): mixed
    {
        $provider = (string) config('ai.default', 'ollama');
        $model = AiProviders::effectiveTextModel($provider);

        if ($agent instanceof Agent && ! $agent instanceof \Mockery\MockInterface) {
            return $agent->prompt($prompt, provider: $provider, model: $model);
        }

        return $agent->prompt($prompt);
    }
}
