<?php

use App\Http\Middleware\EnsureStorageDirectoriesExist;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // CORS middleware is automatically applied via fruitcake/php-cors
        // Configuration is in config/cors.php
        $middleware->append(EnsureStorageDirectoriesExist::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(function ($request, \Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });

        // Mirror reportable exceptions to PHP's error_log so PHP-FPM/docker
        // logs capture Filament 500s even when storage/logs is not writable.
        $exceptions->reportable(function (\Throwable $e): void {
            error_log('[laravel] '.$e);
        });
    })->create();
