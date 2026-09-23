<?php

namespace Tests\Unit;

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
            'wiki_url' => null,
            'media_url' => 'https://example.com/silence.jpg',
        ]);
    }

    public function test_attach_localized_term_is_idempotent_for_the_same_concept(): void
    {
        $canonicalizer = app(ConceptCanonicalizer::class);
        $concept = $canonicalizer->resolveOrCreate('traffic light', 'en', 'A signal that controls road traffic.');

        $first = $canonicalizer->attachLocalizedTerm(
            concept: $concept,
            locale: 'es',
            term: 'semáforo',
            shortDescription: 'Señal de tráfico.',
            mediaUrl: 'https://example.com/semaforo.jpg',
        );
        $second = $canonicalizer->attachLocalizedTerm(
            concept: $concept,
            locale: 'es',
            term: 'Semáforo',
            shortDescription: 'Señal luminosa en un cruce.',
        );

        $this->assertNotNull($first);
        $this->assertNotNull($second);
        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, ConceptTerm::query()->where('locale', 'es')->where('normalized_term', 'semáforo')->count());
        $this->assertSame('https://example.com/semaforo.jpg', $second->media_url);
        $this->assertSame('Señal de tráfico.', $second->short_description);
    }

    public function test_attach_localized_term_does_not_steal_a_label_owned_by_another_concept(): void
    {
        $canonicalizer = app(ConceptCanonicalizer::class);
        $trafficLight = $canonicalizer->resolveOrCreate('traffic light', 'en', 'A signal that controls road traffic.');
        $semaphore = $canonicalizer->resolveOrCreate('semaphore', 'en', 'A signaling system using flags or lights.');

        $owned = $canonicalizer->attachLocalizedTerm(
            concept: $trafficLight,
            locale: 'es',
            term: 'semáforo',
            shortDescription: 'Señal de tráfico.',
        );

        $collision = $canonicalizer->attachLocalizedTerm(
            concept: $semaphore,
            locale: 'es',
            term: 'semáforo',
            shortDescription: 'Sistema de señales.',
        );

        $this->assertNotNull($owned);
        $this->assertNull($collision);
        $this->assertSame($trafficLight->id, $owned->concept_id);
        $this->assertSame(1, ConceptTerm::query()->where('locale', 'es')->where('normalized_term', 'semáforo')->count());
        $this->assertNull($semaphore->fresh()->termForLocale('es', fallback: false));
    }

    public function test_localize_skips_duplicate_locale_norm_instead_of_failing_the_batch(): void
    {
        $trafficLight = Concept::query()->create(['canonical_key' => 'traffic-light']);
        $semaphore = Concept::query()->create(['canonical_key' => 'semaphore']);

        ConceptTerm::query()->create([
            'concept_id' => $trafficLight->id,
            'locale' => 'en',
            'term' => 'traffic light',
            'normalized_term' => 'traffic light',
            'short_description' => 'A signal that controls road traffic.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);
        ConceptTerm::query()->create([
            'concept_id' => $semaphore->id,
            'locale' => 'en',
            'term' => 'semaphore',
            'normalized_term' => 'semaphore',
            'short_description' => 'A signaling system using flags or lights.',
            'complexity' => 2,
            'is_preferred' => true,
        ]);

        $mockResponse = Mockery::mock(StructuredAgentResponse::class);
        $mockResponse->shouldReceive('toArray')->andReturn([
            'translations' => [
                [
                    'id' => $trafficLight->id,
                    'term' => 'semáforo',
                    'shortDescription' => 'Señal de tráfico.',
                ],
                [
                    'id' => $semaphore->id,
                    'term' => 'semáforo',
                    'shortDescription' => 'Sistema de señales.',
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

        $stats = app(ConceptLocalizeService::class)->localize(
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            batchSize: 10,
            agent: $fakeAgent,
            conceptIds: [$trafficLight->id, $semaphore->id],
        );

        $this->assertSame(2, $stats['processed']);
        $this->assertSame(1, $stats['created']);
        $this->assertSame(1, $stats['skipped']);
        $this->assertSame(0, $stats['failed']);
        $this->assertSame(0, $stats['deferred']);
        $this->assertSame([], $stats['deferredConceptIds']);
        $this->assertDatabaseHas('concept_terms', [
            'concept_id' => $trafficLight->id,
            'locale' => 'es',
            'normalized_term' => 'semáforo',
        ]);
        $this->assertDatabaseMissing('concept_terms', [
            'concept_id' => $semaphore->id,
            'locale' => 'es',
        ]);
    }

    public function test_localize_defers_remaining_concepts_when_deadline_has_passed(): void
    {
        $first = Concept::query()->create(['canonical_key' => 'silence-deadline']);
        $second = Concept::query()->create(['canonical_key' => 'creativity-deadline']);

        foreach ([$first, $second] as $concept) {
            ConceptTerm::query()->create([
                'concept_id' => $concept->id,
                'locale' => 'en',
                'term' => $concept->canonical_key,
                'normalized_term' => $concept->canonical_key,
                'short_description' => 'A concept.',
                'complexity' => 2,
                'is_preferred' => true,
            ]);
        }

        $fakeAgent = new class
        {
            public function prompt(string $prompt): never
            {
                throw new \RuntimeException('Localize agent should not be called after the deadline.');
            }
        };

        $stats = app(ConceptLocalizeService::class)->localize(
            fromLocale: 'en',
            toLocale: 'es',
            missingOnly: true,
            batchSize: 1,
            agent: $fakeAgent,
            conceptIds: [$first->id, $second->id],
            deadlineAt: time() - 1,
        );

        $this->assertSame(0, $stats['processed']);
        $this->assertSame(0, $stats['created']);
        $this->assertSame(2, $stats['deferred']);
        $this->assertSame([$first->id, $second->id], $stats['deferredConceptIds']);
    }
}
