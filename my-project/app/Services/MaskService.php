<?php

namespace App\Services;

/**
 * 正則遮罩服務
 * 把 MaskController 裡的遮罩邏輯抽出來，讓不同的 Controller 都能用
 */
class MaskService
{
    /**
     * 對文字執行正則遮罩
     *
     * @param string $text 原始文字
     * @param array $types 要遮罩的類型（phone, email, idCard, creditCard, account, address）
     * @return array ['masked' => 遮罩後文字, 'stats' => 偵測統計]
     */
    public function mask(string $text, array $types = []): array
    {
        $masked = $text;

        // 如果沒指定類型，預設全部都遮
        if (empty($types)) {
            $types = [
                'phone' => true,
                'email' => true,
                'idCard' => true,
                'creditCard' => true,
                'account' => true,
                'address' => true,
            ];
        }

        // 統計用
        $stats = [
            '信用卡' => 0,
            '帳號' => 0,
            '身分證' => 0,
            '電話' => 0,
            'Email' => 0,
            '地址' => 0,
        ];

        // ========== 信用卡號 ==========
        // （最長的先，16位數字不會跟其他衝突）
        if (!empty($types['creditCard'])) {
            $masked = preg_replace_callback('/\b\d{16}\b/', function ($m) use (&$stats) {
                $stats['信用卡']++;
                $raw = $m[0];
                return str_repeat('*', 12) . substr($raw, -4);
            }, $masked);
            $masked = preg_replace_callback('/\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}/', function ($m) use (&$stats) {
                $stats['信用卡']++;
                $raw = preg_replace('/[-\s]/', '', $m[0]);
                return '****-****-****-' . substr($raw, -4);
            }, $masked);
        }

        // ========== 身分證字號 ==========
        // （放在帳號前面！A123456789 是 10 字元，不會被帳號規則誤抓）
        if (!empty($types['idCard'])) {
            $masked = preg_replace_callback('/[A-Z][12]\d{8}/', function ($m) use (&$stats) {
                $stats['身分證']++;
                $raw = $m[0];
                return substr($raw, 0, 2) . str_repeat('*', 6) . substr($raw, -2);
            }, $masked);
        }

        // ========== 手機號碼 ==========
        // （放在帳號前面！0912345678 是 10 位數字，會被帳號規則誤抓）
        if (!empty($types['phone'])) {
            $masked = preg_replace_callback('/09\d{2}-?\d{3}-?\d{3}/', function ($m) use (&$stats) {
                $stats['電話']++;
                $raw = preg_replace('/-/', '', $m[0]);
                return substr($raw, 0, 2) . '**-***-' . substr($raw, -3);
            }, $masked);
        }

        // ========== 市話 ==========
        if (!empty($types['phone'])) {
            $masked = preg_replace_callback('/0\d{1,2}-\d{7,8}/', function ($m) use (&$stats) {
                $stats['電話']++;
                $parts = explode('-', $m[0]);
                $areaCode = $parts[0];
                $number = $parts[1];
                return $areaCode . '-' . str_repeat('*', strlen($number) - 4) . substr($number, -4);
            }, $masked);
        }

        // ========== 銀行帳號 ==========
        // （放在手機和身分證後面，避免誤抓）
        if (!empty($types['account'])) {
            $masked = preg_replace_callback('/\b\d{10,15}\b/', function ($m) use (&$stats) {
                $stats['帳號']++;
                $raw = $m[0];
                return str_repeat('*', strlen($raw) - 3) . substr($raw, -3);
            }, $masked);
        }

        // ========== Email ==========
        if (!empty($types['email'])) {
            $masked = preg_replace_callback('/[\w\.-]+@[\w\.-]+\.\w+/', function ($m) use (&$stats) {
                $stats['Email']++;
                $raw = $m[0];
                $atPos = strpos($raw, '@');
                $firstChar = substr($raw, 0, 1);
                $domain = substr($raw, $atPos);
                return $firstChar . str_repeat('*', $atPos - 1) . $domain;
            }, $masked);
        }

        // ========== 地址 ==========
        if (!empty($types['address'])) {
            $masked = preg_replace_callback('/[\x{4e00}-\x{9fa5}]{2,3}[縣市][\x{4e00}-\x{9fa5}]{1,4}[區鄉鎮市][\x{4e00}-\x{9fa5}]{1,10}[路街道][\x{4e00}-\x{9fa5}0-9]+號/u', function ($m) use (&$stats) {
                $stats['地址']++;
                $raw = $m[0];
                preg_match('/^([\x{4e00}-\x{9fa5}]{2,3}[縣市][\x{4e00}-\x{9fa5}]{1,4}[區鄉鎮市])/u', $raw, $prefix);
                if (!empty($prefix[0])) {
                    $rest = mb_substr($raw, mb_strlen($prefix[0]));
                    return $prefix[0] . str_repeat('*', mb_strlen($rest));
                }
                return '[地址]';
            }, $masked);
        }

        // 過濾掉數量為 0 的項目
        $stats = array_filter($stats, fn($count) => $count > 0);

        return [
            'masked' => $masked,
            'stats' => $stats,
        ];
    }
}
