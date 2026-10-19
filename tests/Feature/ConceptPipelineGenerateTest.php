<?php

namespace Tests\Feature;

use App\Jobs\CompleteInfoPipelineNodeJob;
use App\Jobs\GeneratePipelineNodeJob;
use App\Jobs\LocalizePipelineNodeJob;
use App\Models\Concept;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
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

    public function test_run_never_creates_more_than_200_nodes(): void
    {
        Bus::fake();

        $run = app(ConceptPipelineDispatchService::class)->dispatch(
            concepts: ['origami'],
            count: 10,
            depth: 2,
        );

        $seed = $run->pipelineNodes()->first();
        $this->assertNotNull($seed);

        for ($i = 0; $i < ConceptPipelineDispatchService::MAX_CONCEPTS - 1; $i++) {
            ConceptPipelineNode::query()->create([
                'run_uuid' => $run->run_uuid,
                'parent_node_id' => $seed->id,
                'canonical_key' => "filler-{$i}",
                'seed_term' => "filler-{$i}",
                'depth' => 1,
            ]);
        }

        $this->assertSame(200, $run->pipelineNodes()->count());

        $this->bindRelationshipServiceOnce('origami', ['alpha', 'beta', 'gamma']);
        (new GeneratePipelineNodeJob((int) $seed->id))->handle(
            app(ConceptRelationshipService::class),
            app(ConceptGraphStore::class),
            app(ConceptPipelineDispatchService::class),
        );

        $this->assertSame(200, $run->fresh()->pipelineNodes()->count());
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
