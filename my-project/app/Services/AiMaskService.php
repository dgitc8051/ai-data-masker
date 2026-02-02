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

類型包含：phone, email, id_card, credit_card, name, address

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