<?php

namespace App\Support;

use Spatie\Permission\Models\Role;

/**
 * Canonical super_admin role used for Filament panel access.
 *
 * RoleSeeder remains the seeder source of truth; artisan commands call
 * the same firstOrCreate so production does not depend on db:seed.
 */
class SuperAdminRole
{
    public const NAME = 'super_admin';

    public const GUARD_NAME = 'web';

    public static function ensureExists(): Role
    {
        return Role::firstOrCreate(
            ['name' => self::NAME, 'guard_name' => self::GUARD_NAME],
            ['name' => self::NAME, 'guard_name' => self::GUARD_NAME]
        );
    }
}
