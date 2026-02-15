<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Ticket;
use App\Models\User;
use App\Services\LineNotifyService;

class SendRepairNotification extends Command
{
    protected $signature = 'notify:repair {ticketId}';
    protected $description = '背景發送報修單 LINE 通知';

    public function handle()
    {
        $ticket = Ticket::find($this->argument('ticketId'));
        if (!$ticket) {
            \Log::warning('[notify:repair] Ticket not found: ' . $this->argument('ticketId'));
            return;
        }

        \Log::info("[notify:repair] Sending LINE notifications for {$ticket->ticket_no}...");

        $lineService = new LineNotifyService();
        $frontendUrl = env('FRONTEND_URL', 'https://ai-data-masker-production-fda9.up.railway.app');

        // 通知管理員
        try {
            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();

            if (!empty($adminLineIds)) {
                $msg = "📨 新報修單\n\n"
                    . "編號：{$ticket->ticket_no}\n"
                    . "類別：{$ticket->category}\n"
                    . "電話：{$ticket->phone}\n"
                    . "地址：{$ticket->address}\n"
                    . "說明：" . mb_substr($ticket->description_raw ?? '', 0, 50) . "\n\n"
                    . "📋 查詢進度：\n{$frontendUrl}/track\n\n"
                    . "請至後台處理。";

                foreach ($adminLineIds as $lineUserId) {
                    $lineService->pushMessage($lineUserId, $msg);
                }
                \Log::info("[notify:repair] Notified " . count($adminLineIds) . " admins");
            }
        } catch (\Exception $e) {
            \Log::warning('[notify:repair] Admin notify failed: ' . $e->getMessage());
        }

        // 通知客戶
        if ($ticket->customer_line_id) {
            try {
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "✅ 您的報修已成功送出！\n\n"
                    . "📋 編號：{$ticket->ticket_no}\n"
                    . "📌 類別：{$ticket->category}\n"
                    . "📍 地址：{$ticket->address}\n\n"
                    . "我們將儘速為您處理，狀態有更新時會再通知您。\n\n"
                    . "📋 查詢進度：\n{$frontendUrl}/track"
                );
                \Log::info("[notify:repair] Notified customer: {$ticket->customer_line_id}");
            } catch (\Exception $e) {
                \Log::warning('[notify:repair] Customer notify failed: ' . $e->getMessage());
            }
        }

        \Log::info("[notify:repair] Done for {$ticket->ticket_no}");
    }
}
