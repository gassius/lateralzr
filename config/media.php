<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Remote media proxy
    |--------------------------------------------------------------------------
    |
    | GET /api/media fetches allowlisted third-party images server-side so the
    | Expo web client can display them without depending on Wikimedia CORS.
    | Native clients should keep using the original mediaUrl directly.
    |
    */

    'allowed_hosts' => [
        'upload.wikimedia.org',
    ],

    'allowed_extensions' => [
        'jpg',
        'jpeg',
        'png',
        'webp',
        'gif',
        'avif',
    ],

    'allowed_content_types' => [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/avif',
    ],

    'timeout' => (int) env('MEDIA_PROXY_TIMEOUT', 10),

    'max_bytes' => (int) env('MEDIA_PROXY_MAX_BYTES', 5_000_000),

    'user_agent' => env(
        'MEDIA_PROXY_USER_AGENT',
        'Lateralzr-API/1.0 (https://github.com/gassius/lateralzr; educational)'
    ),

    'cache_max_age' => (int) env('MEDIA_PROXY_CACHE_MAX_AGE', 86400),

];
