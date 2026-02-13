<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            // === 基本欄位 ===
            $table->id();                                    // 自動遞增主鍵
            $table->string('ticket_no')->unique();           // 工單編號，例如 TK-20260210-001
            $table->string('title');                         // 工單標題

            // === 文字內容 ===
            $table->text('original_text');                   // 原始文字（含個資）
            $table->text('masked_text')->nullable();         // 遮罩後的文字
            $table->string('mask_method')->default('regex'); // 遮罩方式：regex 或 ai

            // === 工單狀態 ===
            $table->string('status')->default('pending');    // pending → processing → completed → closed
            $table->string('priority')->default('medium');   // low / medium / high

            // === 人員與用途 ===
            $table->string('purpose')->default('內部使用');    // 用途
            $table->string('created_by')->default('匿名');    // 建立者
            $table->string('assigned_to')->nullable();       // 指派給誰

            // === 統計 ===
            $table->json('stats')->nullable();               // 偵測統計 JSON

            // === 時間 ===
            $table->timestamps();                            // created_at + updated_at
            $table->timestamp('completed_at')->nullable();   // 完成時間
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
