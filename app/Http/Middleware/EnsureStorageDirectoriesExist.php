<?php

namespace App\Http\Middleware;

use App\Support\EnsureApplicationStorage;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStorageDirectoriesExist
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        EnsureApplicationStorage::bootstrap();

        return $next($request);
    }
}
