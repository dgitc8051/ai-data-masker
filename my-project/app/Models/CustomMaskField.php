<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomMaskField extends Model
{
    protected $fillable = ['label', 'mask_type', 'keep_chars'];
}
