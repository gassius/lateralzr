<?php

namespace App\Providers;

use App\Listeners\LogOllamaRequests;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
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
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Super admins bypass all permission checks
        Gate::before(function ($user, $ability) {
            if ($user && method_exists($user, 'hasRole') && $user->hasRole('super_admin')) {
                return true;
            }

            return null;
        });

        // Register Ollama request/response logging listener when debug is enabled
        if (config('app.debug')) {
            Event::listen([PromptingAgent::class, AgentPrompted::class], LogOllamaRequests::class);
        }
    }
}
