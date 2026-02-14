<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Hash;

class LineWebhookController extends Controller
{
    /**
     * LINE Webhook 接收端點
     * 當用戶加好友/取消好友/發送訊息時觸發
     * POST /api/line/webhook
     */
    public function webhook(Request $request)
    {
        $channelSecret = config('services.line.channel_secret');
        $body = $request->getContent();

        // 驗證簽章
        $signature = $request->header('X-Line-Signature');
        $hash = base64_encode(hash_hmac('sha256', $body, $channelSecret, true));

        if ($signature !== $hash) {
            Log::warning('LINE webhook 簽章驗證失敗');
            return response()->json(['message' => 'Invalid signature'], 403);
        }

        $events = $request->input('events', []);

        foreach ($events as $event) {
            $type = $event['type'] ?? '';
            $userId = $event['source']['userId'] ?? null;

            if (!$userId)
                continue;

            if ($type === 'follow') {
                // 用戶加好友 → 記錄 LINE User ID
                Log::info("LINE follow event: {$userId}");
                $this->handleFollow($userId, $event);
            } elseif ($type === 'unfollow') {
                // 用戶取消好友
                Log::info("LINE unfollow event: {$userId}");
            } elseif ($type === 'message') {
                // 用戶發送訊息 → 可用來綁定帳號
                $this->handleMessage($userId, $event);
            }
        }

        return response()->json(['message' => 'ok']);
    }

    /**
     * 處理加好友事件
     */
    private function handleFollow(string $lineUserId, array $event): void
    {
        // 發送歡迎訊息（告知如何綁定帳號）
        $lineService = new \App\Services\LineNotifyService();
        $lineService->pushMessage(
            $lineUserId,
            "歡迎使用維修通知系統！\n\n" .
            "請輸入帳號和密碼來綁定通知：\n" .
            "格式：綁定 帳號 密碼\n" .
            "例如：綁定 worker1 worker123\n\n" .
            "綁定後，系統將透過 LINE 推送派工和完工通知。"
        );
    }

    /**
     * 處理訊息事件（帳號綁定）
     */
    private function handleMessage(string $lineUserId, array $event): void
    {
        $text = trim($event['message']['text'] ?? '');

        // 綁定指令：「綁定 帳號 密碼」
        if (preg_match('/^綁定\s+(\S+)\s+(\S+)$/u', $text, $matches)) {
            $username = trim($matches[1]);
            $password = trim($matches[2]);
            $user = User::where('username', $username)->first();

            $lineService = new \App\Services\LineNotifyService();

            if (!$user || !Hash::check($password, $user->password)) {
                $lineService->pushMessage(
                    $lineUserId,
                    "❌ 帳號或密碼錯誤\n" .
                    "請確認後再試一次。\n\n" .
                    "格式：綁定 帳號 密碼"
                );
                Log::warning("LINE 綁定失敗（帳密錯誤）: {$username}");
                return;
            }

            $user->update(['line_user_id' => $lineUserId]);
            $lineService->pushMessage(
                $lineUserId,
                "✅ 綁定成功！\n\n" .
                "帳號：{$user->name}（{$user->username}）\n" .
                "角色：" . ($user->role === 'admin' ? '管理員' : '師傅') . "\n\n" .
                "之後的派工通知將會透過 LINE 推送給您。"
            );
            Log::info("LINE 帳號綁定成功: {$username} → {$lineUserId}");
        } elseif (str_starts_with($text, '綁定')) {
            // 格式不對時給提示
            $lineService = new \App\Services\LineNotifyService();
            $lineService->pushMessage(
                $lineUserId,
                "⚠️ 格式錯誤\n\n" .
                "正確格式：綁定 帳號 密碼\n" .
                "例如：綁定 worker1 worker123"
            );
        }
    }

    /**
     * 手動綁定 LINE User ID（管理員用）
     * PATCH /api/users/{id}/line
     */
    public function bindLineUser(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => '找不到使用者'], 404);
        }

        $user->update(['line_user_id' => $request->input('line_user_id')]);

        return response()->json([
            'message' => 'LINE 綁定成功',
            'user' => $user->only(['id', 'name', 'username', 'line_user_id']),
        ]);
    }
}
