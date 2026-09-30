<?php

namespace Tests\Unit;

use App\Models\Concept;
use App\Models\ConceptTerm;
use App\Support\ConceptSeed;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConceptSeedTest extends TestCase
{
    use RefreshDatabase;

    public function test_random_term_prefers_a_default_locale_row(): void
    {
        $concept = Concept::query()->create(['canonical_key' => 'silence']);
        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => 'en',
            'term' => 'silence',
            'normalized_term' => 'silence',
            'short_description' => 'Absence of sound.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        $this->assertSame('silence', ConceptSeed::randomTerm());
        $this->assertSame(['silence'], ConceptSeed::randomTerms(3));
    }

    public function test_empty_database_falls_back_to_config_seeds_then_creativity(): void
    {
        config(['concepts.default_seeds' => ['innovation']]);

        $this->assertSame('innovation', ConceptSeed::randomTerm());
        $this->assertSame(['innovation'], ConceptSeed::randomTerms(1));

        config(['concepts.default_seeds' => []]);

        $this->assertSame('creativity', ConceptSeed::randomTerm());
        $this->assertSame(['creativity'], ConceptSeed::randomTerms(2));
    }
}
