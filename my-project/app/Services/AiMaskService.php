<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class AiMaskService
{
    // ============ API 設定 ============
    // OpenAI API URL
    protected string $openaiUrl = 'https://api.openai.com/v1/chat/completions';

    // 從環境變數取得 API Key
    protected function getApiKey(): string
    {
        return env('OPENAI_API_KEY', '');
    }

    /**
     * 偵測個資（使用 OpenAI API）
     */
    public function detectPii(string $text): array
    {
        $apiKey = $this->getApiKey();

        // 如果沒有 API Key，回傳空陣列
        if (empty($apiKey)) {
            error_log('OpenAI API Key not configured');
            return [];
        }

        // 給 AI 的提示詞
        $prompt = "分析以下文字，找出所有個人資料（PII），並以 JSON 格式回傳。
只回傳 JSON，不要有其他文字。

格式範例：
{\"items\": [{\"text\": \"0912345678\", \"type\": \"phone\"}, {\"text\": \"wang@gmail.com\", \"type\": \"email\"}]}

類型包含：phone, email, id_card, credit_card, account, name, address

文字內容：
{$text}";

        try {
            // 發送 POST 請求給 OpenAI API
            $response = Http::timeout(30)
                ->withHeaders([
                    'Authorization' => "Bearer {$apiKey}",
                    'Content-Type' => 'application/json',
                ])
                ->post($this->openaiUrl, [
                    'model' => 'gpt-4o-mini',  // 使用最便宜的模型
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => $prompt
                        ]
                    ],
                    'temperature' => 0.1,  // 低溫度讓回應更穩定
                ]);

            // 記錄回應（除錯用）
            error_log('OpenAI API Response: ' . json_encode($response->json()));

            // 取得 AI 回傳的文字
            $result = $response->json('choices.0.message.content', '');

            error_log('OpenAI Result Text: ' . $result);

            // 用正則取出 JSON 部分
            preg_match('/\{.*\}/s', $result, $matches);

            if (!empty($matches[0])) {
                $decoded = json_decode($matches[0], true);
                error_log('Parsed JSON items: ' . json_encode($decoded['items'] ?? []));
                return $decoded['items'] ?? [];
            }
        } catch (\Exception $e) {
            error_log('OpenAI API Error: ' . $e->getMessage());
        }

        return [];
    }

    /**
     * 用 AI 執行遮罩（保留格式）
     */
    public function maskWithAi(string $text): array
    {
        $piiItems = $this->detectPii($text);
        $masked = $text;

        // 遍歷每個個資並用保留格式替換
        foreach ($piiItems as $item) {
            $replacement = $this->maskPartial($item['text'], $item['type']);
            $masked = str_replace($item['text'], $replacement, $masked);
        }

        return [
            'masked' => $masked,
            'detected' => $piiItems,
        ];
    }

    /**
     * 根據類型做保留格式遮罩
     * 和 MaskController 的邏輯一致
     */
    protected function maskPartial(string $text, string $type): string
    {
        switch ($type) {
            case 'phone':
                // 手機：09**-***-678
                $raw = preg_replace('/-/', '', $text);
                if (strlen($raw) === 10 && str_starts_with($raw, '09')) {
                    return substr($raw, 0, 2) . '**-***-' . substr($raw, -3);
                }
                // 市話：02-****5678
                if (str_contains($text, '-')) {
                    $parts = explode('-', $text);
                    $areaCode = $parts[0];
                    $number = $parts[1];
                    if (strlen($number) >= 5) {
                        return $areaCode . '-' . str_repeat('*', strlen($number) - 4) . substr($number, -4);
                    }
                }
                return substr($text, 0, 2) . str_repeat('*', max(strlen($text) - 5, 1)) . substr($text, -3);

            case 'email':
                // a**@gmail.com
                $atPos = strpos($text, '@');
                if ($atPos !== false && $atPos > 0) {
                    $firstChar = substr($text, 0, 1);
                    $domain = substr($text, $atPos);
                    return $firstChar . str_repeat('*', $atPos - 1) . $domain;
                }
                return $text;

            case 'id_card':
                // A1******89
                if (strlen($text) === 10) {
                    return substr($text, 0, 2) . str_repeat('*', 6) . substr($text, -2);
                }
                return $text;

            case 'credit_card':
                // ****-****-****-3456
                $raw = preg_replace('/[-\s]/', '', $text);
                if (strlen($raw) === 16) {
                    if (str_contains($text, '-') || str_contains($text, ' ')) {
                        return '****-****-****-' . substr($raw, -4);
                    }
                    return str_repeat('*', 12) . substr($raw, -4);
                }
                return $text;

            case 'account':
                // ********901
                if (strlen($text) >= 5) {
                    return str_repeat('*', strlen($text) - 3) . substr($text, -3);
                }
                return $text;

            case 'name':
                // 王**
                $len = mb_strlen($text);
                if ($len >= 2) {
                    return mb_substr($text, 0, 1) . str_repeat('*', $len - 1);
                }
                return '*';

            case 'address':
                // 台北市中正區*****
                if (preg_match('/^([\x{4e00}-\x{9fa5}]{2,3}[縣市][\x{4e00}-\x{9fa5}]{1,4}[區鄉鎮市])/u', $text, $prefix)) {
                    $rest = mb_substr($text, mb_strlen($prefix[0]));
                    return $prefix[0] . str_repeat('*', mb_strlen($rest));
                }
                return str_repeat('*', mb_strlen($text));

            default:
                // 未知類型：保留頭尾，中間遮罩
                $len = mb_strlen($text);
                if ($len <= 2)
                    return str_repeat('*', $len);
                return mb_substr($text, 0, 1) . str_repeat('*', $len - 2) . mb_substr($text, -1);
        }
    }
}