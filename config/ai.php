<?php

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
    */

    'default' => env('AI_DEFAULT_PROVIDER', 'ollama'),

    /*
    |--------------------------------------------------------------------------
    | AI Providers
    |--------------------------------------------------------------------------
    |
    | Here you may configure the AI providers available to your application.
    | Each provider requires specific credentials and configuration options.
    |
    */

    'providers' => [

        'ollama' => [
            'driver' => 'ollama',
            'key' => env('OLLAMA_API_KEY', ''),
            'url' => env('OLLAMA_BASE_URL', 'http://host.docker.internal:11434'),
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
    */

    'models' => [
        'text' => env('OLLAMA_MODEL', 'llama3.2:3b'),
        'image' => env('AI_IMAGE_MODEL'),
        'audio' => env('AI_AUDIO_MODEL'),
        'transcription' => env('AI_TRANSCRIPTION_MODEL'),
        'embedding' => env('AI_EMBEDDING_MODEL'),
    ],

];
