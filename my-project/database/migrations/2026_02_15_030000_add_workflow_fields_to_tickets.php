<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // === 工作流程欄位 ===
            $table->dateTime('accepted_at')->nullable()->after('scheduled_at');       // 師傅接案時間
            $table->text('completion_note')->nullable()->after('notes_internal');     // 完工說明
            $table->decimal('quoted_amount', 10, 0)->nullable()->after('completion_note');  // 師傅報價金額
            $table->decimal('actual_amount', 10, 0)->nullable()->after('quoted_amount');    // 實收金額
            $table->dateTime('quote_confirmed_at')->nullable()->after('actual_amount');     // 客戶確認報價時間
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn([
                'accepted_at',
                'completion_note',
                'quoted_amount',
                'actual_amount',
                'quote_confirmed_at',
            ]);
        });
    }
};
