<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketComment extends Model
{
    // === 可填入的欄位 ===
    protected $fillable = [
        'ticket_id',   // 屬於哪張工單
        'author',      // 留言者
        'content',     // 留言內容
    ];

    // === 關聯：這則留言屬於哪張工單 ===
    // 用法：$comment->ticket 就能取得這則留言所屬的工單
    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }
}
