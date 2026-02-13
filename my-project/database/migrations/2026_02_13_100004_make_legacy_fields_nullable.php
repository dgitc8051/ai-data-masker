<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // 報修模式不使用 original_text，改為 nullable
            $table->text('original_text')->nullable()->change();
            $table->string('title')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->text('original_text')->nullable(false)->change();
            $table->string('title')->nullable(false)->change();
        });
    }
};
