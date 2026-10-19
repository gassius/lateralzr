<?php

namespace App\Ai\Support;

use Laravel\Ai\Contracts\Agent;
use ReflectionMethod;

final class AiPrompt
{
    /**
     * Invoke an agent with the effective provider/model when the prompt
     * signature accepts those arguments; otherwise call prompt($prompt).
     */
    public static function send(object $agent, string $prompt): mixed
    {
        if ($agent instanceof Agent && self::promptAcceptsProviderAndModel($agent)) {
            $provider = (string) config('ai.default', 'ollama');
            $model = AiProviders::effectiveTextModel($provider);

            return $agent->prompt($prompt, provider: $provider, model: $model);
        }

        return $agent->prompt($prompt);
    }

    private static function promptAcceptsProviderAndModel(object $agent): bool
    {
        try {
            $method = new ReflectionMethod($agent, 'prompt');
        } catch (\ReflectionException) {
            return false;
        }

        $hasProvider = false;
        $hasModel = false;
        foreach ($method->getParameters() as $parameter) {
            $name = $parameter->getName();
            $hasProvider = $hasProvider || $name === 'provider';
            $hasModel = $hasModel || $name === 'model';
        }

        return $hasProvider && $hasModel;
    }
}
