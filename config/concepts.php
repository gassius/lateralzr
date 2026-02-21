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

];
