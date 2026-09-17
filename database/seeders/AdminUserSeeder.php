<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\SuperAdminRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Create or update the local admin user (test@lateralzr.com).
     * Only runs in local environment.
     */
    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        $user = User::query()->updateOrCreate(
            ['email' => 'test@lateralzr.com'],
            [
                'name' => 'Admin (Local)',
                'password' => Hash::make('!12345678'),
            ]
        );

        SuperAdminRole::ensureExists();

        if (! $user->hasRole(SuperAdminRole::NAME)) {
            $user->assignRole(SuperAdminRole::NAME);
        }
    }
}
