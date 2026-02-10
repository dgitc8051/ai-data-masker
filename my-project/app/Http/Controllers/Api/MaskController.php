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
    if (!empty($types['creditCard'])) {
      // 16位連續數字 → ************3456
      $masked = preg_replace_callback('/\b\d{16}\b/', function ($m) use (&$stats) {
        $stats['信用卡']++;
        $raw = $m[0];
        return str_repeat('*', 12) . substr($raw, -4);
      }, $masked);
      // 有分隔符的格式 → ****-****-****-3456
      $masked = preg_replace_callback('/\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}/', function ($m) use (&$stats) {
        $stats['信用卡']++;
        $raw = preg_replace('/[-\s]/', '', $m[0]);
        return '****-****-****-' . substr($raw, -4);
      }, $masked);
    }

    // ========== 銀行帳號 ==========
    if (!empty($types['account'])) {
      // 10~15位數字 → ********901
      $masked = preg_replace_callback('/\b\d{10,15}\b/', function ($m) use (&$stats) {
        $stats['帳號']++;
        $raw = $m[0];
        return str_repeat('*', strlen($raw) - 3) . substr($raw, -3);
      }, $masked);
    }

    // ========== 身分證字號 ==========
    if (!empty($types['idCard'])) {
      // A123456789 → A1******89
      $masked = preg_replace_callback('/[A-Z][12]\d{8}/', function ($m) use (&$stats) {
        $stats['身分證']++;
        $raw = $m[0];
        return substr($raw, 0, 2) . str_repeat('*', 6) . substr($raw, -2);
      }, $masked);
    }

    // ========== 手機號碼 ==========
    if (!empty($types['phone'])) {
      // 0912-345-678 → 09**-***-678
      $masked = preg_replace_callback('/09\d{2}-?\d{3}-?\d{3}/', function ($m) use (&$stats) {
        $stats['電話']++;
        $raw = preg_replace('/-/', '', $m[0]);
        return substr($raw, 0, 2) . '**-***-' . substr($raw, -3);
      }, $masked);
    }

    // ========== 市話 ==========
    if (!empty($types['phone'])) {
      // 02-12345678 → 02-****5678
      $masked = preg_replace_callback('/0\d{1,2}-\d{7,8}/', function ($m) use (&$stats) {
        $stats['電話']++;
        $parts = explode('-', $m[0]);
        $areaCode = $parts[0];
        $number = $parts[1];
        return $areaCode . '-' . str_repeat('*', strlen($number) - 4) . substr($number, -4);
      }, $masked);
    }

    // ========== Email ==========
    if (!empty($types['email'])) {
      // abc@gmail.com → a**@gmail.com
      $masked = preg_replace_callback('/[\w\.-]+@[\w\.-]+\.\w+/', function ($m) use (&$stats) {
        $stats['Email']++;
        $raw = $m[0];
        $atPos = strpos($raw, '@');
        $firstChar = substr($raw, 0, 1);
        $domain = substr($raw, $atPos);
        return $firstChar . str_repeat('*', $atPos - 1) . $domain;
      }, $masked);
    }

    // ========== 地址 ==========
    if (!empty($types['address'])) {
      // 台北市中正區忠孝東路100號 → 台北市中正區*****
      $masked = preg_replace_callback('/[\x{4e00}-\x{9fa5}]{2,3}[縣市][\x{4e00}-\x{9fa5}]{1,4}[區鄉鎮市][\x{4e00}-\x{9fa5}]{1,10}[路街道][\x{4e00}-\x{9fa5}0-9]+號/u', function ($m) use (&$stats) {
        $stats['地址']++;
        $raw = $m[0];
        preg_match('/^([\x{4e00}-\x{9fa5}]{2,3}[縣市][\x{4e00}-\x{9fa5}]{1,4}[區鄉鎮市])/u', $raw, $prefix);
        if (!empty($prefix[0])) {
          $rest = mb_substr($raw, mb_strlen($prefix[0]));
          return $prefix[0] . str_repeat('*', mb_strlen($rest));
        }
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
      'stats' => $stats,
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