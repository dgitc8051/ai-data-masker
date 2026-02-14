<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // === 師傅排程欄位 ===
            $table->json('proposed_time_slots')->nullable()->after('scheduled_at');       // 師傅提供的多個可用時段
            $table->string('confirmed_time_slot')->nullable()->after('proposed_time_slots'); // 最終確認的時段
            $table->string('confirmed_by')->nullable()->after('confirmed_time_slot');     // 'customer' 或 'admin:王小明（代客選擇）'
            $table->text('confirm_reason')->nullable()->after('confirmed_by');            // 代客選擇原因
            $table->dateTime('time_confirmed_at')->nullable()->after('confirm_reason');   // 確認時間

            // === 取消欄位 ===
            $table->dateTime('cancelled_at')->nullable()->after('time_confirmed_at');
            $table->string('cancelled_by_role')->nullable()->after('cancelled_at');      // 'customer' / 'admin' / 'worker'
            $table->string('cancelled_by_name')->nullable()->after('cancelled_by_role'); // 取消者姓名
            $table->text('cancel_reason')->nullable()->after('cancelled_by_name');       // 取消原因
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn([
                'proposed_time_slots',
                'confirmed_time_slot',
                'confirmed_by',
                'confirm_reason',
                'time_confirmed_at',
                'cancelled_at',
                'cancelled_by_role',
                'cancelled_by_name',
                'cancel_reason',
            ]);
        });
    }
};
