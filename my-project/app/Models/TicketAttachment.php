<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketAttachment extends Model
{
    protected $fillable = [
        'ticket_id',
        'file_path',
        'file_type',
        'original_name',
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }
}
