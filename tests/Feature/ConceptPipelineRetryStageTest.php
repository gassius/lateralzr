<?php

namespace Tests\Feature;

use App\Jobs\CompleteInfoPipelineNodeJob;
use App\Jobs\GeneratePipelineNodeJob;
use App\Jobs\LocalizePipelineNodeJob;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use App\Services\ConceptPipeline\ConceptPipelineDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Tests\TestCase;

class ConceptPipelineRetryStageTest extends TestCase
{
    use RefreshDatabase;

    public function test_retry_generate_resets_skipped_later_stages_and_requeues_the_chain(): void
    {
        Bus::fake();

        $run = $this->makePipelineRun();
        $node = ConceptPipelineNode::query()->create([
            'run_uuid' => $run->run_uuid,
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_FAILED,
            'generate_error' => 'LLM exploded',
            'generate_started_at' => now()->subMinute(),
            'generate_finished_at' => now()->subSeconds(30),
            'localize_status' => ConceptPipelineNode::STATUS_SKIPPED,
            'localize_error' => 'Skipped because an earlier pipeline stage failed.',
            'complete_info_status' => ConceptPipelineNode::STATUS_SKIPPED,
            'complete_info_error' => 'Skipped because an earlier pipeline stage failed.',
        ]);

        app(ConceptPipelineDispatchService::class)->retryStage($node, ConceptPipelineNode::STAGE_GENERATE);

        $node->refresh();
        $this->assertSame(ConceptPipelineNode::STATUS_PENDING, $node->generate_status);
        $this->assertNull($node->generate_error);
        $this->assertNull($node->generate_started_at);
        $this->assertNull($node->generate_finished_at);
        $this->assertSame(ConceptPipelineNode::STATUS_PENDING, $node->localize_status);
        $this->assertSame(ConceptPipelineNode::STATUS_PENDING, $node->complete_info_status);

        Bus::assertChained([
            GeneratePipelineNodeJob::class,
            LocalizePipelineNodeJob::class,
            CompleteInfoPipelineNodeJob::class,
        ]);
    }

    public function test_retry_localize_does_not_requeue_succeeded_generate(): void
    {
        Bus::fake();

        $run = $this->makePipelineRun();
        $node = ConceptPipelineNode::query()->create([
            'run_uuid' => $run->run_uuid,
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'localize_status' => ConceptPipelineNode::STATUS_FAILED,
            'localize_error' => 'translate failed',
            'complete_info_status' => ConceptPipelineNode::STATUS_SKIPPED,
        ]);

        app(ConceptPipelineDispatchService::class)->retryStage($node, ConceptPipelineNode::STAGE_LOCALIZE);

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

    public function test_retry_complete_info_requeues_only_that_stage(): void
    {
        Bus::fake();

        $run = $this->makePipelineRun();
        $node = ConceptPipelineNode::query()->create([
            'run_uuid' => $run->run_uuid,
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'localize_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'complete_info_status' => ConceptPipelineNode::STATUS_FAILED,
            'complete_info_error' => 'wiki down',
        ]);

        app(ConceptPipelineDispatchService::class)->retryStage($node, ConceptPipelineNode::STAGE_COMPLETE_INFO);

        $node->refresh();
        $this->assertSame(ConceptPipelineNode::STATUS_SUCCEEDED, $node->generate_status);
        $this->assertSame(ConceptPipelineNode::STATUS_SUCCEEDED, $node->localize_status);
        $this->assertSame(ConceptPipelineNode::STATUS_PENDING, $node->complete_info_status);

        Bus::assertChained([
            CompleteInfoPipelineNodeJob::class,
        ]);
        Bus::assertNotDispatched(GeneratePipelineNodeJob::class);
        Bus::assertNotDispatched(LocalizePipelineNodeJob::class);
    }

    public function test_retry_rejects_a_stage_that_is_not_failed(): void
    {
        Bus::fake();

        $run = $this->makePipelineRun();
        $node = ConceptPipelineNode::query()->create([
            'run_uuid' => $run->run_uuid,
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_SUCCEEDED,
            'localize_status' => ConceptPipelineNode::STATUS_PENDING,
            'complete_info_status' => ConceptPipelineNode::STATUS_PENDING,
        ]);

        $this->expectException(InvalidArgumentException::class);
        app(ConceptPipelineDispatchService::class)->retryStage($node, ConceptPipelineNode::STAGE_GENERATE);
    }

    public function test_retry_twice_with_a_stale_node_dispatches_exactly_one_chain(): void
    {
        Bus::fake();

        $run = $this->makePipelineRun();
        $node = ConceptPipelineNode::query()->create([
            'run_uuid' => $run->run_uuid,
            'canonical_key' => 'origami',
            'seed_term' => 'origami',
            'depth' => 0,
            'generate_status' => ConceptPipelineNode::STATUS_FAILED,
            'generate_error' => 'LLM exploded',
            'localize_status' => ConceptPipelineNode::STATUS_SKIPPED,
            'complete_info_status' => ConceptPipelineNode::STATUS_SKIPPED,
        ]);

        $stale = $node->fresh();

        app(ConceptPipelineDispatchService::class)->retryStage($node, ConceptPipelineNode::STAGE_GENERATE);

        try {
            app(ConceptPipelineDispatchService::class)->retryStage($stale, ConceptPipelineNode::STAGE_GENERATE);
            $this->fail('Expected a stale retry to be rejected.');
        } catch (InvalidArgumentException) {
        }

        Bus::assertDispatchedTimes(GeneratePipelineNodeJob::class, 1);
        Bus::assertChained([
            GeneratePipelineNodeJob::class,
            LocalizePipelineNodeJob::class,
            CompleteInfoPipelineNodeJob::class,
        ]);
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
}
