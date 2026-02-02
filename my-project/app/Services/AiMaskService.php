<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class AiMaskService
{
    // ============ API 設定 ============
    // Gemini API URL
    protected string $geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    // 從環境變數取得 API Key
    protected function getApiKey(): string
    {
        return config('services.gemini.api_key', env('GEMINI_API_KEY', ''));
    }

    /**
     * 偵測個資（使用 Google Gemini API）
     */
    public function detectPii(string $text): array
    {
        $apiKey = $this->getApiKey();

        // 如果沒有 API Key，回傳空陣列（本地開發可能沒設定）
        if (empty($apiKey)) {
            return [];
        }

        // 給 AI 的提示詞
        $prompt = "分析以下文字，找出所有個人資料（PII），並以 JSON 格式回傳。
只回傳 JSON，不要有其他文字。

格式範例：
{\"items\": [{\"text\": \"0912345678\", \"type\": \"phone\"}, {\"text\": \"wang@gmail.com\", \"type\": \"email\"}]}

類型包含：phone, email, id_card, credit_card, name, address

文字內容：
{$text}";

        try {
            // 發送 POST 請求給 Gemini API
            $response = Http::timeout(30)->post("{$this->geminiUrl}?key={$apiKey}", [
                'contents' => [
                    [
                        'parts' => [
                            ['text' => $prompt]
                        ]
                    ]
                ]
            ]);

            // 取得 AI 回傳的文字
            $result = $response->json('candidates.0.content.parts.0.text', '');

            // 用正則取出 JSON 部分
            preg_match('/\{.*\}/s', $result, $matches);

            if (!empty($matches[0])) {
                $decoded = json_decode($matches[0], true);
                return $decoded['items'] ?? [];
            }
        } catch (\Exception $e) {
            // 發生錯誤時記錄並回傳空陣列
            \Log::error('Gemini API Error: ' . $e->getMessage());
        }

        return [];
    }

    /**
     * 用 AI 執行遮罩
     */
    public function maskWithAi(string $text): array
    {
        $piiItems = $this->detectPii($text);
        $masked = $text;

        // 類型對應的中文標籤
        $typeLabels = [
            'phone' => '電話',
            'email' => 'Email',
            'id_card' => '身分證',
            'credit_card' => '信用卡',
            'name' => '姓名',
            'address' => '地址',
        ];

        // 遍歷每個個資並替換
        foreach ($piiItems as $item) {
            $label = $typeLabels[$item['type']] ?? '個資';
            $masked = str_replace($item['text'], "[{$label}]", $masked);
        }

        return [
            'masked' => $masked,
            'detected' => $piiItems,
        ];
    }
}