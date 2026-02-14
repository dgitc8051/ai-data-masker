<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LineCustomer extends Model
{
    protected $fillable = [
        'line_user_id',
        'line_display_name',
        'customer_name',
        'phone',
        'address',
        'avatar_url',
        'last_visited_at',
    ];

    protected $casts = [
        'last_visited_at' => 'datetime',
    ];

    /**
     * 取得這個客戶的所有工單
     */
    public function tickets()
    {
        return Ticket::where('customer_line_id', $this->line_user_id)->latest();
    }
}
