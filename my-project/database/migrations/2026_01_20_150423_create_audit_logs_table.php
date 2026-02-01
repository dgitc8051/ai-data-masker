<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
 public function up(): void                                                      
  {                                                                               
      Schema::create('audit_logs', function (Blueprint $table) {                  
          $table->id();                                                           
          $table->string('input_hash');           // 原文的 hash（不存原文）      
          $table->text('masked_text');            // 遮罩後的結果                 
          $table->json('stats');                  // 偵測統計 {"電話": 2,"身分證": 1}                                                                    
          $table->json('mask_types');             // 使用的遮罩類型               
          $table->string('purpose');              //用途：分享給工程/教育訓練/對外文件                                              
          $table->string('ip_address')->nullable(); // 來源 IP                    
          $table->timestamps();                   // created_at, updated_at       
      });                                                                         
  }          

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
