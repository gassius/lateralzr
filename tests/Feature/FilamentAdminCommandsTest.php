<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\SuperAdminRole;
use Database\Seeders\RoleSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class FilamentAdminCommandsTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_command_creates_super_admin_role_user_and_hashed_password(): void
    {
        $this->assertSame(0, Role::query()->count());

        $this->artisan('users:create-filament-admin', [
            'email' => 'admin@example.com',
            '--name' => 'Prod Admin',
            '--password' => 'secret-password',
        ])->assertSuccessful();

        $user = User::query()->where('email', 'admin@example.com')->first();

        $this->assertNotNull($user);
        $this->assertSame('Prod Admin', $user->name);
        $this->assertTrue($user->hasRole(SuperAdminRole::NAME));
        $this->assertTrue($user->canAccessPanel(Filament::getPanel('admin')));
        $this->assertTrue(Hash::check('secret-password', $user->password));
        $this->assertTrue(
            Role::query()
                ->where('name', SuperAdminRole::NAME)
                ->where('guard_name', SuperAdminRole::GUARD_NAME)
                ->exists()
        );
    }

    public function test_create_command_updates_existing_user_password_and_assigns_role(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@example.com',
            'name' => 'Existing',
            'password' => 'old-password',
        ]);

        $this->assertFalse($user->canAccessPanel(Filament::getPanel('admin')));

        $this->artisan('users:create-filament-admin', [
            'email' => 'admin@example.com',
            '--password' => 'new-password',
        ])->assertSuccessful();

        $user->refresh();

        $this->assertSame('Existing', $user->name);
        $this->assertTrue($user->hasRole(SuperAdminRole::NAME));
        $this->assertTrue($user->canAccessPanel(Filament::getPanel('admin')));
        $this->assertTrue(Hash::check('new-password', $user->password));
    }

    public function test_create_command_rejects_invalid_email(): void
    {
        $this->artisan('users:create-filament-admin', [
            'email' => 'not-an-email',
            '--password' => 'secret',
        ])->assertFailed();

        $this->assertSame(0, User::query()->count());
    }

    public function test_promote_command_assigns_super_admin_without_changing_password(): void
    {
        $user = User::factory()->create([
            'email' => 'cgonzalezr@gmail.com',
            'password' => 'unchanged',
        ]);

        $this->assertFalse($user->hasRole(SuperAdminRole::NAME));
        $this->assertSame(0, Role::query()->count());

        $this->artisan('users:promote-filament-admin', [
            'email' => 'cgonzalezr@gmail.com',
        ])->assertSuccessful();

        $user->refresh();

        $this->assertTrue($user->hasRole(SuperAdminRole::NAME));
        $this->assertTrue($user->canAccessPanel(Filament::getPanel('admin')));
        $this->assertTrue(Hash::check('unchanged', $user->password));
        $this->assertTrue(
            Role::query()
                ->where('name', SuperAdminRole::NAME)
                ->where('guard_name', SuperAdminRole::GUARD_NAME)
                ->exists()
        );
    }

    public function test_promote_command_fails_when_user_does_not_exist(): void
    {
        $this->artisan('users:promote-filament-admin', [
            'email' => 'missing@example.com',
        ])->assertFailed();
    }

    public function test_role_seeder_is_idempotent_source_of_truth_for_super_admin(): void
    {
        $this->seed(RoleSeeder::class);
        $this->seed(RoleSeeder::class);

        $this->assertSame(1, Role::query()->where('name', SuperAdminRole::NAME)->where('guard_name', SuperAdminRole::GUARD_NAME)->count());
    }
}
