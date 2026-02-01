<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\MaskController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
Route::post('/mask', [MaskController::class, 'mask']);
Route::post('/mask-ai', [MaskController::class, 'maskWithAi']);