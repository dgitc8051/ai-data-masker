<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    protected $fillable = [
        // 基本
        'ticket_no',
        'title',
        // 報修欄位
        'category',
        'customer_name',
        'phone',
        'address',
        'description_raw',
        'description_summary',
        'preferred_time_slot',
        'scheduled_at',
        'is_urgent',
        'notes_internal',
        // 遮罩相關（保留）
        'original_text',
        'masked_text',
        'mask_method',
        'field_values',
        'masked_fields',
        'template_id',
        // 狀態
        'status',
        'priority',
        'purpose',
        'created_by',
        'assigned_to',
        'stats',
        'completed_at',
        // 工作流程
        'accepted_at',
        'completion_note',
        'quoted_amount',
        'actual_amount',
        'quote_confirmed_at',
    ];

    protected $casts = [
        'stats' => 'array',
        'field_values' => 'array',
        'masked_fields' => 'array',
        'completed_at' => 'datetime',
        'scheduled_at' => 'datetime',
        'is_urgent' => 'boolean',
        'accepted_at' => 'datetime',
        'quote_confirmed_at' => 'datetime',
    ];

    // === 關聯 ===

    public function comments()
    {
        return $this->hasMany(TicketComment::class);
    }

    public function assignedUsers()
    {
        return $this->belongsToMany(User::class, 'ticket_user');
    }

    public function attachments()
    {
        return $this->hasMany(TicketAttachment::class);
    }

    public function dispatchLogs()
    {
        return $this->hasMany(DispatchLog::class);
    }
}
