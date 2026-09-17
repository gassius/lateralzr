<?php

namespace App\Console\Commands;

use App\Actions\EnsureFilamentAdminUser;
use Illuminate\Console\Command;
use InvalidArgumentException;

class CreateFilamentAdmin extends Command
{
    protected $signature = 'users:create-filament-admin
        {email : Email address for the Filament admin}
        {--name= : Display name (defaults to the email local-part on create)}
        {--password= : Password (hashed on save). Prompted if omitted.}';

    protected $description = 'Create or update a Filament admin with the super_admin role. Prefer this over make:filament-user, which does not assign the role.';

    public function handle(EnsureFilamentAdminUser $ensureFilamentAdminUser): int
    {
        $email = (string) $this->argument('email');
        $name = $this->option('name');
        $name = is_string($name) && $name !== '' ? $name : null;

        $password = $this->option('password');
        if (! is_string($password) || $password === '') {
            $password = (string) $this->secret('Password');
        }

        try {
            $user = $ensureFilamentAdminUser->createOrUpdate($email, $password, $name);
        } catch (InvalidArgumentException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info("Filament admin [{$user->email}] is ready with role super_admin.");

        return self::SUCCESS;
    }
}
