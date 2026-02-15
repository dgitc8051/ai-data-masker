<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LineNotifyService
{
    protected string $channelAccessToken;

    public function __construct()
    {
        $this->channelAccessToken = config('services.line.channel_token');
    }

    /**
     * 推播文字訊息給指定 LINE User
     */
    public function pushMessage(string $lineUserId, string $message): bool
    {
        if (empty($lineUserId) || empty($this->channelAccessToken)) {
            Log::warning('LINE push 失敗：缺少 lineUserId 或 token');
            return false;
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->channelAccessToken,
                'Content-Type' => 'application/json',
            ])->post('https://api.line.me/v2/bot/message/push', [
                        'to' => $lineUserId,
                        'messages' => [
                            [
                                'type' => 'text',
                                'text' => $message,
                            ],
                        ],
                    ]);

            if ($response->successful()) {
                Log::info("LINE 推播成功: {$lineUserId}");
                return true;
            }

            Log::error('LINE 推播失敗', [
                'status' => $response->status(),
                'body' => $response->body(),
                'to' => $lineUserId,
            ]);
            return false;

        } catch (\Exception $e) {
            Log::error('LINE 推播例外', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * 推播訊息給多位用戶
     */
    public function pushToMultiple(array $lineUserIds, string $message): array
    {
        $results = [];
        foreach ($lineUserIds as $uid) {
            $results[$uid] = $this->pushMessage($uid, $message);
        }
        return $results;
    }

    /**
     * 派工通知（推給師傅）
     */
    public function notifyDispatch(array $payload, array $lineUserIds): void
    {
        if (empty($lineUserIds))
            return;

        $message = $payload['message'] ?? $this->buildDispatchMessage($payload);
        $this->pushToMultiple($lineUserIds, $message);
    }

    /**
     * 組合派工訊息（備用）
     */
    private function buildDispatchMessage(array $payload): string
    {
        $msg = "【派工通知】{$payload['ticket_no']}（{$payload['category']}）\n";
        $msg .= "客戶：" . ($payload['customer_name'] ?? '未提供') . "\n";
        $msg .= "電話：" . ($payload['phone'] ?? '未提供') . "\n";
        $msg .= "地址：" . ($payload['address'] ?? '未提供') . "\n";
        $msg .= "問題：" . ($payload['description'] ?? '未提供') . "\n";
        $msg .= "（由系統推播，請勿轉傳）";
        return $msg;
    }
}
