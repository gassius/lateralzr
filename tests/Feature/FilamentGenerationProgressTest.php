<?php

namespace Tests\Feature;

use App\Filament\Pages\GenerationProgress;
use App\Filament\Resources\ConceptGraphRuns\Pages\ListConceptGraphRuns;
use App\Filament\Resources\ConceptGraphRuns\Pages\ViewConceptGraphRun;
use App\Jobs\CompleteInfoPipelineNodeJob;
use App\Jobs\GeneratePipelineNodeJob;
use App\Jobs\LocalizePipelineNodeJob;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use Filament\Actions\Testing\TestAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Feature\Concerns\InteractsWithFilamentAdmin;
use Tests\TestCase;

class FilamentGenerationProgressTest extends TestCase
{
    use InteractsWithFilamentAdmin;
    use RefreshDatabase;

    public function test_progress_page_shows_counts_nodes_failures_and_polls_while_active(): void
    {
        $this->actingAsAdmin();

        $run = $this->makePipelineRun();
        $this->makeNode($run, [
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_FAILED,
            'generate_error' => 'LLM exploded',
            'generate_started_at' => now()->subSeconds(40),
            'generate_finished_at' => now()->subSeconds(10),
            'localize_status' => ConceptPipelineNode::STATUS_SKIPPED,
            'complete_info_status' => ConceptPipelineNode::STATUS_SKIPPED,
        ]);
        $this->makeNode($run, [
            'canonical_key' => 'harbor',
            'seed_term' => 'harbor',
            'depth' => 1,
            'generate_status' => ConceptPipelineNode::STATUS_PENDING,
            'localize_status' => ConceptPipelineNode::STATUS_PENDING,
            'complete_info_status' => ConceptPipelineNode::STATUS_PENDING,
        ]);

        $this->get('/admin/generation-progress/'.$run->id)
            ->assertSuccessful()
            ->assertSee('origami')
            ->assertSee('harbor')
            ->assertSee('LLM exploded')
            ->assertSee('Depth 0')
            ->assertSee('Depth 1')
            ->assertSee('Retry')
            ->assertSee('Generate')
            ->assertSee('ETA');

        Livewire::test(GenerationProgress::class, ['record' => $run->getKey()])
            ->assertSee('origami')
            ->assertSee('LLM exploded')
            ->assertSeeHtml('wire:poll.5s');
    }

    public function test_progress_page_stops_polling_when_the_run_is_finished(): void
    {
        $this->actingAsAdmin();

        $run = $this->makePipelineRun();
        $this->makeNode($run, [
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'localize_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'complete_info_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
        ]);

        Livewire::test(GenerationProgress::class, ['record' => $run->getKey()])
            ->assertSee('origami')
            ->assertDontSeeHtml('wire:poll.5s');
    }

    public function test_retry_action_requeues_only_the_failed_stage(): void
    {
        $this->actingAsAdmin();
        Bus::fake();

        $run = $this->makePipelineRun();
        $node = $this->makeNode($run, [
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'localize_status' => ConceptPipelineNode::STATUS_FAILED,
            'localize_error' => 'translate failed',
            'complete_info_status' => ConceptPipelineNode::STATUS_SKIPPED,
        ]);

        Livewire::test(GenerationProgress::class, ['record' => $run->getKey()])
            ->callAction(TestAction::make('retryStage')->arguments([
                'nodeId' => $node->id,
                'stage' => ConceptPipelineNode::STAGE_LOCALIZE,
            ]));

        $node->refresh();
        $this->assertSame(ConceptPipelineNode::STATUS_SUCCEEDED, $node->generate_status);
        $this->assertSame(ConceptPipelineNode::STATUS_PENDING, $node->localize_status);
        $this->assertSame(ConceptPipelineNode::STATUS_PENDING, $node->complete_info_status);

        Bus::assertChained([
            LocalizePipelineNodeJob::class,
            CompleteInfoPipelineNodeJob::class,
        ]);
        Bus::assertNotDispatched(GeneratePipelineNodeJob::class);
    }

    public function test_worker_runs_keeps_view_and_links_pipeline_runs_to_progress(): void
    {
        $this->actingAsAdmin();

        $pipeline = $this->makePipelineRun();
        $legacy = ConceptGraphRun::query()->create([
            'run_uuid' => (string) Str::uuid(),
            'type' => ConceptGraphRun::TYPE_GRAPH,
            'complexity' => 2,
            'queue' => 'default',
            'seed_count' => 1,
            'seeds' => ['starts' => ['river'], 'targetCount' => 10, 'batchSize' => 10],
            'dispatched_at' => now(),
        ]);

        $this->get('/admin/concept-graph-runs')->assertSuccessful();
        $this->get('/admin/concept-graph-runs/'.$legacy->id)->assertSuccessful();
        $this->get('/admin/concept-graph-runs/'.$pipeline->id)->assertSuccessful();

        Livewire::test(ListConceptGraphRuns::class)
            ->assertTableActionVisible('view', $pipeline)
            ->assertTableActionVisible('view', $legacy)
            ->assertTableActionVisible('generationProgress', $pipeline)
            ->assertTableActionHidden('generationProgress', $legacy);

        Livewire::test(ViewConceptGraphRun::class, ['record' => $pipeline->getKey()])
            ->assertActionVisible('generationProgress');

        Livewire::test(ViewConceptGraphRun::class, ['record' => $legacy->getKey()])
            ->assertActionHidden('generationProgress');
    }

    public function test_progress_page_rejects_non_pipeline_runs(): void
    {
        $this->actingAsAdmin();

        $legacy = ConceptGraphRun::query()->create([
            'run_uuid' => (string) Str::uuid(),
            'type' => ConceptGraphRun::TYPE_GRAPH,
            'complexity' => 2,
            'queue' => 'default',
            'seed_count' => 1,
            'seeds' => ['starts' => ['river']],
            'dispatched_at' => now(),
        ]);

        $this->get('/admin/generation-progress/'.$legacy->id)->assertNotFound();
    }

    protected function makePipelineRun(): ConceptGraphRun
    {
        return ConceptGraphRun::query()->create([
            'run_uuid' => (string) Str::uuid(),
            'type' => ConceptGraphRun::TYPE_PIPELINE,
            'provider' => 'openrouter',
            'model' => 'openai/gpt-4o-mini',
            'complexity' => 3,
            'queue' => 'default',
            'seed_count' => 1,
            'seeds' => ['starts' => ['origami'], 'depth' => 1, 'count' => 10],
            'dispatched_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    protected function makeNode(ConceptGraphRun $run, array $attributes): ConceptPipelineNode
    {
        return ConceptPipelineNode::query()->create([
            'run_uuid' => $run->run_uuid,
            ...$attributes,
        ]);
    }
}
