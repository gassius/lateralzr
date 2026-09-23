<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithFilamentAdmin;
use Tests\TestCase;

class FilamentConceptGraphExplorerTest extends TestCase
{
    use InteractsWithFilamentAdmin;
    use RefreshDatabase;

    public function test_concept_graph_explorer_uses_readable_node_labels(): void
    {
        $this->actingAsAdmin();

        $response = $this->get('/admin/concept-graph-explorer');

        $response->assertSuccessful();
        $response->assertSee("'font-size': 16", false);
        $response->assertSee("'font-weight': 700", false);
        $response->assertSee("'text-background-color': '#fffbeb'", false);
        $response->assertSee("'min-zoomed-font-size': 10", false);
    }
}
