<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // === 日曆排程欄位 ===
            $table->json('customer_preferred_slots')->nullable()->after('preferred_time_slot');  // 客戶偏好時段 JSON（取代文字版）
            $table->json('worker_selected_slot')->nullable()->after('customer_preferred_slots'); // 師傅從中選的
            $table->json('reschedule_history')->nullable()->after('worker_selected_slot');       // 改期歷史
            $table->integer('reschedule_count')->default(0)->after('reschedule_history');        // 改期次數
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn([
                'customer_preferred_slots',
                'worker_selected_slot',
                'reschedule_history',
                'reschedule_count',
            ]);
        });
    }
};
