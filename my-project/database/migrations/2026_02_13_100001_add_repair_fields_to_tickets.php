<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // === 報修專用欄位 ===
            $table->string('category')->nullable()->after('title');          // 報修分類
            $table->string('customer_name')->nullable()->after('category');  // 客戶姓名
            $table->string('phone')->nullable()->after('customer_name');     // 聯絡電話
            $table->text('address')->nullable()->after('phone');             // 服務地址
            $table->text('description_raw')->nullable()->after('address');   // 客戶原始描述
            $table->text('description_summary')->nullable()->after('description_raw'); // 客服摘要（外勤用）
            $table->string('preferred_time_slot')->nullable()->after('description_summary'); // 偏好時段
            $table->dateTime('scheduled_at')->nullable()->after('preferred_time_slot');      // 排程時間
            $table->boolean('is_urgent')->default(false)->after('priority'); // 急件
            $table->text('notes_internal')->nullable()->after('assigned_to'); // 內部備註
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn([
                'category',
                'customer_name',
                'phone',
                'address',
                'description_raw',
                'description_summary',
                'preferred_time_slot',
                'scheduled_at',
                'is_urgent',
                'notes_internal',
            ]);
        });
    }
};
