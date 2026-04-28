<?php

namespace Database\Seeders;

use App\Models\ConceptRelationship;
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
        $runUuid = (string) Str::uuid();

        /** @var ConceptCanonicalizer $canonicalizer */
        $canonicalizer = app(ConceptCanonicalizer::class);

        $nodes = [
            'Cleopatra' => ['desc' => 'The last active ruler of the Ptolemaic Kingdom of Egypt.', 'wiki' => 'https://en.wikipedia.org/wiki/Cleopatra', 'media' => null, 'complexity' => 2],
            'The Lumineers' => ['desc' => 'An American folk rock band known for narrative songs and acoustic arrangements.', 'wiki' => 'https://en.wikipedia.org/wiki/The_Lumineers', 'media' => null, 'complexity' => 2],
            'Denver' => ['desc' => 'The capital city of Colorado, located near the Rocky Mountains.', 'wiki' => 'https://en.wikipedia.org/wiki/Denver', 'media' => null, 'complexity' => 1],
            'Alexandria' => ['desc' => 'A Mediterranean port city in Egypt founded by Alexander the Great.', 'wiki' => 'https://en.wikipedia.org/wiki/Alexandria', 'media' => null, 'complexity' => 1],
            'Lighthouse' => ['desc' => 'A tower or structure that emits light to guide ships and mark hazards.', 'wiki' => 'https://en.wikipedia.org/wiki/Lighthouse', 'media' => null, 'complexity' => 1],
            'Signal flags' => ['desc' => 'Flags used by ships to communicate messages over distance.', 'wiki' => 'https://en.wikipedia.org/wiki/International_maritime_signal_flags', 'media' => null, 'complexity' => 2],
            'Jazz improvisation' => ['desc' => 'The spontaneous creation of melodies, rhythms, and harmonies in jazz performance.', 'wiki' => 'https://en.wikipedia.org/wiki/Jazz_improvisation', 'media' => null, 'complexity' => 2],
            'Constraint' => ['desc' => 'A limitation or restriction.', 'wiki' => 'https://en.wikipedia.org/wiki/Constraint', 'media' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constraint.jpg/960px-Constraint.jpg', 'complexity' => 1],
            'Pattern' => ['desc' => 'A repeated decorative design or sequence of shapes.', 'wiki' => 'https://en.wikipedia.org/wiki/Pattern', 'media' => null, 'complexity' => 1],
            'Creativity' => ['desc' => 'The use of imagination or original ideas to create something.', 'wiki' => 'https://en.wikipedia.org/wiki/Creativity', 'media' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg', 'complexity' => 1],
            'Harbor' => ['desc' => 'A sheltered body of water where ships can anchor safely.', 'wiki' => 'https://en.wikipedia.org/wiki/Harbor', 'media' => null, 'complexity' => 1],
            'Metronome' => ['desc' => 'A device that produces a steady beat to help musicians keep time.', 'wiki' => 'https://en.wikipedia.org/wiki/Metronome', 'media' => null, 'complexity' => 1],
        ];

        $concepts = [];
        foreach ($nodes as $term => $node) {
            $concepts[$term] = $canonicalizer->resolveOrCreate(
                term: $term,
                locale: $locale,
                shortDescription: $node['desc'],
                wikiUrl: $node['wiki'],
                mediaUrl: $node['media'],
                complexity: (int) $node['complexity'],
            );
        }

        $edges = [
            ['Cleopatra', 'The Lumineers', 5, 0.72],
            ['The Lumineers', 'Denver', 3, 0.68],
            ['Cleopatra', 'Alexandria', 2, 0.55],
            ['Alexandria', 'Lighthouse', 3, 0.61],
            ['Lighthouse', 'Signal flags', 3, 0.64],
            ['Signal flags', 'Jazz improvisation', 5, 0.70],
            ['Jazz improvisation', 'Constraint', 4, 0.66],
            ['Constraint', 'Pattern', 3, 0.62],
            ['Pattern', 'Creativity', 4, 0.67],
            ['Creativity', 'The Lumineers', 4, 0.58],
            ['Denver', 'Harbor', 5, 0.51],
            ['Harbor', 'Lighthouse', 2, 0.73],
            ['Metronome', 'Jazz improvisation', 2, 0.77],
            ['Metronome', 'Pattern', 3, 0.57],
            ['Signal flags', 'Pattern', 4, 0.53],
            ['Alexandria', 'Harbor', 2, 0.69],
            ['Cleopatra', 'Constraint', 4, 0.48],
            ['Denver', 'Metronome', 5, 0.46],
        ];

        foreach ($edges as [$from, $to, $laterality, $strength]) {
            $edge = ConceptRelationship::query()->create([
                'from_concept_id' => $concepts[$from]->id,
                'to_concept_id' => $concepts[$to]->id,
                'llm_occurrences' => 1,
                'user_weight' => 0,
                'last_laterality' => (int) $laterality,
                'last_generated_at' => now(),
                'strength' => $strength,
            ]);

            RelationshipEvidence::query()->create([
                'concept_relationship_id' => $edge->id,
                'provider' => 'seed',
                'model' => 'seed',
                'run_uuid' => $runUuid,
                'laterality' => (int) $laterality,
                'from_term' => $from,
                'to_term' => $to,
                'raw_json' => [
                    'from' => $from,
                    'to' => $to,
                    'laterality' => (int) $laterality,
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
