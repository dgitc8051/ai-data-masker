<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Ticket;
use App\Models\User;
use App\Models\DispatchLog;
use App\Models\CustomMaskField;
use App\Services\MaskService;
use App\Services\AiMaskService;
use App\Services\LineNotifyService;

class TicketController extends Controller
{
    /**
     * 取得工單列表
     * GET /api/tickets
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Ticket::with('assignedUsers:id,name')->latest();

        // 師傅只看被指派的 + 未指派的
        if ($user && $user->role === 'worker') {
            $query->where(function ($q) use ($user) {
                $q->whereHas('assignedUsers', function ($q2) use ($user) {
                    $q2->where('users.id', $user->id);
                })->orWhereDoesntHave('assignedUsers');
            });
        }

        // 狀態篩選
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // 搜尋
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('ticket_no', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%");
            });
        }

        $tickets = $query->get();

        // 師傅視角：隱藏敏感資料
        if ($user && $user->role === 'worker') {
            $tickets->each(function ($ticket) {
                $ticket->makeHidden([
                    'original_text',
                    'field_values',
                    'customer_name',
                    'phone',
                    'description_raw',
                    'notes_internal',
                ]);
            });
        }

        return response()->json($tickets);
    }

    /**
     * 建立新工單
     * POST /api/tickets
     * 支援兩種模式：報修 (category) / 範本遮罩 (field_values)
     */
    public function store(Request $request)
    {
        $user = $request->user();

        // 產生工單編號（短格式：TK250215001）
        $today = now()->format('ymd'); // 2-digit year
        $lastTicket = Ticket::where('ticket_no', 'like', "TK{$today}%")
            ->orderBy('ticket_no', 'desc')
            ->first();
        $nextNumber = $lastTicket ? (int) substr($lastTicket->ticket_no, -3) + 1 : 1;
        $ticketNo = "TK{$today}" . str_pad($nextNumber, 3, '0', STR_PAD_LEFT);

        $isRepairMode = $request->has('category');

        if ($isRepairMode) {
            // === 報修模式 ===
            $ticket = Ticket::create([
                'ticket_no' => $ticketNo,
                'title' => $request->input('title', '報修單'),
                'category' => $request->input('category'),
                'customer_name' => $request->input('customer_name'),
                'phone' => $request->input('phone'),
                'address' => $request->input('address'),
                'description_raw' => $request->input('description'),
                'preferred_time_slot' => $request->input('preferred_time_slot'),
                'is_urgent' => $request->boolean('is_urgent', false),
                'priority' => $request->boolean('is_urgent') ? 'high' : $request->input('priority', 'medium'),
                'status' => 'new',
                'created_by' => $user ? $user->name : $request->input('created_by', '匿名'),
            ]);

            // 處理附件
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $path = $file->store('ticket-attachments', 'public');
                    $ticket->attachments()->create([
                        'file_path' => $path,
                        'file_type' => str_starts_with($file->getMimeType(), 'image/') ? 'image' : 'document',
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                }
            }
        } else {
            // === 範本遮罩模式（保留原有邏輯）===
            $fieldValues = $request->input('field_values', []);
            $maskedFieldKeys = $request->input('masked_fields', []);
            $maskMethod = $request->input('mask_method', 'regex');

            $maskService = new MaskService();
            $aiService = $maskMethod === 'ai' ? new AiMaskService() : null;
            $customFields = CustomMaskField::all()->keyBy('label');

            $originalLines = [];
            $maskedLines = [];
            $stats = [];

            foreach ($fieldValues as $key => $value) {
                $label = $request->input("field_labels.{$key}", $key);
                $originalLines[] = "{$label}：{$value}";

                if (in_array($key, $maskedFieldKeys)) {
                    if ($customFields->has($label)) {
                        $cf = $customFields->get($label);
                        if ($cf->mask_type === 'full') {
                            $maskedValue = str_repeat('*', mb_strlen($value));
                        } else {
                            $keep = $cf->keep_chars;
                            $maskedValue = mb_substr($value, 0, $keep) . str_repeat('*', max(0, mb_strlen($value) - $keep));
                        }
                        $stats[$label] = ($stats[$label] ?? 0) + 1;
                    } else {
                        if ($maskMethod === 'ai' && $aiService) {
                            $result = $aiService->maskWithAi($value);
                            $maskedValue = $result['masked'];
                            if (!empty($result['detected'])) {
                                $stats[$label] = ($stats[$label] ?? 0) + count($result['detected']);
                            } else {
                                $maskedValue = $this->fallbackMask($value);
                                $stats[$label] = ($stats[$label] ?? 0) + 1;
                            }
                        } else {
                            $result = $maskService->mask($value);
                            $maskedValue = $result['masked'];
                            $totalCount = array_sum($result['stats']);
                            if ($totalCount > 0) {
                                $stats[$label] = ($stats[$label] ?? 0) + $totalCount;
                            } else {
                                $maskedValue = $this->fallbackMask($value);
                                $stats[$label] = ($stats[$label] ?? 0) + 1;
                            }
                        }
                    }
                    $maskedLines[] = "{$label}：{$maskedValue}";
                } else {
                    $maskedLines[] = "{$label}：{$value}";
                }
            }

            $ticket = Ticket::create([
                'ticket_no' => $ticketNo,
                'title' => $request->input('title', '未命名工單'),
                'original_text' => implode("\n", $originalLines),
                'masked_text' => implode("\n", $maskedLines),
                'stats' => $stats,
                'mask_method' => $maskMethod,
                'priority' => $request->input('priority', 'medium'),
                'purpose' => $request->input('purpose', '內部使用'),
                'created_by' => $user ? $user->name : $request->input('created_by', '匿名'),
                'status' => 'pending',
                'template_id' => $request->input('template_id'),
                'field_values' => $fieldValues,
                'masked_fields' => $maskedFieldKeys,
            ]);
        }

        // 指派使用者
        $assignedUserIds = $request->input('assigned_user_ids', []);
        if (!empty($assignedUserIds)) {
            $ticket->assignedUsers()->sync($assignedUserIds);
        }

        $ticket->load('assignedUsers:id,name');

        // LINE 推播通知管理員（僅公開報修時）
        if ($isRepairMode && !$user) {
            try {
                $lineService = new LineNotifyService();
                $adminLineIds = User::where('role', 'admin')
                    ->whereNotNull('line_user_id')
                    ->pluck('line_user_id')
                    ->toArray();

                if (!empty($adminLineIds)) {
                    $frontendUrl = 'https://ai-data-masker-production-fda9.up.railway.app';
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
                }
            } catch (\Exception $e) {
                \Log::warning('LINE 新報修通知失敗: ' . $e->getMessage());
            }
        }

        return response()->json([
            'message' => '工單建立成功',
            'ticket' => $ticket,
        ], 201);
    }

    /**
     * 查看單一工單詳情
     * GET /api/tickets/{id}
     */
    public function show(Request $request, $id)
    {
        $ticket = Ticket::with(['comments', 'assignedUsers:id,name', 'attachments', 'dispatchLogs'])->find($id);
        $user = $request->user();

        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        // 師傅視角：隱藏敏感資料，提供外勤版
        if ($user && $user->role === 'worker') {
            $ticket->makeHidden([
                'original_text',
                'field_values',
                'description_raw',
                'notes_internal',
            ]);

            // 客戶姓名遮罩：王大明 → 王先生
            if ($ticket->customer_name) {
                $ticket->customer_name = $this->maskName($ticket->customer_name);
            }
            // 電話不遮罩（師傅需聯絡客戶）
        }

        return response()->json($ticket);
    }

    /**
     * 更新工單（客服操作）
     * PATCH /api/tickets/{id}
     */
    public function update(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        $updatable = [
            'title',
            'status',
            'priority',
            'category',
            'description_summary',
            'scheduled_at',
            'notes_internal',
            'is_urgent',
            'assigned_to',
        ];

        foreach ($updatable as $field) {
            if ($request->has($field)) {
                $ticket->{$field} = $request->input($field);
            }
        }

        // 狀態為完工時記錄時間
        if ($request->input('status') === 'done') {
            $ticket->completed_at = now();
        }

        $ticket->save();

        // 更新指派
        if ($request->has('assigned_user_ids')) {
            $ticket->assignedUsers()->sync($request->input('assigned_user_ids'));
        }

        $ticket->load('assignedUsers:id,name');

        return response()->json([
            'message' => '工單更新成功',
            'ticket' => $ticket,
        ]);
    }

    /**
     * 產生外勤版派工內容 + 派工
     * POST /api/tickets/{id}/dispatch
     */
    public function dispatch(Request $request, $id)
    {
        $ticket = Ticket::with('assignedUsers')->find($id);
        $user = $request->user();

        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        // 產生外勤版內容（最小揭露）
        $payload = [
            'ticket_no' => $ticket->ticket_no,
            'category' => $ticket->category,
            'customer_name' => $this->maskName($ticket->customer_name),
            'phone' => $ticket->phone, // 電話完整給（需聯絡客戶）
            'address' => $ticket->address, // 地址完整給（需到場）
            'scheduled_at' => $ticket->scheduled_at?->format('m/d（D）H:i'),
            'preferred_time_slot' => $ticket->preferred_time_slot,
            'description' => $ticket->description_summary ?: $ticket->description_raw,
            'is_urgent' => $ticket->is_urgent,
            'notes' => '', // 內部備註不外發
        ];

        // 產生文字訊息
        $urgentTag = $ticket->is_urgent ? '🔴 急件' : '';
        $message = "【派工】{$ticket->ticket_no}（{$ticket->category}）{$urgentTag}\n";
        $message .= "時間：" . ($payload['scheduled_at'] ?: $payload['preferred_time_slot'] ?: '待定') . "\n";
        $message .= "客戶：{$payload['customer_name']}\n";
        $message .= "電話：{$payload['phone']}\n";
        $message .= "地址：{$payload['address']}\n";
        $message .= "問題：{$payload['description']}\n";
        $message .= "（由系統產生，請勿轉傳）";

        $payload['message'] = $message;

        // 記錄派工稽核
        $technicianIds = $ticket->assignedUsers->pluck('id')->toArray();
        if ($request->has('technician_ids')) {
            $technicianIds = $request->input('technician_ids');
            $ticket->assignedUsers()->sync($technicianIds);
        }

        DispatchLog::create([
            'ticket_id' => $ticket->id,
            'dispatcher_user_id' => $user->id,
            'technician_ids' => $technicianIds,
            'payload_snapshot' => $payload,
            'dispatched_at' => now(),
        ]);

        // 更新狀態為已派工
        $ticket->status = 'dispatched';
        $ticket->save();

        // LINE 推播通知師傅
        try {
            $lineService = new LineNotifyService();
            $lineUserIds = User::whereIn('id', $technicianIds)
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $lineService->notifyDispatch($payload, $lineUserIds);
        } catch (\Exception $e) {
            \Log::warning('LINE 派工通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '派工成功',
            'dispatch' => $payload,
        ]);
    }

    /**
     * 上傳附件
     * POST /api/tickets/{id}/attachments
     */
    public function uploadAttachment(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        $files = $request->file('attachments', []);
        $singleFile = $request->file('file');
        if ($singleFile)
            $files = [$singleFile];

        if (empty($files)) {
            return response()->json(['message' => '請上傳檔案'], 422);
        }

        $type = $request->input('type', 'photo');
        $uploaded = [];

        foreach ($files as $file) {
            $path = $file->store('ticket-attachments', 'public');
            $uploaded[] = $ticket->attachments()->create([
                'file_path' => $path,
                'file_type' => $type,
                'original_name' => $file->getClientOriginalName(),
            ]);
        }

        return response()->json([
            'message' => count($uploaded) . ' 個檔案上傳成功',
            'attachments' => $uploaded,
        ], 201);
    }

    /**
     * 更新工單狀態
     * PATCH /api/tickets/{id}/status
     */
    public function updateStatus(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        $newStatus = $request->input('status');
        $ticket->status = $newStatus;
        if ($newStatus === 'done' || $newStatus === 'completed') {
            $ticket->completed_at = now();
        }
        $ticket->save();

        // LINE 推播通知
        try {
            $lineService = new LineNotifyService();
            $user = $request->user();

            if ($newStatus === 'done') {
                // 完工 → 通知管理員
                $adminLineIds = User::where('role', 'admin')
                    ->whereNotNull('line_user_id')
                    ->pluck('line_user_id')
                    ->toArray();
                $lineService->notifyCompletion(
                    $ticket->ticket_no,
                    $user ? $user->name : '師傅',
                    $adminLineIds
                );
            } elseif ($newStatus === 'closed') {
                // 結案 → 通知客戶（如有 LINE ID）
                // 未來可擴充：透過客戶 LINE ID 通知
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 狀態通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '狀態更新成功',
            'ticket' => $ticket,
        ]);
    }

    /**
     * 新增留言
     * POST /api/tickets/{id}/comments
     */
    public function addComment(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        $user = $request->user();

        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        $comment = $ticket->comments()->create([
            'author' => $user ? $user->name : $request->input('author', '匿名'),
            'content' => $request->input('content', ''),
        ]);

        return response()->json([
            'message' => '留言成功',
            'comment' => $comment,
        ], 201);
    }

    /**
     * 公開：根據手機號碼 + 維修編號 查詢工單進度
     * GET /api/tickets/track?phone=0912345678&ticket_no=TK-xxx
     */
    public function trackByPhone(Request $request)
    {
        $phone = $request->input('phone', '');
        $ticketNo = $request->input('ticket_no', '');

        if (strlen($phone) < 8) {
            return response()->json(['message' => '請輸入完整的手機號碼'], 422);
        }
        if (empty($ticketNo)) {
            return response()->json(['message' => '請輸入維修編號'], 422);
        }

        $tickets = Ticket::where('phone', $phone)
            ->where('ticket_no', $ticketNo)
            ->latest()
            ->limit(20)
            ->get(['id', 'ticket_no', 'category', 'title', 'status', 'created_at', 'completed_at', 'description_raw']);

        // 只回傳公開安全的欄位
        $tickets->each(function ($t) {
            $t->makeHidden(['description_raw']);
            $t->description = $t->description_raw ? mb_substr($t->description_raw, 0, 50) : '';
        });

        return response()->json([
            'tickets' => $tickets,
        ]);
    }

    /**
     * 公開：查看單筆工單詳情（遮罩版）
     * GET /api/tickets/track/{id}?phone=xxx&ticket_no=xxx
     */
    public function trackDetail(Request $request, $id)
    {
        $phone = $request->input('phone', '');
        $ticketNo = $request->input('ticket_no', '');

        // 雙重驗證：手機 + 編號都要符合
        $ticket = Ticket::where('id', $id)
            ->where('phone', $phone)
            ->where('ticket_no', $ticketNo)
            ->first();

        if (!$ticket) {
            return response()->json(['message' => '找不到此工單，或驗證資訊不符'], 404);
        }

        // 公開版：客戶安全遮罩
        return response()->json([
            'ticket' => [
                'id' => $ticket->id,
                'ticket_no' => $ticket->ticket_no,
                'category' => $ticket->category,
                'title' => $ticket->title,
                'status' => $ticket->status,
                'customer_name' => $this->maskName($ticket->customer_name),
                'phone' => $this->maskPhone($ticket->phone),
                'address' => $this->maskAddress($ticket->address),
                'description' => $ticket->description_raw ? mb_substr($ticket->description_raw, 0, 80) : '',
                'preferred_time_slot' => $ticket->preferred_time_slot,
                'is_urgent' => $ticket->is_urgent,
                'created_at' => $ticket->created_at,
                'completed_at' => $ticket->completed_at,
                'updated_at' => $ticket->updated_at,
            ],
        ]);
    }

    // === 遮罩工具 ===

    /** 姓名遮罩：王大明 → 王先生/王小姐 */
    private function maskName(?string $name): string
    {
        if (!$name)
            return '客戶';
        $surname = mb_substr($name, 0, 1);
        return "{$surname}先生/小姐";
    }

    /** 電話半遮罩：0912345678 → 0912***678 */
    private function maskPhone(?string $phone): string
    {
        if (!$phone)
            return '';
        $len = strlen($phone);
        if ($len <= 4)
            return $phone;
        return substr($phone, 0, 4) . '***' . substr($phone, -3);
    }

    /** 地址遮罩：台北市大安區忠孝東路三段123號 → 台北市大安區*** */
    private function maskAddress(?string $address): string
    {
        if (!$address)
            return '';
        // 嘗試匹配「XX市/縣 XX區/鎮/鄉」
        if (preg_match('/^(.{2,3}[市縣].{2,3}[區鎮鄉市])/', $address, $matches)) {
            return $matches[1] . '***';
        }
        // fallback：只顯示前 6 個字
        $len = mb_strlen($address);
        if ($len <= 6)
            return '***';
        return mb_substr($address, 0, 6) . '***';
    }

    /** 通用 fallback 遮罩 */
    private function fallbackMask(string $value): string
    {
        $len = mb_strlen($value);
        if ($len <= 2)
            return '***';
        return mb_substr($value, 0, 1) . str_repeat('*', $len - 2) . mb_substr($value, -1);
    }
}
