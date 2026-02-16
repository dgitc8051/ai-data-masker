<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketAttachment extends Model
{
    protected $fillable = [
        'ticket_id',
        'file_path',
        'file_data',
        'mime_type',
        'file_type',
        'original_name',
    ];

    protected $hidden = [
        'file_data', // 避免 JSON 回傳時帶出大量 binary
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }
}
