<?php

namespace App\Providers;

use App\Listeners\LogAiRequests;
use App\Support\EnsureApplicationStorage;
use App\Support\SuperAdminRole;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Laravel\Ai\Events\AgentPrompted;
use Laravel\Ai\Events\PromptingAgent;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        EnsureApplicationStorage::bootstrap($this->app->storagePath());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        // Super admins bypass all permission checks
        Gate::before(function ($user, $ability) {
            if ($user && method_exists($user, 'hasRole') && $user->hasRole(SuperAdminRole::NAME)) {
                return true;
            }

            return null;
        });

        Event::listen([PromptingAgent::class, AgentPrompted::class], LogAiRequests::class);
    }
}
