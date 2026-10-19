<?php

namespace Tests\Unit;

use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use App\Services\ConceptPipeline\ConceptPipelineProgress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ConceptPipelineProgressTest extends TestCase
{
    use RefreshDatabase;

    public function test_stage_counts_include_every_status_and_group_nodes_by_depth(): void
    {
        $run = $this->makePipelineRun();
        $depthZero = $this->makeNode($run, [
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_FAILED,
            'generate_error' => 'LLM exploded',
            'localize_status' => ConceptPipelineNode::STATUS_SKIPPED,
            'complete_info_status' => ConceptPipelineNode::STATUS_SKIPPED,
        ]);
        $this->makeNode($run, [
            'canonical_key' => 'harbor',
            'seed_term' => 'harbor',
            'depth' => 1,
            'parent_node_id' => $depthZero->id,
            'generate_status' => ConceptPipelineNode::STATUS_SKIPPED,
            'localize_status' => ConceptPipelineNode::STATUS_PROCESSING,
            'complete_info_status' => ConceptPipelineNode::STATUS_PENDING,
        ]);

        $progress = ConceptPipelineProgress::for($run->fresh());

        $this->assertSame(1, $progress->stageCounts()['generate'][ConceptPipelineNode::STATUS_FAILED]);
        $this->assertSame(1, $progress->stageCounts()['generate'][ConceptPipelineNode::STATUS_SKIPPED]);
        $this->assertSame(0, $progress->stageCounts()['generate'][ConceptPipelineNode::STATUS_PENDING]);
        $this->assertSame(1, $progress->stageCounts()['localize'][ConceptPipelineNode::STATUS_SKIPPED]);
        $this->assertSame(1, $progress->stageCounts()['localize'][ConceptPipelineNode::STATUS_PROCESSING]);
        $this->assertSame(1, $progress->stageCounts()['complete_info'][ConceptPipelineNode::STATUS_SKIPPED]);
        $this->assertSame(1, $progress->stageCounts()['complete_info'][ConceptPipelineNode::STATUS_PENDING]);

        $byDepth = $progress->nodesByDepth();
        $this->assertSame(['origami'], array_column($byDepth[0], 'name'));
        $this->assertSame(['harbor'], array_column($byDepth[1], 'name'));
        $this->assertArrayNotHasKey(2, $byDepth);
        $this->assertArrayNotHasKey(3, $byDepth);

        $failures = $progress->failures();
        $this->assertCount(1, $failures);
        $this->assertSame('origami', $failures[0]['name']);
        $this->assertSame(ConceptPipelineNode::STAGE_GENERATE, $failures[0]['stage']);
        $this->assertSame('LLM exploded', $failures[0]['error']);
        $this->assertTrue($progress->isActive());
        $this->assertSame('5s', $progress->pollingInterval());
    }

    public function test_progress_bar_and_eta_use_finished_node_durations(): void
    {
        $run = $this->makePipelineRun();
        $this->makeNode($run, [
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'generate_started_at' => now()->subSeconds(40),
            'generate_finished_at' => now()->subSeconds(30),
            'localize_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'localize_started_at' => now()->subSeconds(30),
            'localize_finished_at' => now()->subSeconds(20),
            'complete_info_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'complete_info_started_at' => now()->subSeconds(20),
            'complete_info_finished_at' => now()->subSeconds(10),
        ]);
        $this->makeNode($run, [
            'canonical_key' => 'harbor',
            'seed_term' => 'harbor',
            'depth' => 1,
            'generate_status' => ConceptPipelineNode::STATUS_PENDING,
            'localize_status' => ConceptPipelineNode::STATUS_PENDING,
            'complete_info_status' => ConceptPipelineNode::STATUS_PENDING,
        ]);

        $progress = ConceptPipelineProgress::for($run->fresh());

        $this->assertSame(3, $progress->completedStageCount());
        $this->assertSame(6, $progress->totalStageCount());
        $this->assertSame(50.0, $progress->percent());
        $this->assertSame(30, $progress->averageFinishedNodeDurationSeconds());
        $this->assertSame(30, $progress->estimatedRemainingSeconds());
        $this->assertTrue($progress->isActive());
    }

    public function test_finished_run_stops_polling_and_has_no_eta(): void
    {
        $run = $this->makePipelineRun();
        $this->makeNode($run, [
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'generate_started_at' => now()->subSeconds(20),
            'generate_finished_at' => now()->subSeconds(10),
            'localize_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'localize_started_at' => now()->subSeconds(10),
            'localize_finished_at' => now()->subSeconds(5),
            'complete_info_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'complete_info_started_at' => now()->subSeconds(5),
            'complete_info_finished_at' => now()->subSeconds(1),
        ]);

        $progress = ConceptPipelineProgress::for($run->fresh());

        $this->assertFalse($progress->isActive());
        $this->assertNull($progress->pollingInterval());
        $this->assertSame(100.0, $progress->percent());
        $this->assertNull($progress->estimatedRemainingSeconds());
    }

    protected function makePipelineRun(): ConceptGraphRun
    {
        return ConceptGraphRun::query()->create([
            'run_uuid' => (string) Str::uuid(),
            'type' => ConceptGraphRun::TYPE_PIPELINE,
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
