<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Ticket;
use App\Models\User;
use App\Services\LineNotifyService;
use Carbon\Carbon;

class SendScheduleReminder extends Command
{
    protected $signature = 'notify:schedule-reminder';
    protected $description = '發送明日維修排程 LINE 提醒（師傅+客戶）';

    public function handle()
    {
        $tomorrow = Carbon::tomorrow()->format('Y-m-d');

        // 找出所有明天預定的工單（scheduled / in_progress 且 worker_selected_slot 日期=明天）
        $tickets = Ticket::with('assignedUsers')
            ->whereIn('status', ['scheduled', 'in_progress'])
            ->whereNotNull('worker_selected_slot')
            ->get()
            ->filter(function ($ticket) use ($tomorrow) {
                $slot = $ticket->worker_selected_slot;
                return is_array($slot) && ($slot['date'] ?? null) === $tomorrow;
            });

        if ($tickets->isEmpty()) {
            $this->info("沒有明天 ({$tomorrow}) 的排程。");
            \Log::info("[schedule-reminder] No tickets scheduled for {$tomorrow}");
            return;
        }

        $lineService = new LineNotifyService();
        $frontendUrl = env('FRONTEND_URL', 'https://ai-data-masker-production-fda9.up.railway.app');
        $periodLabels = ['morning' => '上午 09-12', 'afternoon' => '下午 13-17', 'evening' => '晚上 18-21'];
        $notifiedCount = 0;

        foreach ($tickets as $ticket) {
            $slot = $ticket->worker_selected_slot;
            $dateLabel = Carbon::parse($slot['date'])->format('n/j（D）');
            $periodLabel = $periodLabels[$slot['period']] ?? $slot['period'];
            $timeDisplay = "{$dateLabel} {$periodLabel}";

            // === 通知師傅 ===
            $workers = $ticket->assignedUsers ?? collect();
            foreach ($workers as $worker) {
                if (!$worker->line_user_id)
                    continue;
                try {
                    $msg = "📅 明日維修提醒\n\n"
                        . "⏰ 時間：{$timeDisplay}\n"
                        . "📋 工單：{$ticket->ticket_no}\n"
                        . "📍 地址：{$ticket->address}\n"
                        . "📱 客戶電話：{$ticket->phone}\n\n"
                        . "請準時到場，如有異動請立即聯繫客服。";

                    $lineService->pushMessage($worker->line_user_id, $msg);
                    $notifiedCount++;
                    \Log::info("[schedule-reminder] Notified worker {$worker->name} for {$ticket->ticket_no}");
                } catch (\Exception $e) {
                    \Log::warning("[schedule-reminder] Worker notify failed ({$worker->name}): {$e->getMessage()}");
                }
            }

            // === 通知客戶 ===
            if ($ticket->customer_line_id) {
                try {
                    $msg = "📅 維修提醒\n\n"
                        . "您的報修 {$ticket->ticket_no} 已排定於明天維修：\n\n"
                        . "⏰ 時間：{$timeDisplay}\n"
                        . "📍 地址：{$ticket->address}\n\n"
                        . "師傅將於指定時段到場，請確保現場有人。\n\n"
                        . "📋 查詢進度：\n{$frontendUrl}/track";

                    $lineService->pushMessage($ticket->customer_line_id, $msg);
                    $notifiedCount++;
                    \Log::info("[schedule-reminder] Notified customer for {$ticket->ticket_no}");
                } catch (\Exception $e) {
                    \Log::warning("[schedule-reminder] Customer notify failed for {$ticket->ticket_no}: {$e->getMessage()}");
                }
            }
        }

        $this->info("✅ 已發送 {$notifiedCount} 則明日排程提醒（{$tickets->count()} 筆工單）");
        \Log::info("[schedule-reminder] Done: {$notifiedCount} messages for {$tickets->count()} tickets on {$tomorrow}");
    }
}
