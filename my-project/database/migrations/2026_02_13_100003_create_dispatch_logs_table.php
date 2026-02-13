<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('dispatch_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('dispatcher_user_id'); // 派工的客服
            $table->json('technician_ids');                    // 派給哪些師傅
            $table->json('payload_snapshot');                  // 派工內容快照（遮罩後）
            $table->timestamp('dispatched_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_logs');
    }
};
