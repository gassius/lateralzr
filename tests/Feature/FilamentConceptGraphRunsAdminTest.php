<?php

namespace Tests\Feature;

use App\Filament\Resources\ConceptGraphRuns\ConceptGraphRunResource;
use App\Filament\Resources\ConceptGraphRuns\Pages\ListConceptGraphRuns;
use App\Jobs\CompleteInfoPipelineNodeJob;
use App\Jobs\GeneratePipelineNodeJob;
use App\Jobs\LocalizePipelineNodeJob;
use App\Models\ConceptGraphRun;
use App\Models\ConceptGraphRunJob;
use App\Models\ConceptPipelineNode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Feature\Concerns\InteractsWithFilamentAdmin;
use Tests\TestCase;

class FilamentConceptGraphRunsAdminTest extends TestCase
{
    use InteractsWithFilamentAdmin;
    use RefreshDatabase;

    public function test_concept_graph_runs_can_sort_by_target(): void
    {
        $this->actingAsAdmin();

        $small = $this->makeGraphRun(starts: ['river'], targetCount: 10);
        $large = $this->makeGraphRun(starts: ['pyramid'], targetCount: 80);

        $this->get('/admin/concept-graph-runs?sort=target_count:asc')->assertSuccessful();

        Livewire::test(ListConceptGraphRuns::class)
            ->sortTable('target_count')
            ->assertCanSeeTableRecords([$small, $large], inOrder: true);
    }

    public function test_concept_graph_runs_search_matches_seed_summary(): void
    {
        $this->actingAsAdmin();

        $pyramid = $this->makeGraphRun(starts: ['pyramid'], targetCount: 40);
        $river = $this->makeGraphRun(starts: ['river'], targetCount: 40);

        $this->get('/admin/concept-graph-runs?search=pyramid')->assertSuccessful();

        Livewire::test(ListConceptGraphRuns::class)
            ->searchTable('pyramid')
            ->assertCanSeeTableRecords([$pyramid])
            ->assertCanNotSeeTableRecords([$river]);
    }

    public function test_run_list_query_counts_partial_jobs(): void
    {
        $this->actingAsAdmin();

        $run = $this->makeGraphRun(starts: ['pyramid'], targetCount: 3);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => $run->run_uuid,
            'seed' => 'localize#1',
            'status' => 'succeeded',
            'attempts' => 1,
        ]);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => $run->run_uuid,
            'seed' => 'localize#2',
            'status' => 'partial',
            'attempts' => 1,
        ]);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => $run->run_uuid,
            'seed' => 'localize#3',
            'status' => 'failed',
            'attempts' => 1,
        ]);

        $record = ConceptGraphRunResource::getEloquentQuery()->whereKey($run->id)->first();

        $this->assertSame(1, (int) $record?->succeeded_jobs_count);
        $this->assertSame(1, (int) $record?->partial_jobs_count);
        $this->assertSame(1, (int) $record?->failed_jobs_count);
    }

    public function test_generate_and_localize_forms_show_effective_default_model(): void
    {
        $this->actingAsAdmin();

        $helper = ListConceptGraphRuns::modelFieldHelper();
        $this->assertStringStartsWith('Empty uses ', $helper);

        Livewire::test(ListConceptGraphRuns::class)
            ->assertActionExists('enqueueLocalize')
            ->assertActionExists('enqueuePrefetch')
            ->assertActionExists('enqueueGenerate')
            ->mountAction('enqueueLocalize')
            ->assertActionMounted('enqueueLocalize')
            ->unmountAction()
            ->mountAction('enqueuePrefetch')
            ->assertActionMounted('enqueuePrefetch')
            ->unmountAction()
            ->mountAction('enqueueGenerate')
            ->assertActionMounted('enqueueGenerate');
    }

    public function test_generate_concepts_action_enqueues_pipeline_without_batch_size(): void
    {
        $this->actingAsAdmin();
        Bus::fake();

        Livewire::test(ListConceptGraphRuns::class)
            ->callAction('enqueueGenerate', [
                'concepts' => ['origami'],
                'random' => 0,
                'count' => 10,
                'complexity' => 3,
                'depth' => 1,
                'queue' => 'default',
            ]);

        $run = ConceptGraphRun::query()->first();
        $this->assertNotNull($run);
        $this->assertSame(ConceptGraphRun::TYPE_PIPELINE, $run->type);
        $this->assertSame(3, (int) $run->complexity);
        $this->assertSame(1, (int) data_get($run->seeds, 'depth'));
        $this->assertArrayNotHasKey('batchSize', $run->seeds ?? []);
        $this->assertSame(1, ConceptPipelineNode::query()->count());

        Bus::assertChained([
            GeneratePipelineNodeJob::class,
            LocalizePipelineNodeJob::class,
            CompleteInfoPipelineNodeJob::class,
        ]);
    }

    /**
     * @param  list<string>  $starts
     */
    protected function makeGraphRun(array $starts, int $targetCount, ?string $runUuid = null): ConceptGraphRun
    {
        return ConceptGraphRun::query()->create([
            'run_uuid' => $runUuid ?? (string) Str::uuid(),
            'type' => ConceptGraphRun::TYPE_GRAPH,
            'provider' => 'openrouter',
            'model' => 'openai/gpt-4o-mini',
            'complexity' => 2,
            'queue' => 'default',
            'seed_count' => count($starts),
            'seeds' => [
                'starts' => $starts,
                'randomIdea' => false,
                'targetCount' => $targetCount,
                'batchSize' => 10,
            ],
            'dispatched_at' => now(),
        ]);
    }
}
