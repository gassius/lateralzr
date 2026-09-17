<?php

namespace App\Console\Commands;

use App\Actions\EnsureFilamentAdminUser;
use Illuminate\Console\Command;
use InvalidArgumentException;

class PromoteFilamentAdmin extends Command
{
    protected $signature = 'users:promote-filament-admin
        {email : Email of the existing user to grant super_admin}';

    protected $description = 'Grant the super_admin role to an existing user so they can sign in to Filament. Does not change the password.';

    public function handle(EnsureFilamentAdminUser $ensureFilamentAdminUser): int
    {
        $email = (string) $this->argument('email');

        try {
            $user = $ensureFilamentAdminUser->promote($email);
        } catch (InvalidArgumentException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info("User [{$user->email}] now has role super_admin.");

        return self::SUCCESS;
    }
}
