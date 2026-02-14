<?php

/**
 * LINE Rich Menu 設定腳本
 * 用法：php scripts/setup_rich_menu.php
 * 
 * 功能：
 * 1. 建立 Rich Menu (3x2 六宮格)
 * 2. 上傳 Rich Menu 圖片
 * 3. 設定為預設 Rich Menu
 */

// 讀取 .env
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with($line, '#'))
            continue;
        if (str_contains($line, '=')) {
            [$key, $value] = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
        }
    }
}

$TOKEN = $_ENV['LINE_CHANNEL_TOKEN'] ?? '';
if (!$TOKEN) {
    echo "❌ 找不到 LINE_CHANNEL_TOKEN，請確認 .env 檔案\n";
    exit(1);
}

// 前端網址
$FRONTEND_URL = 'https://ai-data-masker-production-fda9.up.railway.app';

echo "🔧 LINE Rich Menu 設定工具\n";
echo "=========================\n\n";

// === Step 1: 建立 Rich Menu ===
echo "1️⃣ 建立 Rich Menu...\n";

$richMenu = [
    'size' => ['width' => 2500, 'height' => 1686],
    'selected' => true,
    'name' => '全方位水電維修',
    'chatBarText' => '選單',
    'areas' => [
        // 左上 - 用戶報修
        [
            'bounds' => ['x' => 0, 'y' => 0, 'width' => 833, 'height' => 843],
            'action' => ['type' => 'uri', 'label' => '用戶報修', 'uri' => "$FRONTEND_URL/repair"],
        ],
        // 中上 - 維修進度
        [
            'bounds' => ['x' => 833, 'y' => 0, 'width' => 834, 'height' => 843],
            'action' => ['type' => 'uri', 'label' => '維修進度', 'uri' => "$FRONTEND_URL/track"],
        ],
        // 右上 - 聯絡我們
        [
            'bounds' => ['x' => 1667, 'y' => 0, 'width' => 833, 'height' => 843],
            'action' => ['type' => 'uri', 'label' => '聯絡我們', 'uri' => "$FRONTEND_URL/contact"],
        ],
        // 左下 - 內部登入
        [
            'bounds' => ['x' => 0, 'y' => 843, 'width' => 833, 'height' => 843],
            'action' => ['type' => 'uri', 'label' => '內部登入', 'uri' => "$FRONTEND_URL/login"],
        ],
        // 中下 - 服務項目
        [
            'bounds' => ['x' => 833, 'y' => 843, 'width' => 834, 'height' => 843],
            'action' => ['type' => 'uri', 'label' => '服務項目', 'uri' => "$FRONTEND_URL/services"],
        ],
        // 右下 - 費用參考
        [
            'bounds' => ['x' => 1667, 'y' => 843, 'width' => 833, 'height' => 843],
            'action' => ['type' => 'uri', 'label' => '費用參考', 'uri' => "$FRONTEND_URL/pricing"],
        ],
    ],
];

$ch = curl_init('https://api.line.me/v2/bot/richmenu');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $TOKEN",
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($richMenu),
    CURLOPT_RETURNTRANSFER => true,
]);
$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($result, true);
if ($httpCode !== 200 || empty($data['richMenuId'])) {
    echo "❌ 建立失敗 (HTTP $httpCode): $result\n";
    exit(1);
}

$richMenuId = $data['richMenuId'];
echo "✅ 建立成功！Rich Menu ID: $richMenuId\n\n";

// === Step 2: 上傳圖片 ===
echo "2️⃣ 上傳 Rich Menu 圖片...\n";

$imagePath = __DIR__ . '/../storage/rich_menu.png';
if (!file_exists($imagePath)) {
    echo "❌ 找不到圖片：$imagePath\n";
    exit(1);
}

$imageData = file_get_contents($imagePath);
$ch = curl_init("https://api-data.line.me/v2/bot/richmenu/$richMenuId/content");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $TOKEN",
        'Content-Type: image/png',
    ],
    CURLOPT_POSTFIELDS => $imageData,
    CURLOPT_RETURNTRANSFER => true,
]);
$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    echo "❌ 圖片上傳失敗 (HTTP $httpCode): $result\n";
    exit(1);
}
echo "✅ 圖片上傳成功！\n\n";

// === Step 3: 設定為預設 Rich Menu ===
echo "3️⃣ 設定為預設 Rich Menu...\n";

$ch = curl_init("https://api.line.me/v2/bot/user/all/richmenu/$richMenuId");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $TOKEN",
        'Content-Type: application/json',
    ],
    CURLOPT_RETURNTRANSFER => true,
]);
$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    echo "❌ 設定預設失敗 (HTTP $httpCode): $result\n";
    exit(1);
}
echo "✅ 已設定為預設 Rich Menu！\n\n";

echo "🎉 全部完成！\n";
echo "請打開 LINE 官方帳號確認底部是否顯示六宮格選單。\n";
