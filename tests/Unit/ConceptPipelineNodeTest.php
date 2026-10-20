<?php

namespace Tests\Unit;

use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ConceptPipelineNodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_mark_stage_records_status_and_timestamps(): void
    {
        $run = ConceptGraphRun::query()->create([
            'run_uuid' => (string) Str::uuid(),
            'type' => ConceptGraphRun::TYPE_PIPELINE,
            'complexity' => 3,
            'queue' => 'default',
            'seed_count' => 1,
            'seeds' => ['starts' => ['origami'], 'depth' => 1, 'count' => 10],
            'dispatched_at' => now(),
        ]);

        $node = ConceptPipelineNode::query()->create([
            'run_uuid' => $run->run_uuid,
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
        ]);

        $node->markStage(ConceptPipelineNode::STAGE_GENERATE, ConceptPipelineNode::STATUS_PROCESSING);
        $node->refresh();
        $this->assertSame(ConceptPipelineNode::STATUS_PROCESSING, $node->generate_status);
        $this->assertNotNull($node->generate_started_at);

        $node->markStage(ConceptPipelineNode::STAGE_GENERATE, ConceptPipelineNode::STATUS_FAILED, 'boom');
        $node->skipPendingStages();
        $node->refresh();

        $this->assertSame(ConceptPipelineNode::STATUS_FAILED, $node->generate_status);
        $this->assertSame('boom', $node->generate_error);
        $this->assertSame(ConceptPipelineNode::STATUS_SKIPPED, $node->localize_status);
        $this->assertSame(ConceptPipelineNode::STATUS_SKIPPED, $node->complete_info_status);
    }
}
