<?php

namespace App\Http\Controllers\Api;

  use App\Http\Controllers\Controller;
  use Illuminate\Http\Request;
  use App\Models\AuditLog;
  use App\Services\AiMaskService;  

  class MaskController extends Controller
  {
      public function mask(Request $request)
  {
      $text = $request->input('text', '');
      $types = $request->input('types', []);
      $masked = $text;
      $purpose = $request->input('purpose', '內部使用'); 

      // 統計用
      $stats = [
          '信用卡' => 0,
          '帳號' => 0,
          '身分證' => 0,
          '電話' => 0,
          'Email' => 0,
          '地址' => 0,
      ];

      // ========== 信用卡號 ==========
      // 16位數字，可能有空格或橫線分隔
      if (!empty($types['creditCard'])) { 
        $masked = preg_replace_callback('/\b\d{16}\b/', function($m) use (&$stats) {
          $stats['信用卡']++;
          return '[信用卡]';
      }, $masked);
      $masked = preg_replace_callback('/\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}/', function($m) use (&$stats) {
          $stats['信用卡']++;
          return '[信用卡]';
      }, $masked);
    }

      // ========== 銀行帳號 ==========
      if(!empty($types['account'])){
            $masked = preg_replace_callback('/\b\d{10,15}\b/', function($m) use (&$stats) {
          $stats['帳號']++;
          return '[帳號]';
      }, $masked);
    }

      // ========== 身分證字號 ==========
      // A123456789（大寫字母 + 1或2 + 8位數字）
      if(!empty($types['idCard'])){
        $masked = preg_replace_callback('/[A-Z][12]\d{8}/', function($m) use (&$stats) {
          $stats['身分證']++;
          return '[身分證]';
      }, $masked);
    }
      // ========== 手機號碼 ==========
      // 09xx-xxx-xxx 或 09xxxxxxxx
      if (!empty($types['phone'])) {
            $masked = preg_replace_callback('/09\d{2}-?\d{3}-?\d{3}/', function($m) use (&$stats) {
          $stats['電話']++;
          return '[電話]';
      }, $masked);
    }

      // ========== 市話 ==========
      // 02-12345678 或 04-1234567
      if (!empty($types['phone'])) {
            $masked = preg_replace_callback('/0\d{1,2}-\d{7,8}/', function($m) use (&$stats) {
          $stats['電話']++;
          return '[電話]';
      }, $masked);
    }

      // ========== Email ==========
      if (!empty($types['email'])) {
            $masked = preg_replace_callback('/[\w\.-]+@[\w\.-]+\.\w+/', function($m) use (&$stats) {
          $stats['Email']++;
          return '[Email]';
      }, $masked);
    }

      // ========== 地址 ==========
      // 匹配「縣市 + 區/鄉/鎮 + 路/街 + 號」
      if (!empty($types['address'])) {
            $masked = preg_replace_callback('/[\x{4e00}-\x{9fa5}]{2,3}[縣市][\x{4e00}-\x{9fa5}]{1,4}[區鄉鎮市][\x{4e00}-\x{9fa5}]{1,10}[路街道][\x{4e00}-\x{9fa5}0-9]+號/u', function($m) use (&$stats) {
          $stats['地址']++;
          return '[地址]';
      }, $masked);
    }

      // 過濾掉數量為 0 的項目   
      $stats = array_filter($stats, fn($count) => $count > 0);
        // 儲存稽核紀錄                                                                 
  AuditLog::create([                                                              
      'input_hash' => hash('sha256', $text),                                      
      'masked_text' => $masked,                                                   
      'stats' => $stats,                                                          
      'mask_types' => $types,                                                     
      'purpose' => $purpose,                                                      
      'ip_address' => $request->ip(),                                             
  ]);   
      return response()->json([
          'original' => $text,
          'masked' => $masked,
          'stats' => $stats,  // 新增：回傳統計
      ]);
  }
  /**                                                              
   * 使用 AI 進行遮罩                                              
   */                                                              
  public function maskWithAi(Request $request)                     
  {                                                                
      // 驗證輸入                                                  
      $request->validate([                                         
          'text' => 'required|string|min:1',                       
      ]);                                                          
                                                                   
      $text = $request->input('text');                             
                                                                   
      $aiService = new AiMaskService();                            
      $result = $aiService->maskWithAi($text);                     
                                                                   
      return response()->json([                                    
          'masked' => $result['masked'],                           
          'detected' => $result['detected'],                       
      ]);                                                          
  }                         
  }