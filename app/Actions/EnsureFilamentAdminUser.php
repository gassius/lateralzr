<?php

namespace App\Actions;

use App\Models\User;
use App\Support\SuperAdminRole;
use InvalidArgumentException;

class EnsureFilamentAdminUser
{
    /**
     * Create or update a user, hash the password (via the User cast), and assign super_admin.
     */
    public function createOrUpdate(string $email, string $password, ?string $name = null): User
    {
        $email = $this->normalizeEmail($email);

        if ($password === '') {
            throw new InvalidArgumentException('A password is required.');
        }

        SuperAdminRole::ensureExists();

        $user = User::query()->firstOrNew(['email' => $email]);
        $user->password = $password;

        if (filled($name)) {
            $user->name = $name;
        } elseif (! $user->exists) {
            $user->name = $this->defaultNameFromEmail($email);
        }

        $user->save();
        $user->assignRole(SuperAdminRole::NAME);

        return $user->fresh(['roles']);
    }

    /**
     * Grant super_admin to an existing user without changing their password.
     */
    public function promote(string $email): User
    {
        $email = $this->normalizeEmail($email);

        SuperAdminRole::ensureExists();

        $user = User::query()->where('email', $email)->first();

        if ($user === null) {
            throw new InvalidArgumentException("No user found with email [{$email}]. Create one with users:create-filament-admin.");
        }

        $user->assignRole(SuperAdminRole::NAME);

        return $user->fresh(['roles']);
    }

    private function normalizeEmail(string $email): string
    {
        $email = strtolower(trim($email));

        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException("Invalid email address [{$email}].");
        }

        return $email;
    }

    private function defaultNameFromEmail(string $email): string
    {
        $local = strstr($email, '@', true);

        return is_string($local) && $local !== '' ? $local : $email;
    }
}
