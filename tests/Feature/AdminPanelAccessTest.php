<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\SuperAdminRole;
use Filament\Auth\Pages\Login;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Livewire\Livewire;
use Tests\TestCase;

class AdminPanelAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        SuperAdminRole::ensureExists();
        Filament::setCurrentPanel(Filament::getPanel('admin'));
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

        $this->assertFalse($user->canAccessPanel(Filament::getPanel('admin')));

        $response = $this->actingAs($user)->get('/admin');

        $response->assertStatus(403);
    }

    public function test_authenticated_super_admin_can_access_panel(): void
    {
        $user = User::factory()->create();
        $user->assignRole(SuperAdminRole::NAME);

        $this->assertTrue($user->canAccessPanel(Filament::getPanel('admin')));

        $response = $this->actingAs($user)->get('/admin');

        $response->assertSuccessful();
    }

    public function test_authenticated_super_admin_can_access_concept_graph_explorer(): void
    {
        $user = User::factory()->create();
        $user->assignRole(SuperAdminRole::NAME);

        $response = $this->actingAs($user)->get('/admin/concept-graph-explorer');

        $response->assertSuccessful();
    }

    public function test_login_fails_when_user_has_no_super_admin_role(): void
    {
        $user = User::factory()->create([
            'password' => 'password',
        ]);

        Livewire::test(Login::class)
            ->fillForm([
                'email' => $user->email,
                'password' => 'password',
            ])
            ->call('authenticate')
            ->assertHasFormErrors(['email']);

        $this->assertGuest();
    }

    public function test_login_succeeds_when_user_has_super_admin_role(): void
    {
        $user = User::factory()->create([
            'password' => 'password',
        ]);
        $user->assignRole(SuperAdminRole::NAME);

        Livewire::test(Login::class)
            ->fillForm([
                'email' => $user->email,
                'password' => 'password',
            ])
            ->call('authenticate')
            ->assertHasNoFormErrors()
            ->assertRedirect();

        $this->assertAuthenticatedAs($user);
    }
}
