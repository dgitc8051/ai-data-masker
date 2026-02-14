<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // 客服給客戶的補件說明
            $table->text('supplement_note')->nullable()->after('completion_note');
            // 客戶的 LINE user ID（用於推播通知）
            $table->string('customer_line_id')->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn(['supplement_note', 'customer_line_id']);
        });
    }
};
