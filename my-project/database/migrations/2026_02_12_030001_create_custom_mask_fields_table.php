<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('custom_mask_fields', function (Blueprint $table) {
            $table->id();
            $table->string('label');                    // 欄位名稱（如「性別」）
            $table->string('mask_type')->default('full'); // full = 全替換 / partial = 保留前N字
            $table->integer('keep_chars')->default(0);  // partial 時保留幾個字
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_mask_fields');
    }
};
