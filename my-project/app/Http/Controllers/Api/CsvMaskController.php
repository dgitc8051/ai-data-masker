<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\MaskService;
use App\Services\AiMaskService;
use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * CSV / Excel 遮罩控制器
 * 上傳檔案 → 遮罩指定欄位 → 回傳遮罩後的 CSV
 */
class CsvMaskController extends Controller
{
    /**
     * 判斷檔案是否為 Excel 格式
     */
    protected function isExcel($file): bool
    {
        $ext = strtolower($file->getClientOriginalExtension());
        return in_array($ext, ['xlsx', 'xls']);
    }

    /**
     * 統一讀取檔案（CSV 或 Excel）→ 回傳 [headers, rows]
     * 這是核心：不管什麼格式，都轉成一樣的陣列結構
     */
    protected function readFile($file): array
    {
        $path = $file->getRealPath();

        if ($this->isExcel($file)) {
            // ===== Excel 讀取 =====
            $spreadsheet = IOFactory::load($path);
            $worksheet = $spreadsheet->getActiveSheet();
            $allRows = $worksheet->toArray(null, true, true, false);

            // 第一列 = 欄位標題
            $headers = array_shift($allRows);

            // 過濾掉完全空白的列
            $rows = array_filter($allRows, function ($row) {
                return !empty(array_filter($row, fn($cell) => $cell !== null && trim($cell) !== ''));
            });

            return [$headers, array_values($rows)];
        } else {
            // ===== CSV 讀取 =====
            $handle = fopen($path, 'r');
            $headers = fgetcsv($handle);

            $rows = [];
            while (($row = fgetcsv($handle)) !== false) {
                $rows[] = $row;
            }

            fclose($handle);

            return [$headers, $rows];
        }
    }

    /**
     * 預覽檔案：讀取前幾列，讓前端顯示欄位選擇
     * POST /api/csv/preview
     */
    public function preview(Request $request)
    {
        if (!$request->hasFile('file')) {
            return response()->json(['message' => '請上傳 CSV 或 Excel 檔案'], 400);
        }

        $file = $request->file('file');

        // 用統一方法讀取（不管是 CSV 還是 Excel）
        [$headers, $rows] = $this->readFile($file);

        return response()->json([
            'headers' => $headers,
            'preview' => array_slice($rows, 0, 5),   // 只取前 5 列預覽
            'total_columns' => count($headers),
        ]);
    }

    /**
     * 執行遮罩：對指定欄位做遮罩，回傳遮罩後的 CSV
     * POST /api/csv/mask
     */
    public function mask(Request $request)
    {
        if (!$request->hasFile('file')) {
            return response()->json(['message' => '請上傳 CSV 或 Excel 檔案'], 400);
        }

        $file = $request->file('file');

        // 前端傳來要遮罩的欄位索引，例如 [0, 2, 3]（第1、3、4欄）
        $columnsToMask = json_decode($request->input('columns', '[]'), true);

        // 選擇遮罩方式
        $maskMethod = $request->input('mask_method', 'ai');

        // 準備遮罩工具
        $maskService = new MaskService();
        $aiService = null;
        if ($maskMethod === 'ai') {
            $aiService = new AiMaskService();
        }

        // 用統一方法讀取（不管是 CSV 還是 Excel）
        [$headers, $allRows] = $this->readFile($file);

        $maskedRows = [];
        $totalStats = [];

        foreach ($allRows as $row) {
            // 對每一列，遮罩指定的欄位
            foreach ($columnsToMask as $colIndex) {
                if (isset($row[$colIndex]) && !empty(trim($row[$colIndex] ?? ''))) {
                    $cellText = (string) $row[$colIndex];
                    $columnName = $headers[$colIndex] ?? '欄位' . $colIndex;

                    if ($maskMethod === 'ai' && $aiService) {
                        // AI 遮罩
                        $result = $aiService->maskWithAi($cellText);
                        $maskedText = $result['masked'];

                        // 如果 AI 沒有遮罩到，使用者既然勾選了就強制遮罩
                        if ($maskedText === $cellText) {
                            $maskedText = $this->fallbackMask($cellText);
                        }

                        $row[$colIndex] = $maskedText;
                    } else {
                        // Regex 遮罩
                        $result = $maskService->mask($cellText);
                        $maskedText = $result['masked'];

                        if ($maskedText === $cellText) {
                            $maskedText = $this->fallbackMask($cellText);
                        }

                        $row[$colIndex] = $maskedText;
                    }

                    // 用原始欄位名稱統計（例如「姓名 x5」而不是「name x5」）
                    $totalStats[$columnName] = ($totalStats[$columnName] ?? 0) + 1;
                }
            }

            $maskedRows[] = $row;
        }

        // 產生遮罩後的 CSV 內容（不管原檔是什麼格式，輸出都是 CSV）
        $output = fopen('php://temp', 'r+');

        // 加 BOM（讓 Excel 正確顯示中文）
        fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));

        // 寫入標題列
        fputcsv($output, $headers);

        // 寫入資料列
        foreach ($maskedRows as $row) {
            fputcsv($output, $row);
        }

        // 讀取產生的內容
        rewind($output);
        $csvContent = stream_get_contents($output);
        fclose($output);

        // 存到 storage/app/csv-temp/ 目錄
        $tempDir = storage_path('app/csv-temp');
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $filename = 'masked_' . date('Ymd_His') . '.csv';
        file_put_contents($tempDir . '/' . $filename, $csvContent);

        return response()->json([
            'filename' => $filename,
            'stats' => $totalStats,
            'rows_processed' => count($maskedRows),
        ]);
    }

    /**
     * 下載遮罩後的 CSV 檔案
     * GET /api/csv/download/{filename}
     */
    public function download($filename)
    {
        $path = storage_path('app/csv-temp/' . $filename);

        if (!file_exists($path)) {
            return response()->json(['message' => '檔案不存在或已過期'], 404);
        }

        return response()->download($path, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * 通用 fallback 遮罩
     * 當 AI 或 Regex 無法識別時，使用者既然勾選了就強制遮罩
     */
    protected function fallbackMask(string $text): string
    {
        $len = mb_strlen($text);

        if ($len <= 2) {
            return str_repeat('*', max($len, 3));
        }

        return mb_substr($text, 0, 1) . str_repeat('*', $len - 1);
    }
}
