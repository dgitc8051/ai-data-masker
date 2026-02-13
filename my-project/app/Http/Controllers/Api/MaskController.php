<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\AuditLog;
use App\Services\AiMaskService;
use App\Services\MaskService;

class MaskController extends Controller
{
  public function mask(Request $request)
  {
    $text = $request->input('text', '');
    $types = $request->input('types', []);
    $purpose = $request->input('purpose', '內部使用');

    // 呼叫 MaskService 執行遮罩（邏輯都在 Service 裡）
    $maskService = new MaskService();
    $result = $maskService->mask($text, $types);

    // 儲存稽核紀錄
    AuditLog::create([
      'input_hash' => hash('sha256', $text),
      'masked_text' => $result['masked'],
      'stats' => $result['stats'],
      'mask_types' => $types,
      'purpose' => $purpose,
      'ip_address' => $request->ip(),
    ]);

    return response()->json([
      'original' => $text,
      'masked' => $result['masked'],
      'stats' => $result['stats'],
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