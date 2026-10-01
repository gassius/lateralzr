<?php

namespace Tests\Unit;

use App\Models\ConceptGraphRunJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConceptGraphRunJobMarkTest extends TestCase
{
    use RefreshDatabase;

    public function test_mark_is_noop_when_run_uuid_or_seed_is_missing(): void
    {
        $job = ConceptGraphRunJob::query()->create([
            'run_uuid' => '11111111-1111-1111-1111-111111111111',
            'seed' => 'creativity',
            'status' => 'pending',
            'attempts' => 0,
        ]);

        $values = ['status' => 'processing', 'attempts' => 1];

        ConceptGraphRunJob::mark(null, 'creativity', $values);
        ConceptGraphRunJob::mark('', 'creativity', $values);
        ConceptGraphRunJob::mark('11111111-1111-1111-1111-111111111111', null, $values);
        ConceptGraphRunJob::mark('11111111-1111-1111-1111-111111111111', '', $values);

        $job->refresh();

        $this->assertSame('pending', $job->status);
        $this->assertSame(0, $job->attempts);
    }

    public function test_mark_updates_the_matching_row(): void
    {
        $job = ConceptGraphRunJob::query()->create([
            'run_uuid' => '11111111-1111-1111-1111-111111111111',
            'seed' => 'creativity',
            'status' => 'pending',
            'attempts' => 0,
        ]);
        $other = ConceptGraphRunJob::query()->create([
            'run_uuid' => '11111111-1111-1111-1111-111111111111',
            'seed' => 'silence',
            'status' => 'pending',
            'attempts' => 0,
        ]);

        ConceptGraphRunJob::mark('11111111-1111-1111-1111-111111111111', 'creativity', [
            'status' => 'succeeded',
            'attempts' => 1,
        ]);

        $this->assertSame('succeeded', $job->fresh()?->status);
        $this->assertSame(1, $job->fresh()?->attempts);
        $this->assertSame('pending', $other->fresh()?->status);
        $this->assertSame(0, $other->fresh()?->attempts);
    }
}
