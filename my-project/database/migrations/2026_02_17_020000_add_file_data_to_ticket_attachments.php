<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('ticket_attachments', function (Blueprint $table) {
            $table->binary('file_data')->nullable()->after('file_path');
            $table->string('mime_type', 100)->nullable()->after('file_data');
        });

        // Laravel binary() 只建 BLOB (64KB)，改成 LONGBLOB (4GB) 才夠存圖片
        DB::statement('ALTER TABLE ticket_attachments MODIFY file_data LONGBLOB NULL');
    }

    public function down(): void
    {
        Schema::table('ticket_attachments', function (Blueprint $table) {
            $table->dropColumn(['file_data', 'mime_type']);
        });
    }
};
