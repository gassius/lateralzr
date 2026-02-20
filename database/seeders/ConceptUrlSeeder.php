<?php

namespace Database\Seeders;

use App\Models\ConceptUrl;
use Illuminate\Database\Seeder;

class ConceptUrlSeeder extends Seeder
{
    /**
     * Seed concept_urls for testing (and optional dev). Uses normalized concept names.
     */
    public function run(): void
    {
        $concepts = [
            [
                'concept' => 'creativity',
                'wiki_url' => 'https://en.wikipedia.org/wiki/Creativity',
                'media_url' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Creativity.jpg/960px-Creativity.jpg',
            ],
            [
                'concept' => 'constraint',
                'wiki_url' => 'https://en.wikipedia.org/wiki/Constraint',
                'media_url' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constraint.jpg/960px-Constraint.jpg',
            ],
            [
                'concept' => 'innovation',
                'wiki_url' => 'https://en.wikipedia.org/wiki/Innovation',
                'media_url' => null,
            ],
            [
                'concept' => 'chaos',
                'wiki_url' => 'https://en.wikipedia.org/wiki/Chaos',
                'media_url' => null,
            ],
        ];

        foreach ($concepts as $row) {
            ConceptUrl::query()->updateOrCreate(
                ['concept' => $row['concept']],
                [
                    'wiki_url' => $row['wiki_url'],
                    'media_url' => $row['media_url'],
                ]
            );
        }
    }
}
