<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('ticket_user', function (Blueprint $table) {
            $table->string('role', 20)->default('primary')->after('user_id');
            // 'primary' = 主師傅, 'assistant' = 協助人員
        });
    }

    public function down(): void
    {
        Schema::table('ticket_user', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
