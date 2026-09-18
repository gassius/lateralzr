<?php

$defaultProvider = env('AI_DEFAULT_PROVIDER', 'ollama');
$openrouterModel = env('OPENROUTER_DEFAULT_MODEL');
$ollamaModel = env('OLLAMA_MODEL');

return [

    /*
    |--------------------------------------------------------------------------
    | Default AI Provider
    |--------------------------------------------------------------------------
    |
    | This option controls the default AI provider that will be used by the
    | Laravel AI SDK. You may change this value to use a different provider
    | as needed for your application.
    |
    | Local Sail: ollama. Production VPS: openrouter.
    |
    */

    'default' => $defaultProvider,

    /*
    |--------------------------------------------------------------------------
    | AI Providers
    |--------------------------------------------------------------------------
    |
    | Here you may configure the AI providers available to your application.
    | Each provider requires specific credentials and configuration options.
    |
    | laravel/ai v0.1.x OpenRouter config is driver + key only. Prism defaults
    | the OpenRouter base URL to https://openrouter.ai/api/v1. Do not set a
    | full /chat/completions path — Prism already appends that route.
    |
    */

    'providers' => [

        'ollama' => [
            'driver' => 'ollama',
            'key' => env('OLLAMA_API_KEY', ''),
            'url' => env('OLLAMA_BASE_URL', 'http://host.docker.internal:11434'),
        ],

        'openrouter' => [
            'driver' => 'openrouter',
            'key' => env('OPENROUTER_API_KEY'),
        ],

        'openai' => [
            'driver' => 'openai',
            'key' => env('OPENAI_API_KEY'),
            'url' => env('OPENAI_BASE_URL'),
        ],

        'anthropic' => [
            'driver' => 'anthropic',
            'key' => env('ANTHROPIC_API_KEY'),
            'url' => env('ANTHROPIC_BASE_URL'),
        ],

        'gemini' => [
            'driver' => 'gemini',
            'key' => env('GEMINI_API_KEY'),
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Default Models
    |--------------------------------------------------------------------------
    |
    | These options define the default models used for various AI operations.
    | You may override these defaults when making specific AI requests.
    |
    | The text model selection respects the AI_DEFAULT_PROVIDER setting:
    | - When using 'openrouter', it reads OPENROUTER_DEFAULT_MODEL
    | - When using 'ollama', it reads OLLAMA_MODEL
    | - Empty OPENROUTER_DEFAULT_MODEL falls back to openai/gpt-4o-mini
    |
    | Use a real OpenRouter model id from https://openrouter.ai/models
    | (e.g. openai/gpt-4o-mini). Invented slugs 404.
    |
    */

    'models' => [
        'text' => match ($defaultProvider) {
            'openrouter' => (is_string($openrouterModel) && trim($openrouterModel) !== '')
                ? trim($openrouterModel)
                : 'openai/gpt-4o-mini',
            default => (is_string($ollamaModel) && trim($ollamaModel) !== '')
                ? trim($ollamaModel)
                : 'llama3.2:3b',
        },
        'image' => env('AI_IMAGE_MODEL'),
        'audio' => env('AI_AUDIO_MODEL'),
        'transcription' => env('AI_TRANSCRIPTION_MODEL'),
        'embedding' => env('AI_EMBEDDING_MODEL'),
    ],

];
