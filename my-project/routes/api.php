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
use App\Http\Controllers\Api\LineCustomerController;

// === 公開路由 ===
Route::post('/login', [AuthController::class, 'login']);

// 公開路由：加入速率限制防止濫用
Route::middleware('throttle:30,1')->group(function () {
    Route::get('/tickets/track', [TicketController::class, 'trackByPhone']); // 公開追蹤
    Route::get('/tickets/track-by-line', [TicketController::class, 'trackByLineId']); // LINE ID 追蹤
    Route::get('/tickets/track/{id}', [TicketController::class, 'trackDetail']); // 公開詳情（遮罩版）
    Route::get('/attachments/{id}/image', [TicketController::class, 'serveAttachment']); // 附件圖片
});
Route::middleware('throttle:10,1')->group(function () {
    Route::post('/repair-tickets', [TicketController::class, 'store']); // 公開報修建票
    Route::post('/tickets/track/{id}/confirm-quote', [TicketController::class, 'confirmQuote']); // 客戶確認報價
    Route::post('/tickets/track/{id}/supplement', [TicketController::class, 'supplementTicket']); // 客戶補件（含照片）
    Route::post('/tickets/track/{id}/confirm-time', [TicketController::class, 'confirmTimeSlot']); // 客戶確認時段（舊版）
    Route::post('/tickets/track/{id}/customer-confirm-slot', [TicketController::class, 'customerConfirmSlot']); // 客戶確認師傅選的時段
    Route::post('/tickets/track/{id}/reschedule', [TicketController::class, 'customerReschedule']); // 客戶改期
    Route::post('/tickets/track/{id}/cancel', [TicketController::class, 'customerCancelTicket']); // 客戶取消
});
Route::post('/line/webhook', [LineWebhookController::class, 'webhook']); // LINE Webhook
Route::post('/line-customers/register', [LineCustomerController::class, 'register']); // LIFF 客戶註冊

// === 需要登入的路由 ===
Route::middleware('auth:sanctum')->group(function () {

    // 認證
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // 使用者管理
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/workers', [UserController::class, 'workers']);
    Route::post('/users', [UserController::class, 'store']);
    Route::patch('/users/{id}/password', [UserController::class, 'updatePassword']);
    Route::patch('/users/{id}/phone', [UserController::class, 'updatePhone']);
    Route::delete('/users/{id}/line', [UserController::class, 'unbindLine']);
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
    Route::post('/tickets/{id}/accept', [TicketController::class, 'acceptTicket']);
    Route::post('/tickets/{id}/quote', [TicketController::class, 'submitQuote']);
    Route::post('/tickets/{id}/attachments', [TicketController::class, 'uploadAttachment']);
    Route::post('/tickets/{id}/propose-times', [TicketController::class, 'proposeTimeSlots']); // 師傅提供時段
    Route::post('/tickets/{id}/confirm-time', [TicketController::class, 'adminConfirmTime']); // 客服代客確認時段
    Route::post('/tickets/{id}/admin-confirm-quote', [TicketController::class, 'adminConfirmQuote']); // 客服代客確認報價
    Route::post('/tickets/{id}/worker-select-slot', [TicketController::class, 'workerSelectSlot']); // 師傅選時段
    Route::post('/tickets/{id}/admin-reschedule', [TicketController::class, 'adminReschedule']); // 客服/師傅改期
    Route::post('/tickets/{id}/cancel-accept', [TicketController::class, 'workerCancelAcceptance']); // 師傅取消接單

    // LINE 綁定
    Route::patch('/users/{id}/line', [LineWebhookController::class, 'bindLineUser']);

    // LINE 客戶名冊
    Route::get('/line-customers', [LineCustomerController::class, 'index']);
    Route::delete('/line-customers/{id}', [LineCustomerController::class, 'destroy']);
});