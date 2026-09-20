<?php

namespace Tests\Unit;

use App\Ai\Tools\WikipediaSearchTool;
use App\Models\Concept;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Services\ConceptCanonicalizer;
use App\Services\ConceptGraphQuery;
use App\Services\ConceptLocalizeService;
use App\Support\ConceptLocale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Ai\Responses\StructuredAgentResponse;
use Mockery;
use Tests\TestCase;

class ConceptLocaleSupportTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_supported_locales_include_en_and_es(): void
    {
        $this->assertSame(['en', 'es'], ConceptLocale::supported());
        $this->assertSame('en', ConceptLocale::default());
        $this->assertSame('es', ConceptLocale::resolve('es-ES'));
        $this->assertSame('en', ConceptLocale::resolve('fr'));
    }

    public function test_canonical_key_is_language_neutral(): void
    {
        $canonicalizer = app(ConceptCanonicalizer::class);

        $this->assertSame('creativity', $canonicalizer->canonicalKeyFor('Creativity', 'en'));
        $this->assertSame('creativity', $canonicalizer->canonicalKeyFor('Creativity', 'es'));
    }

    public function test_resolve_or_create_attaches_second_locale_to_same_concept(): void
    {
        $canonicalizer = app(ConceptCanonicalizer::class);

        $en = $canonicalizer->resolveOrCreate('Creativity', 'en', 'Imagination at work.');
        $es = $canonicalizer->resolveOrCreate('Creativity', 'es', 'La imaginación en acción.');

        $this->assertSame($en->id, $es->id);
        $this->assertDatabaseHas('concept_terms', [
            'concept_id' => $en->id,
            'locale' => 'en',
            'normalized_term' => 'creativity',
        ]);
        $this->assertDatabaseHas('concept_terms', [
            'concept_id' => $en->id,
            'locale' => 'es',
            'normalized_term' => 'creativity',
        ]);
        $this->assertSame('creativity', $en->fresh()->canonical_key);
    }

    public function test_graph_query_returns_localized_labels_without_cross_locale_fallback(): void
    {
        $conceptA = Concept::query()->create(['canonical_key' => 'creativity']);
        $conceptB = Concept::query()->create(['canonical_key' => 'constraint']);

        ConceptTerm::query()->create([
            'concept_id' => $conceptA->id,
            'locale' => 'en',
            'term' => 'creativity',
            'normalized_term' => 'creativity',
            'short_description' => 'English desc A',
            'complexity' => 2,
            'is_preferred' => true,
            'wiki_url' => 'https://en.wikipedia.org/wiki/Creativity',
        ]);
        ConceptTerm::query()->create([
            'concept_id' => $conceptA->id,
            'locale' => 'es',
            'term' => 'creatividad',
            'normalized_term' => 'creatividad',
            'short_description' => 'Descripción A',
            'complexity' => 2,
            'is_preferred' => true,
            'wiki_url' => 'https://es.wikipedia.org/wiki/Creatividad',
        ]);
        ConceptTerm::query()->create([
            'concept_id' => $conceptB->id,
            'locale' => 'en',
            'term' => 'constraint',
            'normalized_term' => 'constraint',
            'short_description' => 'English desc B',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        ConceptRelationship::query()->create([
            'from_concept_id' => $conceptA->id,
            'to_concept_id' => $conceptB->id,
            'strength' => 0.8,
            'last_laterality' => 3,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);

        $graph = app(ConceptGraphQuery::class)->getGraph('creatividad', locale: 'es');

        // Neighbor B has no Spanish term — graph must not mix English labels in.
        $this->assertNull($graph);

        // Add a Spanish neighbor so a same-locale edge exists.
        $conceptC = Concept::query()->create(['canonical_key' => 'silence']);
        ConceptTerm::query()->create([
            'concept_id' => $conceptC->id,
            'locale' => 'es',
            'term' => 'silencio',
            'normalized_term' => 'silencio',
            'short_description' => 'Descripción C',
            'complexity' => 2,
            'is_preferred' => true,
        ]);
        ConceptRelationship::query()->create([
            'from_concept_id' => $conceptA->id,
            'to_concept_id' => $conceptC->id,
            'strength' => 0.7,
            'last_laterality' => 2,
            'llm_occurrences' => 1,
            'user_weight' => 0,
        ]);

        $graph = app(ConceptGraphQuery::class)->getGraph('creatividad', locale: 'es');

        $this->assertNotNull($graph);
        $this->assertSame('es', $graph['meta']['locale']);
        $this->assertSame('creatividad', $graph['start']['label']);

        $byId = collect($graph['nodes'])->keyBy('id');
        $this->assertSame('creatividad', $byId[$conceptA->id]['label']);
        $this->assertSame('Descripción A', $byId[$conceptA->id]['shortDescription']);
        $this->assertSame('https://es.wikipedia.org/wiki/Creatividad', $byId[$conceptA->id]['wikiUrl']);
        $this->assertSame('es', $byId[$conceptA->id]['locale']);
        $this->assertArrayNotHasKey($conceptB->id, $byId->all());
        $this->assertSame('silencio', $byId[$conceptC->id]['label']);
        $this->assertSame('es', $byId[$conceptC->id]['locale']);

        foreach ($graph['edges'] as $edge) {
            $this->assertTrue(isset($byId[$edge['from']], $byId[$edge['to']]));
            $this->assertNotSame($conceptB->id, $edge['from']);
            $this->assertNotSame($conceptB->id, $edge['to']);
        }
    }

    public function test_localize_service_creates_target_locale_terms(): void
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
            'media_url' => 'https://example.com/silence.jpg',
        ]);

        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')->andReturn([
            'translations' => [
                [
                    'id' => $concept->id,
                    'term' => 'silencio',
                    'shortDescription' => 'Ausencia de sonido.',
                ],
            ],
        ]);

        $fakeAgent = new class($mockResponse)
        {
            public function __construct(private StructuredAgentResponse $response) {}

            public function prompt(string $prompt): StructuredAgentResponse
            {
                return $this->response;
            }
        };

        $wikipedia = Mockery::mock(WikipediaSearchTool::class);
        $wikipedia->shouldReceive('lookup')
            ->once()
            ->with('silencio', 'Ausencia de sonido.', 'es')
            ->andReturn('https://es.wikipedia.org/wiki/Silencio');
        $this->app->instance(WikipediaSearchTool::class, $wikipedia);

        $stats = app(ConceptLocalizeService::class)->localize(
            fromLocale: 'en',
            toLocale: 'es',
            limit: 10,
            missingOnly: true,
            batchSize: 10,
            agent: $fakeAgent,
        );

        $this->assertSame(1, $stats['created']);
        $this->assertDatabaseHas('concept_terms', [
            'concept_id' => $concept->id,
            'locale' => 'es',
            'term' => 'silencio',
            'short_description' => 'Ausencia de sonido.',
            'wiki_url' => 'https://es.wikipedia.org/wiki/Silencio',
            'media_url' => 'https://example.com/silence.jpg',
        ]);
    }
}
