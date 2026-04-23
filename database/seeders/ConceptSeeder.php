<?php

namespace Database\Seeders;

use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Models\RelationshipEvidence;
use App\Services\ConceptCanonicalizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ConceptSeeder extends Seeder
{
    /**
     * Seed a small deterministic concept graph for tests and dev.
     * This avoids any LLM calls while still letting the client/API work from DB.
     */
    public function run(): void
    {
        $locale = (string) config('concepts.default_locale', 'en');
        $complexity = (int) config('concepts.default_complexity', 2);
        $runUuid = (string) Str::uuid();

        /** @var ConceptCanonicalizer $canonicalizer */
        $canonicalizer = app(ConceptCanonicalizer::class);

        $seed = $canonicalizer->resolveOrCreate(
            term: 'pattern',
            locale: $locale,
            shortDescription: 'A repeated decorative design or sequence of shapes.',
            wikiUrl: 'https://en.wikipedia.org/wiki/Pattern',
            mediaUrl: null
        );

        // Seed a small “URL cache” set used by ConceptRelationshipService unit tests.
        $canonicalizer->resolveOrCreate(
            term: 'creativity',
            locale: $locale,
            shortDescription: 'The use of imagination or original ideas to create something.',
            wikiUrl: 'https://en.wikipedia.org/wiki/Creativity',
            mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg',
        );
        $canonicalizer->resolveOrCreate(
            term: 'constraint',
            locale: $locale,
            shortDescription: 'A limitation or restriction.',
            wikiUrl: 'https://en.wikipedia.org/wiki/Constraint',
            mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constraint.jpg/960px-Constraint.jpg',
        );

        $relatedTerms = [
            [
                'term' => 'ambiguity',
                'desc' => 'A state of uncertainty or inexactness regarding meaning, truth, or significance.',
                'wiki' => 'https://en.wikipedia.org/wiki/Ambiguity',
                'media' => null,
                'larelality' => 4,
            ],
            [
                'term' => 'harbor',
                'desc' => 'A sheltered body of water where ships can anchor safely.',
                'wiki' => 'https://en.wikipedia.org/wiki/Harbor',
                'media' => null,
                'larelality' => 3,
            ],
            [
                'term' => 'metronome',
                'desc' => 'A device that produces a steady beat to help musicians keep time.',
                'wiki' => 'https://en.wikipedia.org/wiki/Metronome',
                'media' => null,
                'larelality' => 4,
            ],
        ];

        foreach ($relatedTerms as $rt) {
            $to = $canonicalizer->resolveOrCreate(
                term: $rt['term'],
                locale: $locale,
                shortDescription: $rt['desc'],
                wikiUrl: $rt['wiki'],
                mediaUrl: $rt['media']
            );

            $edge = ConceptRelationship::query()->create([
                'from_concept_id' => $seed->id,
                'to_concept_id' => $to->id,
                'relationship_type' => 'lateral',
                'complexity' => $complexity,
                'llm_occurrences' => 1,
                'user_weight' => 0,
                'last_larelality' => (int) $rt['larelality'],
                'last_generated_at' => now(),
                'strength' => 0.5,
            ]);

            RelationshipEvidence::query()->create([
                'concept_relationship_id' => $edge->id,
                'provider' => 'seed',
                'model' => 'seed',
                'run_uuid' => $runUuid,
                'larelality' => (int) $rt['larelality'],
                'seed_term' => 'pattern',
                'related_term' => $rt['term'],
                'raw_json' => [
                    'concept' => $rt['term'],
                    'shortDescription' => $rt['desc'],
                    'larelality' => (int) $rt['larelality'],
                    'wikiUrl' => $rt['wiki'],
                    'mediaUrl' => $rt['media'],
                ],
                'created_at' => now(),
            ]);
        }

        // Ensure default seeds exist as terms so prefetch can draw from them.
        foreach ((array) config('concepts.default_seeds', []) as $t) {
            $canonicalizer->resolveOrCreate(term: (string) $t, locale: $locale);
        }
    }
}
