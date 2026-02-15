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
        Schema::create('ticket_comments', function (Blueprint $table) {
            $table->id();                                            // 主鍵

            // === 關聯 ===
            $table->foreignId('ticket_id')                           // 關聯到 tickets 表的 id
                ->constrained()                                    // 自動加上外鍵約束
                ->cascadeOnDelete();                               // 工單刪除時，留言也一起刪

            // === 留言內容 ===
            $table->string('author')->default('匿名');                // 留言者
            $table->text('content');                                  // 留言內容

            $table->timestamps();                                    // created_at + updated_at
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ticket_comments');
    }
};
