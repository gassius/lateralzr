<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default seed concepts (prefetch / seeder)
    |--------------------------------------------------------------------------
    |
    | Used by ConceptSeed when the terms table is empty (prefetch workers and
    | seeder). POST /api/concepts/relationships is a read-only graph walk:
    | omitting start/seed picks a random concept that already has edges
    | (ConceptGraphQuery), not this list.
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
    | Default concept complexity (prefetch / generation)
    |--------------------------------------------------------------------------
    |
    | 1 = very simple labels (e.g. "Ball", "Fire"). 5 = dense academic named ideas.
    | Prefetch and other workers use this when they generate terms.
    | POST /api/concepts/relationships "complexity" only filters stored terms;
    | it does not drive generation or apply this default to the walk.
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
    | always writes the default locale first; use `concepts:localize`
    | (queued by default; `--sync` for inline) to attach additional locale
    | terms to the same canonical concepts. Track runs under Filament
    | Worker Runs (`/admin/concept-graph-runs`, type=localize).
    |
    */
    'supported_locales' => array_values(array_filter(array_map(
        static fn (string $locale) => strtolower(trim($locale)),
        explode(',', (string) env('CONCEPTS_SUPPORTED_LOCALES', 'en,es'))
    ))),

];
