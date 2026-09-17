<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminPanelAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::create(['name' => 'super_admin', 'guard_name' => 'web']);
    }

    public function test_unauthenticated_user_redirected_to_login(): void
    {
        $response = $this->get('/admin');

        $response->assertRedirect();
        $this->assertStringContainsString('/admin/login', $response->headers->get('Location'));
    }

    public function test_guest_can_render_filament_login_page(): void
    {
        $response = $this->get('/admin/login');

        $response->assertOk();
        $response->assertSee('Email', false);
    }

    public function test_login_page_renders_when_view_cache_directory_is_missing(): void
    {
        $views = storage_path('framework/views');
        File::deleteDirectory($views);
        $this->assertDirectoryDoesNotExist($views);

        $response = $this->get('/admin/login');

        $response->assertOk();
        $this->assertDirectoryExists($views);
    }

    public function test_authenticated_user_without_super_admin_role_cannot_access_panel(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get('/admin');

        $response->assertStatus(403);
    }

    public function test_authenticated_super_admin_can_access_panel(): void
    {
        $user = User::factory()->create();
        $user->assignRole('super_admin');

        $response = $this->actingAs($user)->get('/admin');

        $response->assertSuccessful();
    }

    public function test_authenticated_super_admin_can_access_concept_graph_explorer(): void
    {
        $user = User::factory()->create();
        $user->assignRole('super_admin');

        $response = $this->actingAs($user)->get('/admin/concept-graph-explorer');

        $response->assertSuccessful();
    }
}
