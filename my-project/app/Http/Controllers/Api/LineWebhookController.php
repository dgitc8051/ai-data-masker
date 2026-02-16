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
        $lineService = new \App\Services\LineNotifyService();

        // 取得 LINE 暱稱
        $displayName = $this->getLineDisplayName($lineUserId) ?? '';

        // 自動註冊為 LINE 客戶（如果不存在）
        \App\Models\LineCustomer::firstOrCreate(
            ['line_user_id' => $lineUserId],
            [
                'line_display_name' => $displayName,
                'avatar_url' => '',
            ]
        );

        $frontendUrl = env('FRONTEND_URL', 'https://ai-data-masker-production-fda9.up.railway.app');

        // 發送客戶導向的歡迎訊息
        $lineService->pushMessage(
            $lineUserId,
            "歡迎使用修繕通 RepairFlow！🏠\n\n" .
            "我們提供專業到府維修服務，以下是常用功能：\n\n" .
            "🔧 報修填單：\n{$frontendUrl}/repair\n\n" .
            "📋 查詢進度：\n{$frontendUrl}/track\n\n" .
            "💰 費用參考：\n{$frontendUrl}/pricing\n\n" .
            "📞 聯絡我們：\n{$frontendUrl}/contact\n\n" .
            "請直接點選下方選單快速操作 👇\n\n" .
            "（師傅/員工如需綁定帳號，請輸入：綁定 帳號 密碼）"
        );
    }

    /**
     * 處理訊息事件（帳號綁定 + AI 智能引導）
     */
    private function handleMessage(string $lineUserId, array $event): void
    {
        $text = trim($event['message']['text'] ?? '');
        $lineService = new \App\Services\LineNotifyService();

        // 綁定指令：「綁定 帳號 密碼」
        if (preg_match('/^綁定\s+(\S+)\s+(\S+)$/u', $text, $matches)) {
            $username = trim($matches[1]);
            $password = trim($matches[2]);
            $user = User::where('username', $username)->first();

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

            // 檢查：此帳號是否已被「其他」LINE 綁定
            if (!empty($user->line_user_id) && $user->line_user_id !== $lineUserId) {
                $lineService->pushMessage(
                    $lineUserId,
                    "⚠️ 帳號「{$user->name}（{$username}）」已被其他 LINE 綁定。\n\n" .
                    "如需重新綁定，請先由原 LINE 輸入：\n" .
                    "解除綁定 {$username} 密碼\n\n" .
                    "或請管理員在後台解除綁定。"
                );
                Log::warning("LINE 綁定失敗（已被其他 LINE 綁定）: {$username}");
                return;
            }

            // 提示：此 LINE 已綁定其他帳號
            $existingBindings = User::where('line_user_id', $lineUserId)
                ->where('id', '!=', $user->id)
                ->get(['name', 'username', 'role']);
            $bindingWarning = '';
            if ($existingBindings->isNotEmpty()) {
                $names = $existingBindings->map(fn($u) => "「{$u->name}（{$u->username}）」")->join('、');
                $bindingWarning = "\n\n⚠️ 提醒：此 LINE 同時綁定了 {$names}";
            }

            // 取得 LINE 暱稱
            $displayName = $this->getLineDisplayName($lineUserId) ?? '';

            $user->update([
                'line_user_id' => $lineUserId,
                'line_display_name' => $displayName,
            ]);

            $phoneReminder = '';
            if (empty($user->phone)) {
                $phoneReminder = "\n\n📞 您尚未設定手機號碼，建議設定以便客戶聯繫：\n設定電話 09xxxxxxxx";
            }

            $lineService->pushMessage(
                $lineUserId,
                "✅ 綁定成功！\n\n" .
                "帳號：{$user->name}（{$user->username}）\n" .
                "角色：" . ($user->role === 'admin' ? '管理員' : '師傅') . "\n\n" .
                "之後的派工通知將會透過 LINE 推送給您。" .
                $bindingWarning .
                $phoneReminder
            );
            Log::info("LINE 帳號綁定成功: {$username} → {$lineUserId} ({$displayName})");
            return;
        }

        // 設定電話指令：「設定電話 09xxxxxxxx」
        if (preg_match('/^設定電話\s*(09\d{8})$/u', $text, $matches)) {
            $phone = trim($matches[1]);
            $user = User::where('line_user_id', $lineUserId)->first();
            if (!$user) {
                $lineService->pushMessage(
                    $lineUserId,
                    "❌ 請先綁定帳號後再設定電話\n格式：綁定 帳號 密碼"
                );
                return;
            }
            $user->update(['phone' => $phone]);
            $lineService->pushMessage(
                $lineUserId,
                "✅ 電話已設定：{$phone}\n\n客戶將可透過此號碼聯繫您。"
            );
            Log::info("LINE 設定電話: {$user->name} => {$phone}");
            return;
        }

        // 解除綁定指令：「解除綁定 帳號 密碼」
        if (preg_match('/^解除綁定\s+(\S+)\s+(\S+)$/u', $text, $matches)) {
            $username = trim($matches[1]);
            $password = trim($matches[2]);
            $user = User::where('username', $username)->first();

            if (!$user || !Hash::check($password, $user->password)) {
                $lineService->pushMessage(
                    $lineUserId,
                    "❌ 帳號或密碼錯誤\n" .
                    "請確認後再試一次。\n\n" .
                    "格式：解除綁定 帳號 密碼"
                );
                return;
            }

            if ($user->line_user_id !== $lineUserId) {
                $lineService->pushMessage(
                    $lineUserId,
                    "⚠️ 此帳號並非綁定在這個 LINE 帳號上"
                );
                return;
            }

            $user->update(['line_user_id' => null, 'line_display_name' => null]);
            $lineService->pushMessage(
                $lineUserId,
                "✅ 已解除綁定！\n\n" .
                "帳號：{$user->name}（{$user->username}）\n\n" .
                "之後將不會收到 LINE 通知。\n" .
                "如需重新綁定，請輸入：綁定 帳號 密碼"
            );
            Log::info("LINE 帳號解除綁定: {$username}");
            return;
        }

        if (str_starts_with($text, '解除綁定')) {
            $lineService->pushMessage(
                $lineUserId,
                "⚠️ 格式錯誤\n\n" .
                "正確格式：解除綁定 帳號 密碼\n" .
                "例如：解除綁定 worker1 worker123"
            );
            return;
        }

        if (str_starts_with($text, '綁定')) {
            $lineService->pushMessage(
                $lineUserId,
                "⚠️ 格式錯誤\n\n" .
                "正確格式：綁定 帳號 密碼\n" .
                "例如：綁定 worker1 worker123"
            );
            return;
        }

        // === AI 智能引導 ===
        $reply = $this->aiSmartGuide($text);
        $lineService->pushMessage($lineUserId, $reply);
    }

    /**
     * AI 智能引導：判斷用戶意圖，引導到對應功能
     */
    private function aiSmartGuide(string $userMessage): string
    {
        $frontendUrl = env('FRONTEND_URL', 'https://ai-data-masker-production-fda9.up.railway.app');
        $apiKey = env('OPENAI_API_KEY', '');

        if (empty($apiKey)) {
            Log::warning('OpenAI API Key 未設定，使用預設回覆');
            return $this->defaultReply($frontendUrl);
        }

        $systemPrompt = <<<PROMPT
你是修繕通 RepairFlow 的 LINE 智能客服助理。你的工作是「理解客戶意圖」，然後「引導客戶到正確的功能頁面」。

公司提供以下 6 個功能（對應 LINE 選單）：

1. 用戶報修 → {$frontendUrl}/repair
   用途：填寫維修單（水管、電路、冷氣、熱水器等）
   
2. 維修進度 → {$frontendUrl}/track
   用途：用維修編號+手機查詢維修進度
   
3. 關於與聯絡 → {$frontendUrl}/contact
   用途：查看公司簡介、服務理念、電話、地址、營業時間
   
4. 服務項目 → {$frontendUrl}/services
   用途：查看我們提供的所有維修服務類別

5. 費用參考 → {$frontendUrl}/pricing
   用途：查看到府檢測費（$300，維修折抵）、各類維修參考價格、距離加成
   ⚠️ 任何關於「多少錢」「收費」「報價」「費用」「價格」的問題，優先引導到這個頁面

6. 內部登入 → {$frontendUrl}/login
   用途：員工/師傅登入後台（一般客戶不需要）

回覆規則：
- 用繁體中文、口語化、親切
- 簡短回覆（不超過 100 字）
- 一定要附上對應的連結
- 如果不確定意圖，列出最可能的 2-3 個選項
- 不要嘗試直接回答維修技術問題，引導到報修或聯絡我們
- 詢問價格相關問題時，引導到費用參考頁，並提醒實際費用以師傅現場報價為準
- 結尾加上「也可以直接點選下方選單快速操作哦！👇」
PROMPT;

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(15)
                ->withHeaders([
                    'Authorization' => "Bearer {$apiKey}",
                    'Content-Type' => 'application/json',
                ])
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => 'gpt-4o-mini',
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userMessage],
                    ],
                    'temperature' => 0.7,
                    'max_tokens' => 300,
                ]);

            $reply = $response->json('choices.0.message.content', '');

            if (!empty($reply)) {
                Log::info("AI 智能引導：「{$userMessage}」→ 已回覆");
                return $reply;
            }
        } catch (\Exception $e) {
            Log::warning('AI 智能引導失敗: ' . $e->getMessage());
        }

        // fallback
        return $this->defaultReply($frontendUrl);
    }

    /**
     * 預設回覆（AI 不可用時的 fallback）
     */
    private function defaultReply(string $frontendUrl): string
    {
        return "您好！我是智能客服助理 🤖\n\n"
            . "請問需要什麼服務呢？\n\n"
            . "🔧 報修填單：\n{$frontendUrl}/repair\n\n"
            . "📋 查詢進度：\n{$frontendUrl}/track\n\n"
            . "📞 聯絡我們：\n{$frontendUrl}/contact\n\n"
            . "也可以直接點選下方選單快速操作哦！👇";
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

        $lineUserId = $request->input('line_user_id');
        $displayName = $this->getLineDisplayName($lineUserId) ?? '';

        $user->update([
            'line_user_id' => $lineUserId,
            'line_display_name' => $displayName,
        ]);

        return response()->json([
            'message' => 'LINE 綁定成功',
            'user' => $user->only(['id', 'name', 'username', 'line_user_id', 'line_display_name']),
        ]);
    }

    /**
     * 透過 LINE Messaging API 取得用戶暱稱
     */
    private function getLineDisplayName(string $lineUserId): ?string
    {
        $token = config('services.line.channel_token');
        if (empty($token)) {
            return null;
        }

        try {
            $response = \Illuminate\Support\Facades\Http::withHeaders([
                'Authorization' => "Bearer {$token}",
            ])->get("https://api.line.me/v2/bot/profile/{$lineUserId}");

            if ($response->ok()) {
                return $response->json('displayName');
            }
        } catch (\Exception $e) {
            Log::warning('取得 LINE 暱稱失敗: ' . $e->getMessage());
        }

        return null;
    }
}
