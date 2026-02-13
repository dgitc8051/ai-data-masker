<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DispatchLog extends Model
{
    protected $fillable = [
        'ticket_id',
        'dispatcher_user_id',
        'technician_ids',
        'payload_snapshot',
        'dispatched_at',
    ];

    protected $casts = [
        'technician_ids' => 'array',
        'payload_snapshot' => 'array',
        'dispatched_at' => 'datetime',
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }

    public function dispatcher()
    {
        return $this->belongsTo(User::class, 'dispatcher_user_id');
    }
}
