<?php

namespace Tests\Feature;

use App\Filament\Resources\ConceptGraphRuns\Pages\ListConceptGraphRuns;
use App\Models\ConceptGraphRun;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
