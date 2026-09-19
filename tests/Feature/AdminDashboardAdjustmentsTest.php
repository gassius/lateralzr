<?php

namespace Tests\Feature;

use App\Filament\Resources\Users\UserResource;
use App\Filament\Widgets\AdminStatsOverview;
use App\Models\Concept;
use App\Models\ConceptGraphRunJob;
use App\Models\ConceptRelationship;
use App\Models\User;
use App\Support\SuperAdminRole;
use Filament\Facades\Filament;
use Filament\Widgets\FilamentInfoWidget;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class AdminDashboardAdjustmentsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        SuperAdminRole::ensureExists();
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    public function test_admin_panel_brand_name_and_widgets_are_configured(): void
    {
        $panel = Filament::getPanel('admin');

        $this->assertSame('Lateralzr Admin', $panel->getBrandName());
        $this->assertContains(AdminStatsOverview::class, $panel->getWidgets());
        $this->assertNotContains(FilamentInfoWidget::class, $panel->getWidgets());
    }

    public function test_users_resource_uses_dashboard_users_labels(): void
    {
        $this->assertSame('Dashboard Users', UserResource::getNavigationLabel());
        $this->assertSame('Dashboard User', UserResource::getModelLabel());
        $this->assertSame('Dashboard Users', UserResource::getPluralModelLabel());
    }

    public function test_admin_dashboard_shows_stats_and_hides_filament_docs_box(): void
    {
        $user = User::factory()->create();
        $user->assignRole(SuperAdminRole::NAME);

        $from = Concept::query()->create(['canonical_key' => 'alpha']);
        $to = Concept::query()->create(['canonical_key' => 'beta']);

        ConceptRelationship::query()->create([
            'from_concept_id' => $from->id,
            'to_concept_id' => $to->id,
            'strength' => 0.5,
        ]);

        ConceptGraphRunJob::query()->create([
            'run_uuid' => '11111111-1111-1111-1111-111111111111',
            'seed' => 'pending-seed',
            'status' => 'pending',
        ]);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => '11111111-1111-1111-1111-111111111111',
            'seed' => 'processing-seed',
            'status' => 'processing',
            'started_at' => now(),
        ]);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => '11111111-1111-1111-1111-111111111111',
            'seed' => 'failed-recent',
            'status' => 'failed',
            'finished_at' => now()->subHour(),
            'error_message' => 'boom',
        ]);
        ConceptGraphRunJob::query()->create([
            'run_uuid' => '11111111-1111-1111-1111-111111111111',
            'seed' => 'failed-old',
            'status' => 'failed',
            'finished_at' => now()->subDays(2),
            'updated_at' => now()->subDays(2),
            'error_message' => 'old',
        ]);

        $response = $this->actingAs($user)->get('/admin');

        $response->assertSuccessful();
        $response->assertSee('Lateralzr Admin', false);
        $response->assertDontSee('filamentphp.com', false);
        $response->assertDontSee('Filament Documentation', false);

        Livewire::actingAs($user)
            ->test(AdminStatsOverview::class)
            ->assertSee('Concepts')
            ->assertSee('Concept Relationships')
            ->assertSee('Pending workers')
            ->assertSee('Processing workers')
            ->assertSee('Workers with errors (24h)');
    }
}
