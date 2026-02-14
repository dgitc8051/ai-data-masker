<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('line_customers', function (Blueprint $table) {
            $table->id();
            $table->string('line_user_id')->unique();
            $table->string('line_display_name');
            $table->string('customer_name')->nullable();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('avatar_url')->nullable();
            $table->timestamp('last_visited_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('line_customers');
    }
};
