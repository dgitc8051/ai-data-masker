<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    // 允許批量填入的欄位                                                       
    protected $fillable = [
        'input_hash',
        'masked_text',
        'stats',
        'mask_types',
        'purpose',
        'ip_address',
    ];

    // JSON 欄位自動轉換                                                        
    protected $casts = [
        'stats' => 'array',
        'mask_types' => 'array',
    ];
}
