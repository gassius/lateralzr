<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default seed concepts (cold start)
    |--------------------------------------------------------------------------
    |
    | When POST /api/concepts/relationships is called without a seed, the API
    | picks a random concept from this list (or from the concepts table if
    | it has rows). These terms are used to bootstrap lateral thinking chains.
    |
    */
    'default_seeds' => [
        'creativity',
        'constraint',
        'innovation',
        'chaos',
        'silence',
        'pattern',
        'ambiguity',
        'reversal',
        'metaphor',
        'randomness',
    ],

    /*
    |--------------------------------------------------------------------------
    | Default concept complexity (POST /api/concepts/relationships)
    |--------------------------------------------------------------------------
    |
    | 1 = very simple labels (e.g. "Ball", "Fire"). 5 = dense academic named ideas.
    | Clients may override per request with the "complexity" JSON field (1–5).
    |
    */
    'default_complexity' => env('CONCEPTS_DEFAULT_COMPLEXITY', 2),

    /*
    |--------------------------------------------------------------------------
    | Default locale for concept terms
    |--------------------------------------------------------------------------
    |
    | Canonical concept nodes are stored in `concepts`. Human-facing labels,
    | descriptions, and URLs live in `concept_terms` per locale.
    |
    */
    'default_locale' => env('CONCEPTS_DEFAULT_LOCALE', 'en'),

    /*
    |--------------------------------------------------------------------------
    | Supported locales for concept terms + API
    |--------------------------------------------------------------------------
    |
    | Comma-separated list in CONCEPTS_SUPPORTED_LOCALES. Graph generation
    | always writes the default locale first; use `concepts:localize` to
    | attach additional locale terms to the same canonical concepts.
    |
    */
    'supported_locales' => array_values(array_filter(array_map(
        static fn (string $locale) => strtolower(trim($locale)),
        explode(',', (string) env('CONCEPTS_SUPPORTED_LOCALES', 'en,es'))
    ))),

];
