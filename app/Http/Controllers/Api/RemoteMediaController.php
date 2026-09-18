<?php

namespace App\Http\Controllers\Api;

use App\Services\RemoteMediaProxy;
use App\Services\RemoteMediaProxyException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use InvalidArgumentException;

class RemoteMediaController
{
    public function __construct(
        protected RemoteMediaProxy $proxy
    ) {}

    /**
     * Stream an allowlisted remote image so web clients are not subject to Wikimedia CORS.
     */
    public function show(Request $request): Response|JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'max:2048'],
        ]);

        try {
            $media = $this->proxy->fetch($validated['url']);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'status' => 'error',
            ], 422);
        } catch (RemoteMediaProxyException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'status' => 'error',
            ], $e->status);
        }

        $maxAge = (int) config('media.cache_max_age', 86400);

        return response($media['body'], 200, [
            'Content-Type' => $media['contentType'],
            'Cache-Control' => 'public, max-age='.$maxAge,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
