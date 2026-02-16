<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// 每天晚上 8 點（台灣時間）發送明日維修排程提醒
Schedule::command('notify:schedule-reminder')->dailyAt('20:00')->timezone('Asia/Taipei');
