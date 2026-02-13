<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\MaskController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\CsvMaskController;
use App\Http\Controllers\Api\TemplateController;
use App\Http\Controllers\Api\CustomFieldController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\LineWebhookController;

// === 公開路由 ===
Route::post('/login', [AuthController::class, 'login']);
Route::post('/repair-tickets', [TicketController::class, 'store']); // 公開報修建票
Route::post('/line/webhook', [LineWebhookController::class, 'webhook']); // LINE Webhook

// === 需要登入的路由 ===
Route::middleware('auth:sanctum')->group(function () {

    // 認證
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // 使用者管理
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/workers', [UserController::class, 'workers']);
    Route::post('/users', [UserController::class, 'store']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // 遮罩 API
    Route::post('/mask', [MaskController::class, 'mask']);
    Route::post('/mask-ai', [MaskController::class, 'maskWithAi']);

    // CSV 遮罩 API
    Route::post('/csv/preview', [CsvMaskController::class, 'preview']);
    Route::post('/csv/mask', [CsvMaskController::class, 'mask']);
    Route::get('/csv/download/{filename}', [CsvMaskController::class, 'download']);

    // 範本 API
    Route::get('/templates', [TemplateController::class, 'index']);
    Route::post('/templates', [TemplateController::class, 'store']);
    Route::put('/templates/{id}', [TemplateController::class, 'update']);
    Route::delete('/templates/{id}', [TemplateController::class, 'destroy']);

    // 自訂遮罩欄位 API
    Route::get('/custom-fields', [CustomFieldController::class, 'index']);
    Route::post('/custom-fields', [CustomFieldController::class, 'store']);
    Route::delete('/custom-fields/{id}', [CustomFieldController::class, 'destroy']);

    // === 工單 API ===
    Route::get('/tickets', [TicketController::class, 'index']);
    Route::post('/tickets', [TicketController::class, 'store']);
    Route::get('/tickets/{id}', [TicketController::class, 'show']);
    Route::patch('/tickets/{id}', [TicketController::class, 'update']);
    Route::patch('/tickets/{id}/status', [TicketController::class, 'updateStatus']);
    Route::post('/tickets/{id}/comments', [TicketController::class, 'addComment']);
    Route::post('/tickets/{id}/dispatch', [TicketController::class, 'dispatch']);
    Route::post('/tickets/{id}/attachments', [TicketController::class, 'uploadAttachment']);

    // LINE 綁定
    Route::patch('/users/{id}/line', [LineWebhookController::class, 'bindLineUser']);
});