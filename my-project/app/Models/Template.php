<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Template extends Model
{
    protected $fillable = ['name', 'fields'];

    protected $casts = [
        'fields' => 'array',  // JSON ↔ PHP array 自動轉換
    ];
}
