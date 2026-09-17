<?php

namespace Tests\Feature;

use App\Filament\Resources\Users\Pages\CreateUser;
use App\Filament\Resources\Users\Pages\EditUser;
use App\Models\User;
use App\Support\SuperAdminRole;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class FilamentUserResourceRolesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        SuperAdminRole::ensureExists();
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    public function test_creating_a_user_with_super_admin_role_grants_panel_access(): void
    {
        $actor = User::factory()->create();
        $actor->assignRole(SuperAdminRole::NAME);

        $this->actingAs($actor);

        Livewire::test(CreateUser::class)
            ->fillForm([
                'name' => 'Panel User',
                'email' => 'panel-user@example.com',
                'password' => 'password',
                'roles' => [SuperAdminRole::ensureExists()->getKey()],
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $created = User::query()->where('email', 'panel-user@example.com')->first();

        $this->assertNotNull($created);
        $this->assertTrue($created->hasRole(SuperAdminRole::NAME));
        $this->assertTrue($created->canAccessPanel(Filament::getPanel('admin')));
    }

    public function test_creating_a_user_without_roles_does_not_grant_panel_access(): void
    {
        $actor = User::factory()->create();
        $actor->assignRole(SuperAdminRole::NAME);

        $this->actingAs($actor);

        Livewire::test(CreateUser::class)
            ->fillForm([
                'name' => 'Plain User',
                'email' => 'plain-user@example.com',
                'password' => 'password',
                'roles' => [],
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $created = User::query()->where('email', 'plain-user@example.com')->first();

        $this->assertNotNull($created);
        $this->assertFalse($created->hasRole(SuperAdminRole::NAME));
        $this->assertFalse($created->canAccessPanel(Filament::getPanel('admin')));
    }

    public function test_editing_a_user_can_assign_super_admin_role(): void
    {
        $actor = User::factory()->create();
        $actor->assignRole(SuperAdminRole::NAME);

        $target = User::factory()->create([
            'email' => 'locked-out@example.com',
        ]);

        $this->assertFalse($target->canAccessPanel(Filament::getPanel('admin')));

        $this->actingAs($actor);

        Livewire::test(EditUser::class, ['record' => $target->getKey()])
            ->fillForm([
                'name' => $target->name,
                'email' => $target->email,
                'roles' => [SuperAdminRole::ensureExists()->getKey()],
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $target->refresh();

        $this->assertTrue($target->hasRole(SuperAdminRole::NAME));
        $this->assertTrue($target->canAccessPanel(Filament::getPanel('admin')));
    }
}
