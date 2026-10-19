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
    | 1 = everyday concrete ideas (e.g. "Ball"). 5 = highly specialised
    | (e.g. "Magnetotactic bacteria"). Label length is not the criterion.
    | Prefetch and other workers use this when they generate terms.
    | POST /api/concepts/relationships "complexity" only filters stored terms;
    | it does not drive generation or apply this default to the walk.
    |
    */
    'default_complexity' => env('CONCEPTS_DEFAULT_COMPLEXITY', 3),

    /*
    |--------------------------------------------------------------------------
    | Target laterality band (generation)
    |--------------------------------------------------------------------------
    |
    | Edges produced by concepts:prefetch must fall in [min, max] on the 0–1
    | laterality scale (Ball–Baseball = 0, Ball–Algorithm = 1). Stored in
    | app_settings and editable at /admin/concept-generation-settings; these
    | values are the defaults when no row is saved.
    |
    */
    'laterality_band_min' => env('CONCEPTS_LATERALITY_BAND_MIN', 0.4),
    'laterality_band_max' => env('CONCEPTS_LATERALITY_BAND_MAX', 0.6),

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
