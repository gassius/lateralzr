<?php

use App\Http\Controllers\Api\ConceptRelationshipController;
use App\Http\Controllers\Api\RemoteMediaController;
use Illuminate\Support\Facades\Route;

Route::get('/hello', function () {
    return response()->json([
        'message' => 'Hello, Lateralzr API is running!',
        'status' => 'ok',
    ]);
});

Route::post('/concepts/relationships', [ConceptRelationshipController::class, 'generate']);

Route::get('/media', [RemoteMediaController::class, 'show'])
    ->middleware('throttle:180,1')
    ->name('media.show');
