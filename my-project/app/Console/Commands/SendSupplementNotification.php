<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Ticket;
use App\Models\User;
use App\Services\LineNotifyService;

class SendSupplementNotification extends Command
{
    protected $signature = 'notify:supplement {ticketId}';
    protected $description = '背景發送補件完成 LINE 通知';

    public function handle()
    {
        $ticket = Ticket::find($this->argument('ticketId'));
        if (!$ticket) {
            \Log::warning('[notify:supplement] Ticket not found: ' . $this->argument('ticketId'));
            return;
        }

        \Log::info("[notify:supplement] Sending notifications for {$ticket->ticket_no}...");

        $lineService = new LineNotifyService();

        // 通知管理員
        try {
            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();

            if (!empty($adminLineIds)) {
                $msg = "📥 客戶已補件\n\n"
                    . "編號：{$ticket->ticket_no}\n"
                    . "類別：{$ticket->category}\n"
                    . "說明：" . mb_substr($ticket->description_raw ?? '', 0, 50) . "\n\n"
                    . "請至後台審核。";

                foreach ($adminLineIds as $lineUserId) {
                    $lineService->pushMessage($lineUserId, $msg);
                }
                \Log::info("[notify:supplement] Notified " . count($adminLineIds) . " admins");
            }
        } catch (\Exception $e) {
            \Log::warning('[notify:supplement] Admin notify failed: ' . $e->getMessage());
        }

        \Log::info("[notify:supplement] Done for {$ticket->ticket_no}");
    }
}
