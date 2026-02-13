<?php

use App\Http\Controllers\Api\ConceptRelationshipController;
use Illuminate\Support\Facades\Route;

Route::get('/hello', function () {
    return response()->json([
        'message' => 'Hello, Lateralzr API is running!',
        'status' => 'ok',
    ]);
});

Route::post('/concepts/relationships', [ConceptRelationshipController::class, 'generate']);
