<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('ticket_attachments', function (Blueprint $table) {
            $table->longBlob('file_data')->nullable()->after('file_path');
            $table->string('mime_type', 100)->nullable()->after('file_data');
        });
    }

    public function down(): void
    {
        Schema::table('ticket_attachments', function (Blueprint $table) {
            $table->dropColumn(['file_data', 'mime_type']);
        });
    }
};
