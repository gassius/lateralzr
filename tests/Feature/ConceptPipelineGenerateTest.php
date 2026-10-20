<?php

namespace Tests\Feature;

use App\Jobs\CompleteInfoPipelineNodeJob;
use App\Jobs\GeneratePipelineNodeJob;
use App\Jobs\LocalizePipelineNodeJob;
use App\Models\Concept;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use App\Models\ConceptRelationship;
use App\Models\ConceptTerm;
use App\Services\ConceptCompleteInfoService;
use App\Services\ConceptGraphStore;
use App\Services\ConceptLocalizeService;
use App\Services\ConceptPipeline\ConceptPipelineDispatchService;
use App\Services\ConceptRelationshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Mockery;
use Tests\TestCase;

class ConceptPipelineGenerateTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_command_rejects_depth_above_three(): void
    {
        $this->artisan('concepts:generate', [
            '--concept' => 'origami',
            '--depth' => 4,
        ])
            ->expectsOutputToContain('Depth must be between 1 and 3')
            ->assertFailed();

        $this->assertDatabaseCount('concept_graph_runs', 0);
        $this->assertDatabaseCount('concept_pipeline_nodes', 0);
    }

    public function test_command_requires_a_seed(): void
    {
        $this->artisan('concepts:generate')
            ->expectsOutputToContain('Provide --concept, --concepts, or --random')
            ->assertFailed();
    }

    public function test_help_has_no_batch_size_and_lists_openrouter(): void
    {
        $this->artisan('concepts:generate', ['--help'])
            ->expectsOutputToContain('openrouter')
            ->expectsOutputToContain('--count')
            ->expectsOutputToContain('--depth')
            ->doesntExpectOutputToContain('--batch-size')
            ->assertSuccessful();
    }

    public function test_command_dispatches_one_chain_per_seed_with_defaults(): void
    {
        Bus::fake();

        $this->artisan('concepts:generate', [
            '--concept' => 'origami',
            '--provider' => 'openrouter',
        ])->assertSuccessful();

        $run = ConceptGraphRun::query()->first();
        $this->assertNotNull($run);
        $this->assertSame(ConceptGraphRun::TYPE_PIPELINE, $run->type);
        $this->assertSame(10, (int) data_get($run->seeds, 'count'));
        $this->assertSame(3, (int) $run->complexity);
        $this->assertSame(1, (int) data_get($run->seeds, 'depth'));
        $this->assertSame(['es'], data_get($run->seeds, 'locales'));
        $this->assertSame('openrouter', $run->provider);
        $this->assertSame(1, $run->pipelineNodes()->count());

        $node = $run->pipelineNodes()->first();
        $this->assertSame(0, (int) $node?->depth);
        $this->assertSame('origami', $node?->canonical_key);
        $this->assertSame(ConceptPipelineNode::STATUS_PENDING, $node?->generate_status);
        $this->assertSame(ConceptPipelineNode::STATUS_PENDING, $node?->localize_status);
        $this->assertSame(ConceptPipelineNode::STATUS_PENDING, $node?->complete_info_status);

        Bus::assertChained([
            GeneratePipelineNodeJob::class,
            LocalizePipelineNodeJob::class,
            CompleteInfoPipelineNodeJob::class,
        ]);
    }

    public function test_command_accepts_a_list_of_concepts(): void
    {
        Bus::fake();

        $this->artisan('concepts:generate', [
            '--concepts' => 'origami, harbor, silence',
        ])->assertSuccessful();

        $this->assertSame(3, ConceptPipelineNode::query()->count());
        $this->assertEqualsCanonicalizing(
            ['origami', 'harbor', 'silence'],
            ConceptPipelineNode::query()->pluck('canonical_key')->all()
        );
    }

    public function test_command_accepts_random_existing_concepts(): void
    {
        Bus::fake();
        $this->makeConcept('harbor', 'harbor');
        $this->makeConcept('silence', 'silence');

        $this->artisan('concepts:generate', [
            '--random' => 2,
        ])->assertSuccessful();

        $this->assertSame(2, ConceptPipelineNode::query()->count());
        $this->assertEqualsCanonicalizing(
            ['harbor', 'silence'],
            ConceptPipelineNode::query()->pluck('canonical_key')->all()
        );
    }

    public function test_legacy_prefetch_still_enqueues_with_batch_size(): void
    {
        Bus::fake();

        $this->artisan('concepts:prefetch', [
            '--starts' => 'creativity',
            '--count' => 10,
            '--batch-size' => 10,
        ])->assertSuccessful();

        $this->assertDatabaseHas('concept_graph_runs', [
            'type' => 'graph',
        ]);
    }

    public function test_each_node_is_chained_and_generate_makes_one_llm_call(): void
    {
        $this->bindPipelineServiceFakes($generateTimes = 1);

        $this->artisan('concepts:generate', [
            '--concept' => 'origami',
            '--count' => 10,
            '--depth' => 1,
        ])->assertSuccessful();

        $run = ConceptGraphRun::query()->first();
        $this->assertNotNull($run);
        $this->assertSame(3, $run->pipelineNodes()->count());

        $seed = $run->pipelineNodes()->where('depth', 0)->first();
        $this->assertSame(ConceptPipelineNode::STATUS_SUCCEEDED, $seed?->generate_status);
        $this->assertSame(ConceptPipelineNode::STATUS_SUCCEEDED, $seed?->localize_status);
        $this->assertSame(ConceptPipelineNode::STATUS_SUCCEEDED, $seed?->complete_info_status);

        $children = $run->pipelineNodes()->where('depth', 1)->get();
        $this->assertCount(2, $children);
        foreach ($children as $child) {
            $this->assertSame(ConceptPipelineNode::STATUS_SKIPPED, $child->generate_status);
            $this->assertSame(ConceptPipelineNode::STATUS_SUCCEEDED, $child->localize_status);
            $this->assertSame(ConceptPipelineNode::STATUS_SUCCEEDED, $child->complete_info_status);
        }

        $aggregates = $run->pipelineStageAggregates();
        $this->assertSame(1, $aggregates['generate'][ConceptPipelineNode::STATUS_SUCCEEDED] ?? 0);
        $this->assertSame(2, $aggregates['generate'][ConceptPipelineNode::STATUS_SKIPPED] ?? 0);
        $this->assertSame(3, $aggregates['localize'][ConceptPipelineNode::STATUS_SUCCEEDED] ?? 0);
        $this->assertSame(3, $aggregates['complete_info'][ConceptPipelineNode::STATUS_SUCCEEDED] ?? 0);
    }

    public function test_duplicate_canonical_key_is_not_re_expanded(): void
    {
        Bus::fake();

        $run = app(ConceptPipelineDispatchService::class)->dispatch(
            concepts: ['origami', 'harbor'],
            count: 3,
            depth: 2,
        );

        $origami = $run->pipelineNodes()->where('canonical_key', 'origami')->first();
        $harbor = $run->pipelineNodes()->where('canonical_key', 'harbor')->first();
        $this->assertNotNull($origami);
        $this->assertNotNull($harbor);

        $this->bindRelationshipServiceOnce('origami', ['harbor', 'pufferfish']);
        (new GeneratePipelineNodeJob((int) $origami->id))->handle(
            app(ConceptRelationshipService::class),
            app(ConceptGraphStore::class),
            app(ConceptPipelineDispatchService::class),
        );

        $this->assertSame(3, $run->pipelineNodes()->count());
        $this->assertSame(1, $run->pipelineNodes()->where('canonical_key', 'harbor')->count());
        $this->assertSame(1, $run->pipelineNodes()->where('canonical_key', 'pufferfish')->count());
    }

    public function test_run_never_creates_more_than_200_concepts(): void
    {
        $this->bindOverflowingGenerateFake();
        $this->bindLocalizeAndCompleteFakes();

        $before = Concept::query()->count();

        $this->artisan('concepts:generate', [
            '--concept' => 'seed-run',
            '--count' => 10,
            '--depth' => 2,
        ])->assertSuccessful();

        $created = Concept::query()->count() - $before;
        $this->assertLessThanOrEqual(200, $created);
        $this->assertGreaterThan(10, $created);

        $run = ConceptGraphRun::query()->first();
        $this->assertNotNull($run);
        $this->assertLessThanOrEqual(200, (int) data_get($run->seeds, 'conceptsCreated'));
    }

    public function test_generate_persists_at_most_remaining_budget_when_fake_returns_extra(): void
    {
        Bus::fake();

        $run = app(ConceptPipelineDispatchService::class)->dispatch(
            concepts: ['origami'],
            count: 10,
            depth: 2,
        );
        $seeds = $run->seeds ?? [];
        $seeds['conceptsCreated'] = 198;
        $run->seeds = $seeds;
        $run->save();

        $related = [];
        for ($i = 0; $i < 15; $i++) {
            $related[] = "extra-{$i}";
        }
        $this->bindRelationshipServiceOnce('origami', $related);

        $before = Concept::query()->count();
        $job = new GeneratePipelineNodeJob((int) $run->pipelineNodes()->first()?->id);
        $job->withFakeQueueInteractions();
        $job->handle(
            app(ConceptRelationshipService::class),
            app(ConceptGraphStore::class),
            app(ConceptPipelineDispatchService::class),
        );

        $this->assertLessThanOrEqual(2, Concept::query()->count() - $before);
        $this->assertLessThanOrEqual(200, (int) data_get($run->fresh()->seeds, 'conceptsCreated'));
    }

    public function test_generate_soft_deadline_fails_the_job_and_does_not_run_later_stages(): void
    {
        Bus::fake();

        $run = app(ConceptPipelineDispatchService::class)->dispatch(
            concepts: ['origami'],
            count: 10,
            depth: 1,
        );
        $node = $run->pipelineNodes()->first();
        $this->assertNotNull($node);

        $generate = Mockery::mock(ConceptRelationshipService::class);
        $generate->shouldReceive('generateRelationships')->never();
        $this->app->instance(ConceptRelationshipService::class, $generate);

        $localize = Mockery::mock(ConceptLocalizeService::class);
        $localize->shouldReceive('localize')->never();
        $this->app->instance(ConceptLocalizeService::class, $localize);

        $job = new GeneratePipelineNodeJob((int) $node->id);
        $job->timeout = 50;
        $job->withFakeQueueInteractions();
        $job->handle(
            app(ConceptRelationshipService::class),
            app(ConceptGraphStore::class),
            app(ConceptPipelineDispatchService::class),
        );
        $job->assertFailed();

        $node->refresh();
        $this->assertSame(ConceptPipelineNode::STATUS_FAILED, $node->generate_status);
        $this->assertSame(ConceptPipelineNode::STATUS_SKIPPED, $node->localize_status);
        $this->assertSame(ConceptPipelineNode::STATUS_SKIPPED, $node->complete_info_status);

        (new LocalizePipelineNodeJob((int) $node->id, 'es'))->handle(
            app(ConceptLocalizeService::class),
            app(ConceptPipelineDispatchService::class),
        );
        $node->refresh();
        $this->assertSame(ConceptPipelineNode::STATUS_SKIPPED, $node->localize_status);
    }

    public function test_each_locale_is_localised_on_its_own_job_and_stage_succeeds_after_the_last(): void
    {
        config(['concepts.supported_locales' => ['en', 'es', 'fr', 'de']]);
        Bus::fake();

        $concept = $this->makeConcept('origami', 'origami');
        $run = app(ConceptPipelineDispatchService::class)->dispatch(
            concepts: ['origami'],
            count: 10,
            depth: 1,
            locales: ['es', 'fr', 'de'],
        );
        $node = $run->pipelineNodes()->first();
        $this->assertNotNull($node);
        $this->assertSame((int) $concept->id, (int) $node->concept_id);
        $this->assertSame(['es', 'fr', 'de'], data_get($run->seeds, 'locales'));

        $nodeId = (int) $node->id;
        Bus::assertChained([
            function (GeneratePipelineNodeJob $job) use ($nodeId): bool {
                return $job->nodeId === $nodeId;
            },
            function (LocalizePipelineNodeJob $job) use ($nodeId): bool {
                return $job->nodeId === $nodeId && $job->locale === 'es';
            },
            function (LocalizePipelineNodeJob $job) use ($nodeId): bool {
                return $job->nodeId === $nodeId && $job->locale === 'fr';
            },
            function (LocalizePipelineNodeJob $job) use ($nodeId): bool {
                return $job->nodeId === $nodeId && $job->locale === 'de';
            },
            function (CompleteInfoPipelineNodeJob $job) use ($nodeId): bool {
                return $job->nodeId === $nodeId;
            },
        ]);

        $calls = [];
        $localize = Mockery::mock(ConceptLocalizeService::class);
        $localize->shouldReceive('localize')
            ->times(3)
            ->andReturnUsing(function (string $fromLocale, string $toLocale) use (&$calls) {
                $calls[] = $toLocale;

                return [
                    'processed' => 1,
                    'created' => 1,
                    'skipped' => 0,
                    'failed' => 0,
                    'deferred' => 0,
                    'deferredConceptIds' => [],
                ];
            });
        $this->app->instance(ConceptLocalizeService::class, $localize);

        $pipeline = app(ConceptPipelineDispatchService::class);
        foreach (['es', 'fr', 'de'] as $locale) {
            (new LocalizePipelineNodeJob($nodeId, $locale))->handle($localize, $pipeline);
            $node->refresh();
            if ($locale !== 'de') {
                $this->assertSame(ConceptPipelineNode::STATUS_PROCESSING, $node->localize_status);
            }
        }

        $this->assertSame(['es', 'fr', 'de'], $calls);
        $this->assertSame(ConceptPipelineNode::STATUS_SUCCEEDED, $node->localize_status);
        $this->assertNull($node->localize_error);
    }

    public function test_en_only_locales_mark_localize_skipped_so_the_node_finishes(): void
    {
        $this->bindPipelineServiceFakes(1);
        $localize = Mockery::mock(ConceptLocalizeService::class);
        $localize->shouldReceive('localize')->never();
        $this->app->instance(ConceptLocalizeService::class, $localize);

        $run = app(ConceptPipelineDispatchService::class)->dispatch(
            concepts: ['origami'],
            count: 10,
            depth: 1,
            locales: ['en'],
        );

        $this->assertSame([], app(ConceptPipelineDispatchService::class)->targetLocales($run));
        $this->assertGreaterThan(0, $run->pipelineNodes()->count());
        foreach ($run->pipelineNodes as $node) {
            $this->assertSame(ConceptPipelineNode::STATUS_SKIPPED, $node->localize_status);
        }
    }

    public function test_limit_new_concepts_keeps_existing_and_one_new_when_budget_is_one(): void
    {
        $this->makeConcept('harbor', 'harbor');

        [$kept, $newCount] = app(ConceptPipelineDispatchService::class)->limitNewConcepts(
            [
                ['concept' => 'harbor', 'shortDescription' => 'An existing related concept.'],
                ['concept' => 'new-one', 'shortDescription' => 'First new related concept.'],
                ['concept' => 'new-two', 'shortDescription' => 'Second new related concept.'],
            ],
            'origami',
            1,
        );

        $this->assertSame(['harbor', 'new-one'], array_column($kept, 'concept'));
        $this->assertSame(1, $newCount);
    }

    public function test_generate_stores_edge_to_existing_related_concept(): void
    {
        Bus::fake();

        $seed = $this->makeConcept('origami', 'origami');
        $existing = $this->makeConcept('harbor', 'harbor');

        $run = app(ConceptPipelineDispatchService::class)->dispatch(
            concepts: ['origami'],
            count: 10,
            depth: 1,
        );
        $this->bindRelationshipServiceOnce('origami', ['harbor', 'pufferfish']);

        (new GeneratePipelineNodeJob((int) $run->pipelineNodes()->first()?->id))->handle(
            app(ConceptRelationshipService::class),
            app(ConceptGraphStore::class),
            app(ConceptPipelineDispatchService::class),
        );

        $this->assertSame(1, Concept::query()->where('canonical_key', 'harbor')->count());
        $this->assertTrue(Concept::query()->where('canonical_key', 'pufferfish')->exists());
        $this->assertSame(1, ConceptRelationship::query()
            ->where('from_concept_id', $seed->id)
            ->where('to_concept_id', $existing->id)
            ->count());
    }

    public function test_command_rejects_labels_longer_than_255_characters(): void
    {
        $this->artisan('concepts:generate', [
            '--concept' => str_repeat('a', 256),
        ])
            ->expectsOutputToContain('at most 255 characters')
            ->assertFailed();
    }

    /**
     * @param  list<string>  $related
     */
    protected function bindRelationshipServiceOnce(string $start, array $related): void
    {
        $service = Mockery::mock(ConceptRelationshipService::class);
        $service->shouldReceive('generateRelationships')
            ->once()
            ->andReturn($this->graphPayload($start, $related));
        $this->app->instance(ConceptRelationshipService::class, $service);
    }

    protected function bindPipelineServiceFakes(int $generateTimes): void
    {
        $generate = Mockery::mock(ConceptRelationshipService::class);
        $generate->shouldReceive('generateRelationships')
            ->times($generateTimes)
            ->andReturn($this->graphPayload('origami', ['crumple zones', 'pufferfish']));
        $this->app->instance(ConceptRelationshipService::class, $generate);

        $this->bindLocalizeAndCompleteFakes();
    }

    protected function bindOverflowingGenerateFake(): void
    {
        $n = 0;
        $generate = Mockery::mock(ConceptRelationshipService::class);
        $generate->shouldReceive('generateRelationships')
            ->andReturnUsing(function (?string $start) use (&$n) {
                $n++;
                $related = [];
                for ($i = 0; $i < 20; $i++) {
                    $related[] = "g{$n}-c{$i}";
                }

                return $this->graphPayload($start ?: 'seed-run', $related);
            });
        $this->app->instance(ConceptRelationshipService::class, $generate);
    }

    protected function bindLocalizeAndCompleteFakes(): void
    {
        $localize = Mockery::mock(ConceptLocalizeService::class);
        $localize->shouldReceive('localize')->andReturn([
            'processed' => 1,
            'created' => 1,
            'skipped' => 0,
            'failed' => 0,
            'deferred' => 0,
            'deferredConceptIds' => [],
        ]);
        $this->app->instance(ConceptLocalizeService::class, $localize);

        $complete = Mockery::mock(ConceptCompleteInfoService::class);
        $complete->shouldReceive('complete')->andReturn([
            'processed' => 1,
            'wikiUpdated' => 1,
            'mediaUpdated' => 0,
            'skipped' => 0,
            'failed' => 0,
            'deferred' => 0,
            'deferredTermIds' => [],
        ]);
        $this->app->instance(ConceptCompleteInfoService::class, $complete);
    }

    /**
     * @param  list<string>  $related
     * @return array{complexity: int, start_concept: string, concepts: list<array<string, mixed>>, edges: list<array<string, mixed>>}
     */
    protected function graphPayload(string $start, array $related): array
    {
        $concepts = [
            [
                'concept' => $start,
                'shortDescription' => "A starting concept: {$start}.",
                'complexity' => 3,
                'wikiUrl' => null,
                'mediaUrl' => null,
            ],
        ];
        $edges = [];
        $previous = $start;
        foreach ($related as $label) {
            $concepts[] = [
                'concept' => $label,
                'shortDescription' => "A related concept: {$label}.",
                'complexity' => 3,
                'wikiUrl' => null,
                'mediaUrl' => null,
            ];
            $edges[] = ['from' => $previous, 'to' => $label, 'laterality' => 4];
            $previous = $label;
        }

        return [
            'complexity' => 3,
            'start_concept' => $start,
            'concepts' => $concepts,
            'edges' => $edges,
        ];
    }

    protected function makeConcept(string $term, string $canonicalKey): Concept
    {
        $concept = Concept::query()->create(['canonical_key' => $canonicalKey]);
        ConceptTerm::query()->create([
            'concept_id' => $concept->id,
            'locale' => 'en',
            'term' => $term,
            'normalized_term' => ConceptTerm::normalizeTerm($term),
            'short_description' => "A term for {$term}.",
            'complexity' => 3,
            'is_preferred' => true,
        ]);

        return $concept;
    }
}
