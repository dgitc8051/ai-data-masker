<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Ticket;
use App\Models\User;
use App\Models\DispatchLog;
use App\Models\TicketAttachment;
use App\Models\CustomMaskField;
use App\Services\MaskService;
use App\Services\AiMaskService;
use App\Services\LineNotifyService;
use Illuminate\Support\Facades\DB;

class TicketController extends Controller
{
    /**
     * 取得工單列表
     * GET /api/tickets
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Ticket::with([
            'assignedUsers' => function ($q) {
                $q->select('users.id', 'users.name')->withPivot('role');
            }
        ])->latest();

        // 師傅看：被指派給自己的 + 已派工但尚未接案的（搶單用）
        if ($user && $user->role === 'worker') {
            $query->where(function ($q) use ($user) {
                $q->whereHas('assignedUsers', function ($q2) use ($user) {
                    $q2->where('users.id', $user->id);
                })->orWhere(function ($q2) {
                    $q2->where('status', 'dispatched')
                        ->whereNull('accepted_at');
                });
            });
        }

        // 狀態篩選
        if ($request->has('status') && $request->status !== 'all') {
            if ($request->status === 'unaccepted') {
                // 虛擬篩選：已派工但未接案
                $query->where('status', 'dispatched')->whereNull('accepted_at');
            } else {
                $query->where('status', $request->status);
            }
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

        // 附加 primary_technician 讓前端判斷狀態（有指派師傅=已派工，無指派=未接案）
        $tickets->each(function ($ticket) {
            $primary = $ticket->assignedUsers->first();
            $ticket->primary_technician = $primary ? ['id' => $primary->id, 'name' => $primary->name] : null;
        });

        return response()->json($tickets);
    }

    /**
     * 建立新工單
     * POST /api/tickets
     * 支援兩種模式：報修 (category) / 範本遮罩 (field_values)
     */
    public function store(Request $request)
    {
        \Log::debug('[store] ===== START =====');
        \Log::debug('[store] IP: ' . $request->ip() . ', Content-Type: ' . $request->header('Content-Type'));
        \Log::debug('[store] category: ' . $request->input('category') . ', hasFile: ' . ($request->hasFile('attachments') ? 'yes' : 'no'));

        $user = $request->user();

        // 驗證附件大小（單檔最大 10MB）
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $sizeMB = round($file->getSize() / 1024 / 1024, 1);
                if ($file->getSize() > 10 * 1024 * 1024) {
                    return response()->json([
                        'message' => "照片 {$file->getClientOriginalName()} 太大（{$sizeMB}MB），請壓縮到 10MB 以下再上傳",
                    ], 422);
                }
            }
        }

        // 產生工單編號（短格式：TK2502150001）—— 使用 DB 交易鎖防止並發重複
        $today = now()->format('ymd');
        $ticketNo = DB::transaction(function () use ($today) {
            $lastTicket = Ticket::where('ticket_no', 'like', "TK{$today}%")
                ->lockForUpdate()
                ->orderBy('ticket_no', 'desc')
                ->first();
            $nextNumber = $lastTicket ? (int) substr($lastTicket->ticket_no, -4) + 1 : 1;
            return "TK{$today}" . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
        });

        $isRepairMode = $request->has('category');

        if ($isRepairMode) {
            // === 報修模式 ===
            $ticket = Ticket::create([
                'ticket_no' => $ticketNo,
                'title' => $request->input('title', '報修單'),
                'category' => $request->input('category'),
                'customer_name' => $request->input('customer_name'),
                'phone' => $request->input('phone'),
                'customer_line_id' => $request->input('customer_line_id'),
                'address' => $request->input('address'),
                'description_raw' => $request->input('description'),
                'preferred_time_slot' => $request->input('preferred_time_slot'),
                'customer_preferred_slots' => $this->formatPreferredSlots($request->input('customer_preferred_slots')),
                'is_urgent' => $request->boolean('is_urgent', false),
                'priority' => $request->boolean('is_urgent') ? 'high' : $request->input('priority', 'medium'),
                'status' => 'new',
                'source' => ($user && $user->role === 'admin') ? 'admin' : 'line',
                'created_by' => $user ? ($user->role === 'admin' ? $user->name . '(客服代建)' : $user->name) : ($request->input('customer_name', '匿名') . '(客戶)'),
            ]);

            // 同步更新 LINE 客戶名冊（用於回頭客自動帶入）
            if ($request->input('customer_line_id')) {
                \App\Models\LineCustomer::where('line_user_id', $request->input('customer_line_id'))
                    ->update([
                        'customer_name' => $request->input('customer_name'),
                        'phone' => $request->input('phone'),
                        'address' => $request->input('address'),
                    ]);
            }

            // 處理附件（存入資料庫）
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $this->storeAttachmentToDb($ticket, $file, str_starts_with($file->getMimeType(), 'image/') ? 'image' : 'document');
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

        // LINE 推播通知（用背景程序執行，不阻塞 HTTP response）
        if ($isRepairMode) {
            $artisanPath = base_path('artisan');
            $cmd = sprintf('php %s notify:repair %d > /dev/null 2>&1 &', $artisanPath, $ticket->id);
            \Log::info('[store] Launching background notification: ' . $cmd);
            exec($cmd);
        }

        \Log::info('[store] Returning response for ticket: ' . $ticket->ticket_no);
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

        // 加入主師傅 / 協助人員 / 是否為主師傅
        $primary = $ticket->primaryTechnician();
        $assistants = $ticket->assistants();
        $ticketData = $ticket->toArray();
        $ticketData['primary_technician'] = $primary ? ['id' => $primary->id, 'name' => $primary->name, 'phone' => $primary->phone] : null;
        $ticketData['assistants'] = $assistants->map(fn($a) => ['id' => $a->id, 'name' => $a->name])->values();
        $ticketData['is_primary'] = $user && $primary && $user->id === $primary->id;

        return response()->json($ticketData);
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
            // 注意：'status' 不在此列表，狀態變更必須透過 updateStatus() 以保護狀態流
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

        // 產生日曆時段顯示
        $urgentTag = $ticket->is_urgent ? '🔴 急件' : '';
        $calendarSlots = '';
        if (!empty($ticket->customer_preferred_slots)) {
            $calendarSlots = collect($ticket->customer_preferred_slots)
                ->map(fn($s) => "  • {$s['label']}")
                ->join("\n");
        }
        $timeDisplay = $payload['scheduled_at'] ?: ($calendarSlots ?: $payload['preferred_time_slot'] ?: '待定');
        $message = "【派工】{$ticket->ticket_no}（{$ticket->category}）{$urgentTag}\n";
        $message .= "時間：" . ($payload['scheduled_at'] ?: $payload['preferred_time_slot'] ?: '待定') . "\n";
        if ($calendarSlots) {
            $message .= "客戶偏好時段：\n{$calendarSlots}\n";
        }
        $message .= "客戶：{$payload['customer_name']}\n";
        $message .= "電話：{$payload['phone']}\n";
        $message .= "地址：{$payload['address']}\n";
        $message .= "問題：{$payload['description']}\n";
        $message .= "（由系統產生，請勿轉傳）";

        $payload['message'] = $message;

        // 記錄派工稽核
        $primaryId = $request->input('primary_technician_id');
        // 向下相容舊格式
        if (!$primaryId && $request->has('technician_ids')) {
            $ids = $request->input('technician_ids');
            $primaryId = is_array($ids) && count($ids) > 0 ? $ids[0] : null;
        }

        $technicianIds = $primaryId ? [$primaryId] : [];

        if ($primaryId) {
            $ticket->assignedUsers()->sync([
                $primaryId => ['role' => 'primary'],
            ]);
        } else {
            $ticket->assignedUsers()->sync([]);
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

        // LINE 推播通知
        try {
            $lineService = new LineNotifyService();

            if (!empty($technicianIds)) {
                // 有指派 → 通知被指派的師傅（完整資訊）
                $lineUserIds = User::whereIn('id', $technicianIds)
                    ->whereNotNull('line_user_id')
                    ->pluck('line_user_id')
                    ->toArray();
                $lineService->notifyDispatch($payload, $lineUserIds);
                // 客服代客預約額外提示
                if ($ticket->source === 'admin') {
                    $lineService->pushToMultiple($lineUserIds, "📌 此單為客服代客預約\n客戶無 LINE，請主動電話聯繫：{$ticket->phone}");
                }
            } else {
                // 未指派 → 通知所有師傅（搶單，隱藏敏感資訊）
                $allWorkerLineIds = User::where('role', 'worker')
                    ->whereNotNull('line_user_id')
                    ->pluck('line_user_id')
                    ->toArray();

                if (!empty($allWorkerLineIds)) {
                    // 只顯示區域（取地址前面的縣市區）
                    $area = mb_substr($ticket->address ?? '', 0, 6) . '...';

                    $grabMsg = "🔔【新案件可搶單】{$ticket->ticket_no}（{$ticket->category}）{$urgentTag}\n";
                    if ($calendarSlots) {
                        $grabMsg .= "客戶偏好時段：\n{$calendarSlots}\n";
                    } elseif ($payload['preferred_time_slot'] && $payload['preferred_time_slot'] !== '待定') {
                        $grabMsg .= "偏好時段：{$payload['preferred_time_slot']}\n";
                    }
                    $grabMsg .= "區域：{$area}\n";
                    $grabMsg .= "問題：{$payload['description']}\n";
                    if ($ticket->source === 'admin') {
                        $grabMsg .= "📌 客服代客預約（客戶無 LINE，請電話聯繫）\n";
                    }
                    $grabMsg .= "👉 請至工單系統接案\n";
                    $grabMsg .= "（先搶先得，請盡速處理）";

                    foreach ($allWorkerLineIds as $lid) {
                        $lineService->pushMessage($lid, $grabMsg);
                    }
                }
            }
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
            $uploaded[] = $this->storeAttachmentToDb($ticket, $file, $type);
        }

        return response()->json([
            'message' => count($uploaded) . ' 個檔案上傳成功',
            'attachments' => $uploaded,
        ], 201);
    }

    /**
     * 將上傳檔案存入資料庫
     */
    private function storeAttachmentToDb(Ticket $ticket, $file, string $type = 'photo'): TicketAttachment
    {
        return $ticket->attachments()->create([
            'file_path' => 'db-stored/' . uniqid() . '_' . $file->getClientOriginalName(),
            'file_data' => file_get_contents($file->getRealPath()),
            'mime_type' => $file->getMimeType(),
            'file_type' => $type,
            'original_name' => $file->getClientOriginalName(),
        ]);
    }

    /**
     * 從資料庫讀取附件圖片
     * GET /api/attachments/{id}/image
     */
    public function serveAttachment($id)
    {
        $att = TicketAttachment::find($id);
        if (!$att || !$att->file_data) {
            // 降級：嘗試從檔案系統讀取（相容舊資料）
            if ($att && $att->file_path && \Storage::disk('public')->exists($att->file_path)) {
                return response(\Storage::disk('public')->get($att->file_path))
                    ->header('Content-Type', $att->mime_type ?? 'image/jpeg')
                    ->header('Cache-Control', 'public, max-age=86400');
            }
            abort(404);
        }

        return response($att->file_data)
            ->header('Content-Type', $att->mime_type ?? 'image/jpeg')
            ->header('Cache-Control', 'public, max-age=86400')
            ->header('Content-Disposition', 'inline; filename="' . ($att->original_name ?? 'image.jpg') . '"');
    }

    /**
     * 合法狀態轉換表
     */
    private const STATUS_TRANSITIONS = [
        'new' => ['need_more_info', 'dispatched', 'cancelled'],
        'need_more_info' => ['new', 'info_submitted', 'dispatched', 'cancelled'],
        'info_submitted' => ['need_more_info', 'dispatched', 'cancelled'],
        'dispatched' => ['time_proposed', 'reschedule', 'cancelled'],
        'time_proposed' => ['in_progress', 'reschedule', 'dispatched', 'cancelled'],
        'reschedule' => ['dispatched', 'time_proposed', 'cancelled'],
        'in_progress' => ['done', 'reschedule', 'cancelled'],
        'done' => ['closed'],
        'closed' => [],
        'cancelled' => ['new'],  // 取消後可重新開單
    ];

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

        $user = $request->user();
        $newStatus = $request->input('status');
        $force = $request->boolean('force', false);

        // 狀態流保護（管理員可用 force 跳過）
        if (!$force || ($user && $user->role !== 'admin')) {
            $allowed = self::STATUS_TRANSITIONS[$ticket->status] ?? [];
            if (!in_array($newStatus, $allowed)) {
                return response()->json([
                    'message' => "不允許從「{$ticket->status}」變更為「{$newStatus}」",
                    'allowed' => $allowed,
                ], 422);
            }
        }

        $ticket->status = $newStatus;

        if ($newStatus === 'done' || $newStatus === 'completed') {
            $ticket->completed_at = now();
            if ($request->has('completion_note')) {
                $ticket->completion_note = $request->input('completion_note');
            }
            if ($request->has('actual_amount')) {
                $ticket->actual_amount = $request->input('actual_amount');
            }
        }

        // 待補件 → 記錄補件說明
        if ($newStatus === 'need_more_info' && $request->has('supplement_note')) {
            $ticket->supplement_note = $request->input('supplement_note');
        }

        // 取消
        if ($newStatus === 'cancelled') {
            $ticket->cancelled_at = now();
            $ticket->cancelled_by_role = $user ? $user->role : 'customer';
            $ticket->cancelled_by_name = $user ? $user->name : ($request->input('customer_name') ?? '客戶');
            $ticket->cancel_reason = $request->input('cancel_reason', '');
        }

        $ticket->save();

        // LINE 推播通知
        try {
            $lineService = new LineNotifyService();

            if ($newStatus === 'done') {
                // 完工 → 通知管理員
                $adminLineIds = User::where('role', 'admin')
                    ->whereNotNull('line_user_id')
                    ->pluck('line_user_id')
                    ->toArray();
                $workerName = $user ? $user->name : '師傅';
                $amountInfo = $ticket->actual_amount ? "，實收 \${$ticket->actual_amount}" : '';
                $noteInfo = $ticket->completion_note ? "\n說明：{$ticket->completion_note}" : '';
                $lineService->pushToMultiple(
                    $adminLineIds,
                    "✅ {$ticket->ticket_no} 已完工\n師傅：{$workerName}{$amountInfo}{$noteInfo}"
                );
                // 完工 → 也通知客戶
                if ($ticket->customer_line_id) {
                    $customerAmount = $ticket->actual_amount ? "💰 費用：\${$ticket->actual_amount} 元\n" : '';
                    $lineService->pushMessage(
                        $ticket->customer_line_id,
                        "🎉 您的維修單 {$ticket->ticket_no} 已完工！\n\n"
                        . "師傅：{$workerName}\n"
                        . $customerAmount
                        . ($ticket->completion_note ? "說明：{$ticket->completion_note}\n\n" : "\n")
                        . "感謝您的耐心等候，如有問題請隨時聯繫我們。"
                    );
                }
            }

            // 已派工 → 通知客戶
            if ($newStatus === 'dispatched' && $ticket->customer_line_id) {
                $workerInfo = $ticket->assignedUsers->map(function ($w) {
                    return $w->phone ? "{$w->name}（{$w->phone}）" : $w->name;
                })->join('、') ?: '維修師傅';
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "👷 您的維修單 {$ticket->ticket_no} 已派工！\n\n"
                    . "負責師傅：{$workerInfo}\n"
                    . "我們會盡快與您聯繫安排時間。"
                );
            }

            // 處理中 → 通知客戶
            if ($newStatus === 'in_progress' && $ticket->customer_line_id) {
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "🔧 您的維修單 {$ticket->ticket_no} 師傅已開始處理！\n\n"
                    . "維修進行中，完工後將通知您。"
                );
            }

            // 待補件 → 通知客戶
            if ($newStatus === 'need_more_info' && $ticket->customer_line_id) {
                $frontendUrl = env('FRONTEND_URL', 'https://ai-data-masker-production-fda9.up.railway.app');
                $supplementNote = $ticket->supplement_note ? "\n\n📝 需補充：\n{$ticket->supplement_note}" : '';
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "📋 您的維修單 {$ticket->ticket_no} 需要補充資料{$supplementNote}\n\n"
                    . "請點擊以下連結補充：\n{$frontendUrl}/track\n\n"
                    . "輸入維修編號和手機號碼後即可編輯。"
                );
            }

            // 取消 → 通知所有相關方
            if ($newStatus === 'cancelled') {
                $cancellerName = $ticket->cancelled_by_name;
                $reason = $ticket->cancel_reason ?: '未提供';
                $msg = "❌ {$ticket->ticket_no} 已取消\n取消者：{$cancellerName}\n原因：{$reason}";
                $adminLineIds = User::where('role', 'admin')
                    ->whereNotNull('line_user_id')
                    ->pluck('line_user_id')
                    ->toArray();
                $lineService->pushToMultiple($adminLineIds, $msg);
                $workerLineIds = $ticket->assignedUsers()
                    ->whereNotNull('line_user_id')
                    ->pluck('line_user_id')
                    ->toArray();
                if (!empty($workerLineIds)) {
                    $lineService->pushToMultiple($workerLineIds, $msg);
                }
                if ($ticket->customer_line_id) {
                    $lineService->pushMessage($ticket->customer_line_id, $msg);
                }
            }

            // 結案 → 通知客戶
            if ($newStatus === 'closed' && $ticket->customer_line_id) {
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "🎊 您的維修單 {$ticket->ticket_no} 已結案！\n\n"
                    . "感謝您使用我們的服務，如有任何問題歡迎隨時聯繫。\n"
                    . "祝您生活愉快！"
                );
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
     * 師傅接案（含選定維修時間）
     * POST /api/tickets/{id}/accept
     * body: { selected_time: "2025-02-17 15:00" }
     */
    public function acceptTicket(Request $request, $id)
    {
        $ticket = Ticket::with('assignedUsers')->find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        $user = $request->user();

        // 強制要求師傅手機號碼
        if (empty($user->phone)) {
            return response()->json([
                'message' => '請先設定手機號碼才能接案。請在 LINE 輸入「設定電話 09xxxxxxxx」',
                'error_type' => 'phone_required',
            ], 422);
        }

        if ($ticket->status !== 'dispatched') {
            return response()->json(['message' => '此工單目前無法接案'], 422);
        }

        // 要求選定維修時間
        $request->validate([
            'selected_time' => 'required|string',
        ]);

        $selectedTime = $request->input('selected_time');

        // 更新狀態（待客戶確認，不是直接進 in_progress）
        $ticket->status = 'time_proposed';
        $ticket->accepted_at = now();
        $ticket->worker_selected_slot = [
            'datetime' => $selectedTime,
            'label' => $selectedTime,
            'selected_by' => 'worker',
            'selected_by_name' => $user->name,
            'selected_at' => now()->toISOString(),
        ];
        $ticket->save();

        // 如果未指派，自動指派給接案師傅（搶單 → 自動成為主師傅）
        if ($ticket->assignedUsers->isEmpty()) {
            $ticket->assignedUsers()->attach($user->id, ['role' => 'primary']);
        } else {
            // 已指派的情況，確認是主師傅才能接案
            $primary = $ticket->primaryTechnician();
            if ($primary && $primary->id !== $user->id) {
                return response()->json(['message' => '只有主師傅可以接案'], 403);
            }
        }

        // LINE 通知管理員 + 客戶
        try {
            $lineService = new LineNotifyService();
            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $lineService->pushToMultiple(
                $adminLineIds,
                "📥 {$ticket->ticket_no} 已接案\n師傅：{$user->name}（{$user->phone}）\n🗓️ 預定時間：{$selectedTime}\n⏳ 等待客戶確認中"
            );

            // 通知客戶：師傅已接案 + 確切時間 + 車馬費說明 + 確認連結
            $frontendUrl = env('FRONTEND_URL', 'https://ai-data-masker-production-fda9.up.railway.app');
            $pricingUrl = $frontendUrl . '/pricing';
            $confirmUrl = $frontendUrl . '/track';

            if ($ticket->customer_line_id) {
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "📋 您的維修單 {$ticket->ticket_no} 已安排！\n\n"
                    . "👨‍🔧 師傅：{$user->name}\n"
                    . "📞 師傅電話：{$user->phone}\n"
                    . "🗓️ 維修時間：{$selectedTime}\n\n"
                    . "⚠️ 師傅到場後若不維修，須酌收基礎檢測費，\n"
                    . "　詳見費用說明：{$pricingUrl}\n\n"
                    . "👉 請確認或取消：\n{$confirmUrl}\n"
                    . "輸入維修編號和手機號碼即可操作。"
                );
            } else {
                // 無 LINE ID（代客建單）→ 通知管理員代為確認
                $lineService->pushToMultiple(
                    $adminLineIds,
                    "📌 {$ticket->ticket_no} 為代客建單，客戶無 LINE\n請客服電話聯繫客戶確認：\n📞 {$ticket->phone}\n🗓️ 時間：{$selectedTime}"
                );
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 接案通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '已接案',
            'ticket' => $ticket,
        ]);
    }

    /**
     * 師傅提交報價
     * POST /api/tickets/{id}/quote
     */
    public function submitQuote(Request $request, $id)
    {
        $request->validate([
            'quoted_amount' => 'required|numeric|min:0',
            'description' => 'nullable|string',
        ]);

        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        if ($ticket->status !== 'in_progress') {
            return response()->json(['message' => '目前狀態不允許修改報價，僅處理中可修改'], 422);
        }

        $user = $request->user();

        // 只有主師傅可以報價
        $primary = $ticket->primaryTechnician();
        if ($user && $user->role === 'worker' && $primary && $primary->id !== $user->id) {
            return response()->json(['message' => '只有主師傅可以報價'], 403);
        }
        $ticket->quoted_amount = $request->input('quoted_amount');
        $ticket->quote_confirmed_at = null; // 重置確認狀態
        if ($request->has('description') && $request->input('description')) {
            $ticket->description_summary = $request->input('description');
        }
        $ticket->save();

        // LINE 通知管理員 + 客戶
        try {
            $lineService = new LineNotifyService();
            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $lineService->pushToMultiple(
                $adminLineIds,
                "💰 {$ticket->ticket_no} 預估費用\n金額：\${$ticket->quoted_amount}\n師傅：{$user->name}"
            );

            // 通知客戶：有報價了，請確認
            if ($ticket->customer_line_id) {
                $frontendUrl = env('FRONTEND_URL', 'https://ai-data-masker-production-fda9.up.railway.app');
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "💰 您的維修單 {$ticket->ticket_no} 已有預估費用！\n\n"
                    . "預估費用：\${$ticket->quoted_amount}\n\n"
                    . "請點擊以下連結確認：\n{$frontendUrl}/track\n"
                    . "輸入維修編號和手機號碼後即可確認。"
                );
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 報價通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '預估費用已記錄，等待客戶確認',
            'ticket' => $ticket,
        ]);
    }

    /**
     * 客戶確認報價（公開 API）
     * POST /api/tickets/track/{id}/confirm-quote
     */
    public function confirmQuote(Request $request, $id)
    {
        $ticket = $this->findTrackTicket($request, $id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單，或驗證資訊不符'], 404);
        }

        if (!$ticket->quoted_amount) {
            return response()->json(['message' => '尚無報價可確認'], 422);
        }

        if ($ticket->quote_confirmed_at) {
            return response()->json(['message' => '已確認過報價'], 422);
        }

        $ticket->quote_confirmed_at = now();
        $ticket->save();

        // LINE 通知管理員 + 師傅
        try {
            $lineService = new LineNotifyService();
            // 通知管理員
            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            // 通知指派的師傅
            $workerLineIds = $ticket->assignedUsers()
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $allIds = array_unique(array_merge($adminLineIds, $workerLineIds));
            $lineService->pushToMultiple(
                $allIds,
                "✅ {$ticket->ticket_no} 客戶已確認報價 \${$ticket->quoted_amount}\n可開始施工"
            );
        } catch (\Exception $e) {
            \Log::warning('LINE 確認報價通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '報價已確認',
            'ticket' => [
                'id' => $ticket->id,
                'quote_confirmed_at' => $ticket->quote_confirmed_at,
            ],
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
        $lineUserId = $request->input('line_user_id', '');
        $phone = $request->input('phone', '');
        $ticketNo = $request->input('ticket_no', '');

        // 驗證方式 1: LINE User ID（更安全）
        // 驗證方式 2: 手機 + 編號（傳統方式）
        if ($lineUserId) {
            $ticket = Ticket::where('id', $id)
                ->where('customer_line_id', $lineUserId)
                ->first();
        } else {
            $ticket = Ticket::where('id', $id)
                ->where('phone', $phone)
                ->where('ticket_no', $ticketNo)
                ->first();
        }

        if (!$ticket) {
            return response()->json(['message' => '找不到此工單，或驗證資訊不符'], 404);
        }

        // 公開版：客戶安全遮罩
        $ticketData = [
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
            'supplement_note' => $ticket->supplement_note,
            'quoted_amount' => $ticket->quoted_amount,
            'actual_amount' => $ticket->actual_amount,
            'quote_confirmed_at' => $ticket->quote_confirmed_at,
            'proposed_time_slots' => $ticket->proposed_time_slots,
            'confirmed_time_slot' => $ticket->confirmed_time_slot,
            'confirmed_by' => $ticket->confirmed_by,
            'time_confirmed_at' => $ticket->time_confirmed_at,
            // 日曆排程
            'customer_preferred_slots' => $ticket->customer_preferred_slots,
            'worker_selected_slot' => $ticket->worker_selected_slot,
            'reschedule_count' => $ticket->reschedule_count ?? 0,
            'reschedule_history' => $ticket->reschedule_history,
            'cancelled_at' => $ticket->cancelled_at,
            'cancelled_by_name' => $ticket->cancelled_by_name,
            'cancel_reason' => $ticket->cancel_reason,
            'created_at' => $ticket->created_at,
            'completed_at' => $ticket->completed_at,
            'updated_at' => $ticket->updated_at,
        ];

        // 附件照片（含完整 URL）
        $ticket->load('attachments');
        $ticketData['attachments'] = $ticket->attachments->map(function ($att) {
            return [
                'id' => $att->id,
                'file_path' => $att->file_path,
                'file_url' => url('api/attachments/' . $att->id . '/image'),
                'file_type' => $att->file_type,
                'original_name' => $att->original_name,
            ];
        })->toArray();

        // 待補件時回傳完整可編輯資料（不遮罩）
        if ($ticket->status === 'need_more_info') {
            $ticketData['editable'] = true;
            $ticketData['customer_name'] = $ticket->customer_name;
            $ticketData['phone_raw'] = $ticket->phone;
            $ticketData['address'] = $ticket->address;
            $ticketData['description'] = $ticket->description_raw ?? '';
            $ticketData['category'] = $ticket->category;
            $ticketData['preferred_time_slot'] = $ticket->preferred_time_slot;
            $ticketData['is_urgent'] = $ticket->is_urgent;
        }

        return response()->json([
            'ticket' => $ticketData,
        ]);
    }

    /**
     * 公開：用 LINE User ID 查詢所有工單
     * GET /api/tickets/track-by-line?line_user_id=Uxxx
     */
    public function trackByLineId(Request $request)
    {
        $lineUserId = $request->input('line_user_id', '');
        if (empty($lineUserId)) {
            return response()->json(['message' => 'LINE ID 未提供'], 422);
        }

        $tickets = Ticket::where('customer_line_id', $lineUserId)
            ->latest()
            ->limit(50)
            ->get(['id', 'ticket_no', 'category', 'title', 'status', 'created_at', 'completed_at', 'description_raw']);

        $tickets->each(function ($t) {
            $t->makeHidden(['description_raw']);
            $t->description = $t->description_raw ? mb_substr($t->description_raw, 0, 50) : '';
        });

        return response()->json([
            'tickets' => $tickets,
        ]);
    }

    /**
     * 公開：客戶補件
     * PATCH /api/tickets/track/{id}/supplement
     */
    public function supplementTicket(Request $request, $id)
    {
        $ticket = $this->findTrackTicket($request, $id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單，或驗證資訊不符'], 404);
        }

        if ($ticket->status !== 'need_more_info') {
            return response()->json(['message' => '此工單目前不接受補件'], 422);
        }

        // 更新可編輯欄位
        $updatable = ['customer_name', 'address', 'description_raw', 'category', 'preferred_time_slot'];
        foreach ($updatable as $field) {
            if ($request->has($field)) {
                $ticket->{$field} = $request->input($field);
            }
        }

        // 處理刪除舊照片
        if ($request->has('delete_attachment_ids')) {
            $deleteIds = $request->input('delete_attachment_ids');
            if (is_string($deleteIds)) {
                $deleteIds = json_decode($deleteIds, true) ?? [];
            }
            if (!empty($deleteIds)) {
                $attachments = $ticket->attachments()->whereIn('id', $deleteIds)->get();
                foreach ($attachments as $att) {
                    // 嘗試刪除舊檔案系統的檔案（相容舊資料）
                    if ($att->file_path && !str_starts_with($att->file_path, 'db-stored/')) {
                        \Storage::disk('public')->delete($att->file_path);
                    }
                    $att->delete();
                }
            }
        }

        // 處理新圖片上傳（存入資料庫）
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $this->storeAttachmentToDb($ticket, $file, 'photo');
            }
        }

        // 自動變更狀態為「補件完成待審核」
        $ticket->status = 'info_submitted';
        $ticket->save();

        // 通知管理員（背景執行，避免 LIFF timeout）
        try {
            $artisan = base_path('artisan');
            exec("php {$artisan} notify:supplement {$ticket->id} > /dev/null 2>&1 &");
        } catch (\Exception $e) {
            \Log::warning('啟動補件通知背景程序失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '補件送出成功，等待客服審核',
            'ticket' => [
                'id' => $ticket->id,
                'status' => $ticket->status,
            ],
        ]);
    }

    /**
     * 師傅提供多個可用時段
     * POST /api/tickets/{id}/propose-times
     */
    public function proposeTimeSlots(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        if ($ticket->status !== 'dispatched') {
            return response()->json(['message' => '此工單目前無法提供時段'], 422);
        }

        $request->validate([
            'time_slots' => 'required|array|min:1',
            'time_slots.*.date' => 'required|string',
            'time_slots.*.time' => 'required|string',
        ]);

        $ticket->proposed_time_slots = $request->input('time_slots');
        $ticket->status = 'time_proposed';
        $ticket->save();

        // LINE 通知客服 + 客戶
        try {
            $lineService = new LineNotifyService();
            $user = $request->user();
            $workerName = $user ? $user->name : '師傅';
            $slotCount = count($request->input('time_slots'));
            $slotList = collect($request->input('time_slots'))
                ->map(fn($s) => "  • {$s['date']} {$s['time']}")
                ->join("\n");

            $msg = "📅 {$ticket->ticket_no} 師傅已提供時段\n師傅：{$workerName}\n\n可用時段（{$slotCount}個）：\n{$slotList}\n\n請客戶確認。";

            // 通知管理員
            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $lineService->pushToMultiple($adminLineIds, $msg);

            // 通知客戶
            if ($ticket->customer_line_id) {
                $frontendUrl = env('FRONTEND_URL', 'https://ai-data-masker-production-fda9.up.railway.app');
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "📅 您的維修單 {$ticket->ticket_no}\n師傅已提供可用時段：\n{$slotList}\n\n"
                    . "請點擊以下連結選擇時間：\n{$frontendUrl}/track\n"
                    . "輸入維修編號和手機號碼後即可選擇。"
                );
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 時段通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '時段已提交',
            'ticket' => $ticket,
        ]);
    }

    /**
     * 客戶確認時段（公開 API）
     * POST /api/tickets/track/{id}/confirm-time
     */
    public function confirmTimeSlot(Request $request, $id)
    {
        $ticket = $this->findTrackTicket($request, $id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單，或驗證資訊不符'], 404);
        }

        if ($ticket->status !== 'time_proposed') {
            return response()->json(['message' => '此工單目前不接受時段確認'], 422);
        }

        $request->validate([
            'selected_slot' => 'required|string',
        ]);

        $ticket->confirmed_time_slot = $request->input('selected_slot');
        $ticket->confirmed_by = 'customer';
        $ticket->time_confirmed_at = now();
        $ticket->status = 'in_progress';
        $ticket->save();

        // LINE 通知師傅 + 客服
        try {
            $lineService = new LineNotifyService();
            $selectedSlot = $request->input('selected_slot');
            $msg = "✅ {$ticket->ticket_no} 客戶已確認時段\n確認時段：{$selectedSlot}";

            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $lineService->pushToMultiple($adminLineIds, $msg);

            $workerLineIds = $ticket->assignedUsers()
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            if (!empty($workerLineIds)) {
                $lineService->pushToMultiple($workerLineIds, $msg);
            }

            // 通知客戶：確認成功
            if ($ticket->customer_line_id) {
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "✅ 您的維修單 {$ticket->ticket_no} 時段確認成功！\n\n"
                    . "確認時段：{$selectedSlot}\n\n"
                    . "師傅將在約定時間到場，請確保有人在場。"
                );
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 確認時段通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '時段確認成功',
            'ticket' => [
                'id' => $ticket->id,
                'status' => $ticket->status,
                'confirmed_time_slot' => $ticket->confirmed_time_slot,
            ],
        ]);
    }

    // =================================================================
    //  日曆排程系統 — 新 API
    // =================================================================

    /**
     * 師傅從客戶偏好中選擇 1 個時段
     * POST /api/tickets/{id}/worker-select-slot
     */
    public function workerSelectSlot(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        if ($ticket->status !== 'dispatched' && $ticket->status !== 'reschedule') {
            return response()->json(['message' => '此工單目前無法選擇時段'], 422);
        }

        $request->validate([
            'selected_index' => 'required|integer|min:0',
        ]);

        $preferredSlots = $ticket->customer_preferred_slots ?? [];
        $selectedIndex = $request->input('selected_index');

        if ($selectedIndex >= count($preferredSlots)) {
            return response()->json(['message' => '選擇的時段不存在'], 422);
        }

        $selectedSlot = $preferredSlots[$selectedIndex];
        $user = $request->user();

        $ticket->worker_selected_slot = [
            'date' => $selectedSlot['date'],
            'period' => $selectedSlot['period'],
            'label' => $selectedSlot['label'] ?? "{$selectedSlot['date']} {$selectedSlot['period']}",
            'selected_by' => 'worker',
            'selected_by_name' => $user ? $user->name : '師傅',
            'selected_at' => now()->toISOString(),
        ];
        $ticket->status = 'time_proposed';
        $ticket->save();

        // LINE 通知客戶 + 客服
        try {
            $lineService = new LineNotifyService();
            $workerName = $user ? $user->name : '師傅';
            $slotLabel = $ticket->worker_selected_slot['label'];

            // 通知客服
            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $lineService->pushToMultiple(
                $adminLineIds,
                "📅 {$ticket->ticket_no} 師傅已選定時段\n師傅：{$workerName}\n選定：{$slotLabel}\n\n等待客戶確認。"
            );

            // 通知客戶
            if ($ticket->customer_line_id) {
                $frontendUrl = env('FRONTEND_URL', 'https://ai-data-masker-production-fda9.up.railway.app');
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "📅 您的維修單 {$ticket->ticket_no}\n師傅已選定維修時間：\n\n🗓️ {$slotLabel}\n\n"
                    . "請點擊以下連結確認：\n{$frontendUrl}/track\n\n"
                    . "輸入維修編號和手機號碼後即可確認或改期。"
                );
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 師傅選時段通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '時段選擇成功，等待客戶確認',
            'ticket' => [
                'id' => $ticket->id,
                'status' => $ticket->status,
                'worker_selected_slot' => $ticket->worker_selected_slot,
            ],
        ]);
    }

    /**
     * 客戶確認師傅選的時段（公開 API）
     * POST /api/tickets/track/{id}/customer-confirm-slot
     */
    public function customerConfirmSlot(Request $request, $id)
    {
        $ticket = $this->findTrackTicket($request, $id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單，或驗證資訊不符'], 404);
        }

        if ($ticket->status !== 'time_proposed') {
            return response()->json(['message' => '此工單目前不接受時段確認'], 422);
        }

        if (!$ticket->worker_selected_slot) {
            return response()->json(['message' => '師傅尚未選定時段'], 422);
        }

        $ticket->confirmed_time_slot = $ticket->worker_selected_slot['label'] ?? '';
        $ticket->confirmed_by = 'customer';
        $ticket->time_confirmed_at = now();
        $ticket->quote_confirmed_at = now(); // 一次確認時間＋費用
        $ticket->status = 'in_progress'; // 客戶確認後直接進入處理中
        $ticket->save();

        // LINE 通知師傅 + 客服
        try {
            $lineService = new LineNotifyService();
            $slotLabel = $ticket->confirmed_time_slot;
            $msg = "✅ {$ticket->ticket_no} 客戶已確認時段\n確認時段：{$slotLabel}\n\n請師傅準時到場。";

            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $lineService->pushToMultiple($adminLineIds, $msg);

            $workerLineIds = $ticket->assignedUsers()
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            if (!empty($workerLineIds)) {
                $lineService->pushToMultiple($workerLineIds, $msg);
            }

            // 通知客戶確認成功
            if ($ticket->customer_line_id) {
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "✅ 您的維修單 {$ticket->ticket_no} 時段已確認！\n\n"
                    . "🗓️ {$slotLabel}\n\n"
                    . "師傅將在約定時間到場，請確保有人在場。\n"
                    . "如需改期，請回到進度查詢頁面操作。"
                );
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 確認時段通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '時段確認成功',
            'ticket' => [
                'id' => $ticket->id,
                'status' => $ticket->status,
                'confirmed_time_slot' => $ticket->confirmed_time_slot,
            ],
        ]);
    }

    /**
     * 客戶發起改期（公開 API）
     * POST /api/tickets/track/{id}/reschedule
     */
    public function customerReschedule(Request $request, $id)
    {
        $ticket = $this->findTrackTicket($request, $id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單，或驗證資訊不符'], 404);
        }

        $reschedulable = ['time_proposed', 'scheduled'];
        if (!in_array($ticket->status, $reschedulable)) {
            return response()->json(['message' => '此工單目前無法改期'], 422);
        }

        // 改期次數上限
        if (($ticket->reschedule_count ?? 0) >= 3) {
            return response()->json(['message' => '改期已達上限（3次），請聯繫客服處理'], 422);
        }

        $request->validate([
            'reason' => 'required|string|min:2',
            'new_preferred_slots' => 'required|array|min:1|max:3',
            'new_preferred_slots.*.date' => 'required|date|after_or_equal:today',
            'new_preferred_slots.*.period' => 'required|string|in:morning,afternoon,evening',
        ]);

        // 記錄改期歷史
        $history = $ticket->reschedule_history ?? [];
        $history[] = [
            'round' => count($history) + 1,
            'initiated_by' => 'customer',
            'initiated_by_name' => $ticket->customer_name ?? '客戶',
            'reason' => $request->input('reason'),
            'original_slot' => $ticket->confirmed_time_slot ?? ($ticket->worker_selected_slot['label'] ?? '未定'),
            'new_preferred_slots' => $request->input('new_preferred_slots'),
            'created_at' => now()->toISOString(),
        ];

        // 格式化新偏好時段
        $periodLabels = ['morning' => '上午 09-12', 'afternoon' => '下午 13-17', 'evening' => '晚上 18-21'];
        $newSlots = collect($request->input('new_preferred_slots'))->map(function ($slot) use ($periodLabels) {
            $dateFormatted = date('n/j', strtotime($slot['date']));
            $dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date('w', strtotime($slot['date']))];
            return [
                'date' => $slot['date'],
                'period' => $slot['period'],
                'label' => "{$dateFormatted}（{$dayOfWeek}）{$periodLabels[$slot['period']]}",
            ];
        })->toArray();

        $ticket->reschedule_history = $history;
        $ticket->reschedule_count = ($ticket->reschedule_count ?? 0) + 1;
        $ticket->customer_preferred_slots = $newSlots;
        $ticket->worker_selected_slot = null;
        $ticket->confirmed_time_slot = null;
        $ticket->confirmed_by = null;
        $ticket->time_confirmed_at = null;
        $ticket->status = 'reschedule';
        $ticket->save();

        // LINE 通知師傅 + 客服
        try {
            $lineService = new LineNotifyService();
            $reason = $request->input('reason');
            $slotList = collect($newSlots)->map(fn($s) => "  • {$s['label']}")->join("\n");
            $msg = "🔄 {$ticket->ticket_no} 客戶申請改期（第{$ticket->reschedule_count}次）\n客戶：{$ticket->customer_name}\n原因：{$reason}\n\n新偏好時段：\n{$slotList}";

            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $lineService->pushToMultiple($adminLineIds, $msg);

            $workerLineIds = $ticket->assignedUsers()
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            if (!empty($workerLineIds)) {
                $lineService->pushToMultiple($workerLineIds, $msg);
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 改期通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '改期申請已送出',
            'ticket' => [
                'id' => $ticket->id,
                'status' => $ticket->status,
                'reschedule_count' => $ticket->reschedule_count,
            ],
        ]);
    }

    /**
     * 客服/師傅發起改期（認證 API）
     * POST /api/tickets/{id}/admin-reschedule
     */
    public function adminReschedule(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        $reschedulable = ['time_proposed', 'scheduled', 'in_progress', 'dispatched'];
        if (!in_array($ticket->status, $reschedulable)) {
            return response()->json(['message' => '此工單目前無法改期'], 422);
        }

        $request->validate([
            'reason' => 'required|string|min:2',
            'new_preferred_slots' => 'nullable|array|min:1|max:3',
            'new_preferred_slots.*.date' => 'required_with:new_preferred_slots|date|after_or_equal:today',
            'new_preferred_slots.*.period' => 'required_with:new_preferred_slots|string|in:morning,afternoon,evening',
        ]);

        $user = $request->user();
        $initiatedBy = $user->role === 'admin' ? 'admin' : 'worker';

        // 記錄改期歷史
        $history = $ticket->reschedule_history ?? [];
        $history[] = [
            'round' => count($history) + 1,
            'initiated_by' => $initiatedBy,
            'initiated_by_name' => $user->name,
            'reason' => $request->input('reason'),
            'original_slot' => $ticket->confirmed_time_slot ?? ($ticket->worker_selected_slot['label'] ?? '未定'),
            'new_preferred_slots' => $request->input('new_preferred_slots'),
            'created_at' => now()->toISOString(),
        ];

        $ticket->reschedule_history = $history;
        $ticket->reschedule_count = ($ticket->reschedule_count ?? 0) + 1;
        $ticket->worker_selected_slot = null;
        $ticket->confirmed_time_slot = null;
        $ticket->confirmed_by = null;
        $ticket->time_confirmed_at = null;

        // 如果有提供新偏好時段（客服代填）
        if ($request->has('new_preferred_slots') && !empty($request->input('new_preferred_slots'))) {
            $periodLabels = ['morning' => '上午 09-12', 'afternoon' => '下午 13-17', 'evening' => '晚上 18-21'];
            $newSlots = collect($request->input('new_preferred_slots'))->map(function ($slot) use ($periodLabels) {
                $dateFormatted = date('n/j', strtotime($slot['date']));
                $dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date('w', strtotime($slot['date']))];
                return [
                    'date' => $slot['date'],
                    'period' => $slot['period'],
                    'label' => "{$dateFormatted}（{$dayOfWeek}）{$periodLabels[$slot['period']]}",
                ];
            })->toArray();
            $ticket->customer_preferred_slots = $newSlots;
        }

        $ticket->status = 'reschedule';
        $ticket->save();

        // LINE 通知
        try {
            $lineService = new LineNotifyService();
            $reason = $request->input('reason');
            $roleName = $initiatedBy === 'admin' ? '客服' : '師傅';
            $msg = "🔄 {$ticket->ticket_no} {$roleName}申請改期（第{$ticket->reschedule_count}次）\n{$roleName}：{$user->name}\n原因：{$reason}";

            // 通知客服（如果發起者不是客服）
            if ($initiatedBy !== 'admin') {
                $adminLineIds = User::where('role', 'admin')
                    ->whereNotNull('line_user_id')
                    ->pluck('line_user_id')
                    ->toArray();
                $lineService->pushToMultiple($adminLineIds, $msg);
            }

            // 通知師傅（如果發起者不是師傅）
            if ($initiatedBy !== 'worker') {
                $workerLineIds = $ticket->assignedUsers()
                    ->whereNotNull('line_user_id')
                    ->pluck('line_user_id')
                    ->toArray();
                if (!empty($workerLineIds)) {
                    $lineService->pushToMultiple($workerLineIds, $msg);
                }
            }

            // 通知客戶
            if ($ticket->customer_line_id) {
                $frontendUrl = env('FRONTEND_URL', 'https://ai-data-masker-production-fda9.up.railway.app');
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "🔄 您的維修單 {$ticket->ticket_no} 需要改期\n{$roleName}：{$user->name}\n原因：{$reason}\n\n"
                    . "請點擊以下連結查看並提供新的偏好時段：\n{$frontendUrl}/track"
                );
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 改期通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '改期已發起',
            'ticket' => [
                'id' => $ticket->id,
                'status' => $ticket->status,
                'reschedule_count' => $ticket->reschedule_count,
            ],
        ]);
    }

    /**
     * 客服代客確認報價
     * POST /api/tickets/{id}/admin-confirm-quote
     */
    public function adminConfirmQuote(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        if (!$ticket->quoted_amount) {
            return response()->json(['message' => '尚無報價可確認'], 422);
        }

        if ($ticket->quote_confirmed_at) {
            return response()->json(['message' => '已確認過報價'], 422);
        }

        $request->validate([
            'confirm_reason' => 'required|string|min:2',
        ]);

        $user = $request->user();
        $adminName = $user ? $user->name : '客服';

        $ticket->quote_confirmed_at = now();
        $ticket->notes_internal = ($ticket->notes_internal ? $ticket->notes_internal . "\n" : '')
            . "[代客確認報價] 由 {$adminName} 確認，原因：" . $request->input('confirm_reason');
        $ticket->save();

        // LINE 通知師傅
        try {
            $lineService = new LineNotifyService();
            $workerLineIds = $ticket->assignedUsers()
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            if (!empty($workerLineIds)) {
                $lineService->pushToMultiple(
                    $workerLineIds,
                    "✅ {$ticket->ticket_no} 報價已確認（客服 {$adminName} 代客確認）\n金額：\${$ticket->quoted_amount}\n可開始施工"
                );
            }

            // 通知客戶（如果有 LINE ID）
            if ($ticket->customer_line_id) {
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "✅ 您的維修單 {$ticket->ticket_no} 報價已確認！\n\n"
                    . "確認金額：\${$ticket->quoted_amount}\n"
                    . "（由客服 {$adminName} 代為確認）\n\n"
                    . "師傅將盡快安排施工。"
                );
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 代客確認報價通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '代客確認報價成功',
            'ticket' => $ticket,
        ]);
    }

    /**
     * 客服代客確認時段
     * POST /api/tickets/{id}/confirm-time
     */
    public function adminConfirmTime(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        if ($ticket->status !== 'time_proposed') {
            return response()->json(['message' => '此工單目前不接受時段確認'], 422);
        }

        $request->validate([
            'selected_slot' => 'required|string',
            'confirm_reason' => 'required|string',
        ]);

        $user = $request->user();
        $adminName = $user ? $user->name : '客服';

        $ticket->confirmed_time_slot = $request->input('selected_slot');
        $ticket->confirmed_by = "admin:{$adminName}（代客選擇）";
        $ticket->confirm_reason = $request->input('confirm_reason');
        $ticket->time_confirmed_at = now();
        $ticket->status = 'in_progress';
        $ticket->save();

        // LINE 通知客戶 + 師傅
        try {
            $lineService = new LineNotifyService();
            $selectedSlot = $request->input('selected_slot');

            // 通知客戶
            if ($ticket->customer_line_id) {
                $lineService->pushMessage(
                    $ticket->customer_line_id,
                    "✅ 您的維修單 {$ticket->ticket_no}\n已確認維修時段：{$selectedSlot}\n（由客服 {$adminName} 代為確認）\n\n如有問題請聯繫客服。"
                );
            }

            // 通知師傅
            $workerLineIds = $ticket->assignedUsers()
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            if (!empty($workerLineIds)) {
                $lineService->pushToMultiple(
                    $workerLineIds,
                    "✅ {$ticket->ticket_no} 時段已確認\n確認時段：{$selectedSlot}\n（客服 {$adminName} 代客選擇）"
                );
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 代客確認通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '代客確認時段成功',
            'ticket' => $ticket,
        ]);
    }

    /**
     * 客戶取消工單（公開 API）
     * POST /api/tickets/track/{id}/cancel
     */
    public function customerCancelTicket(Request $request, $id)
    {
        $ticket = $this->findTrackTicket($request, $id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單，或驗證資訊不符'], 404);
        }

        $cancelable = ['new', 'need_more_info', 'info_submitted', 'dispatched', 'time_proposed', 'in_progress'];
        if (!in_array($ticket->status, $cancelable)) {
            return response()->json(['message' => '此工單目前無法取消'], 422);
        }

        $request->validate([
            'cancel_reason' => 'required|string|min:2',
        ]);

        $ticket->status = 'cancelled';
        $ticket->cancelled_at = now();
        $ticket->cancelled_by_role = 'customer';
        $ticket->cancelled_by_name = $ticket->customer_name ?: '客戶';
        $ticket->cancel_reason = $request->input('cancel_reason');
        $ticket->save();

        // LINE 通知客服 + 師傅
        try {
            $lineService = new LineNotifyService();
            $reason = $ticket->cancel_reason;
            $customerPhone = $ticket->phone ?: '未提供';
            $msg = "❌ {$ticket->ticket_no} 客戶已取消\n客戶：{$ticket->customer_name}\n📞 電話：{$customerPhone}\n原因：{$reason}";

            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $lineService->pushToMultiple($adminLineIds, $msg);

            $workerLineIds = $ticket->assignedUsers()
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            if (!empty($workerLineIds)) {
                $lineService->pushToMultiple($workerLineIds, $msg);
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 客戶取消通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '工單已取消',
            'ticket' => ['id' => $ticket->id, 'status' => $ticket->status],
        ]);
    }

    /**
     * 師傅取消接單（回到已派工）
     * POST /api/tickets/{id}/cancel-accept
     */
    public function workerCancelAcceptance(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        $cancelable = ['dispatched', 'time_proposed', 'in_progress'];
        if (!in_array($ticket->status, $cancelable)) {
            return response()->json(['message' => '此工單目前無法取消接單'], 422);
        }

        $request->validate([
            'cancel_reason' => 'required|string|min:2',
        ]);

        $user = $request->user();
        $workerName = $user ? $user->name : '師傅';

        // 回到已派工，清除排程資料
        $ticket->status = 'dispatched';
        $ticket->proposed_time_slots = null;
        $ticket->confirmed_time_slot = null;
        $ticket->confirmed_by = null;
        $ticket->confirm_reason = null;
        $ticket->time_confirmed_at = null;
        $ticket->assigned_to = null;
        $ticket->accepted_at = null;

        // 解除師傅關聯
        $ticket->assignedUsers()->detach();
        $ticket->save();

        // LINE 通知客服
        try {
            $lineService = new LineNotifyService();
            $reason = $request->input('cancel_reason');
            $msg = "⚠️ {$ticket->ticket_no} 師傅取消接單\n師傅：{$workerName}\n原因：{$reason}\n\n請重新分配師傅。";

            $adminLineIds = User::where('role', 'admin')
                ->whereNotNull('line_user_id')
                ->pluck('line_user_id')
                ->toArray();
            $lineService->pushToMultiple($adminLineIds, $msg);

            // 不通知客戶（內部調度，客戶不需知道師傅更換）
        } catch (\Exception $e) {
            \Log::warning('LINE 師傅取消接單通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '已取消接單，工單回到待派工',
            'ticket' => $ticket,
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

    /** 客戶追蹤通用查詢：支援 LINE ID 或手機+編號 */
    private function findTrackTicket(Request $request, $id)
    {
        $lineUserId = $request->input('line_user_id', '');
        if ($lineUserId) {
            return Ticket::where('id', $id)
                ->where('customer_line_id', $lineUserId)
                ->first();
        }
        return Ticket::where('id', $id)
            ->where('phone', $request->input('phone', ''))
            ->where('ticket_no', $request->input('ticket_no', ''))
            ->first();
    }

    /**
     * 格式化客戶偏好時段
     */
    private function formatPreferredSlots($slots): ?array
    {
        if (empty($slots)) {
            return null;
        }

        // FormData 送來的是 JSON 字串，需要先解碼
        if (is_string($slots)) {
            $slots = json_decode($slots, true);
            if (!is_array($slots)) {
                return null;
            }
        }

        $periodLabels = ['morning' => '上午 09-12', 'afternoon' => '下午 13-17', 'evening' => '晚上 18-21'];

        return collect($slots)->map(function ($slot) use ($periodLabels) {
            if (!isset($slot['date']) || !isset($slot['period'])) {
                return null;
            }
            $dateFormatted = date('n/j', strtotime($slot['date']));
            $dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date('w', strtotime($slot['date']))];
            $periodLabel = $periodLabels[$slot['period']] ?? $slot['period'];
            return [
                'date' => $slot['date'],
                'period' => $slot['period'],
                'label' => "{$dateFormatted}（{$dayOfWeek}）{$periodLabel}",
            ];
        })->filter()->values()->toArray();
    }

    /**
     * 主師傅新增協助人員
     * POST /api/tickets/{id}/assistants
     */
    public function addAssistant(Request $request, $id)
    {
        $ticket = Ticket::with('assignedUsers')->find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        $user = $request->user();
        $primary = $ticket->primaryTechnician();

        // 只有主師傅可以加協助人員
        if (!$primary || $primary->id !== $user->id) {
            return response()->json(['message' => '只有主師傅可以新增協助人員'], 403);
        }

        // 不允許在已結案/取消的工單加人
        $allowedStatuses = ['dispatched', 'time_proposed', 'scheduled', 'reschedule', 'in_progress'];
        if (!in_array($ticket->status, $allowedStatuses)) {
            return response()->json(['message' => '目前工單狀態不允許新增協助人員'], 422);
        }

        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $assistantId = $request->input('user_id');

        // 不能加自己
        if ($assistantId == $user->id) {
            return response()->json(['message' => '不能將自己加為協助人員'], 422);
        }

        // 檢查是否已經是協助人員
        $existing = $ticket->assignedUsers()->where('users.id', $assistantId)->first();
        if ($existing) {
            return response()->json(['message' => '該師傅已在此工單中'], 422);
        }

        // 加入協助人員
        $ticket->assignedUsers()->attach($assistantId, ['role' => 'assistant']);

        // LINE 通知協助人員
        try {
            $assistant = User::find($assistantId);
            if ($assistant && $assistant->line_user_id) {
                $lineService = new LineNotifyService();
                $area = mb_substr($ticket->address ?? '', 0, 6) . '...';
                $timeDisplay = $ticket->scheduled_at
                    ? $ticket->scheduled_at->format('m/d H:i')
                    : ($ticket->worker_selected_slot['label'] ?? '待定');

                $msg = "📋【協助通知】{$ticket->ticket_no}（{$ticket->category}）\n";
                $msg .= "主師傅：{$user->name}（📞 {$user->phone}）\n";
                $msg .= "時間：{$timeDisplay}\n";
                $msg .= "區域：{$area}\n";
                $msg .= "👉 請配合主師傅安排到場協助";

                $lineService->pushMessage($assistant->line_user_id, $msg);
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 協助通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '已新增協助人員',
            'assistants' => $ticket->assistants()->map(fn($a) => ['id' => $a->id, 'name' => $a->name]),
        ]);
    }

    /**
     * 主師傅移除協助人員
     * DELETE /api/tickets/{id}/assistants/{userId}
     */
    public function removeAssistant(Request $request, $id, $userId)
    {
        $ticket = Ticket::with('assignedUsers')->find($id);
        if (!$ticket) {
            return response()->json(['message' => '找不到此工單'], 404);
        }

        $user = $request->user();
        $primary = $ticket->primaryTechnician();

        // 只有主師傅可以移除協助人員
        if (!$primary || $primary->id !== $user->id) {
            return response()->json(['message' => '只有主師傅可以移除協助人員'], 403);
        }

        // 只能移除 assistant 角色
        $target = $ticket->assignedUsers()->where('users.id', $userId)->first();
        if (!$target || $target->pivot->role !== 'assistant') {
            return response()->json(['message' => '找不到此協助人員'], 404);
        }

        $ticket->assignedUsers()->detach($userId);

        // LINE 通知被移除的協助人員
        try {
            if ($target->line_user_id) {
                $lineService = new LineNotifyService();
                $msg = "📋【協助取消通知】{$ticket->ticket_no}（{$ticket->category}）\n";
                $msg .= "主師傅 {$user->name} 已取消您的協助安排。\n";
                $msg .= "👉 您不需要到場，謝謝！";
                $lineService->pushMessage($target->line_user_id, $msg);
            }
        } catch (\Exception $e) {
            \Log::warning('LINE 協助取消通知失敗: ' . $e->getMessage());
        }

        return response()->json([
            'message' => '已移除協助人員',
            'assistants' => $ticket->assistants()->map(fn($a) => ['id' => $a->id, 'name' => $a->name]),
        ]);
    }
}
