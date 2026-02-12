<?php

use Illuminate\Support\Facades\Route;

Route::get('/hello', function () {
    return response()->json([
        'message' => 'Hello, Lateralzr API is running!',
        'status' => 'ok',
    ]);
});
