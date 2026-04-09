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

];
