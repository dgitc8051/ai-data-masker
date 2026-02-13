<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->foreignId('template_id')->nullable()->after('id');
            $table->json('field_values')->nullable()->after('masked_text');   // {"name":"王小明","phone":"0912-345-678",...}
            $table->json('masked_fields')->nullable()->after('field_values'); // ["name","phone"] 被遮罩的欄位 key
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn(['template_id', 'field_values', 'masked_fields']);
        });
    }
};
