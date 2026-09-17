<?php

namespace Database\Seeders;

use App\Support\SuperAdminRole;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Create the super_admin role (and any other default roles).
     */
    public function run(): void
    {
        SuperAdminRole::ensureExists();
    }
}
