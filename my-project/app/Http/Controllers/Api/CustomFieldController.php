<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomMaskField;
use Illuminate\Http\Request;

/**
 * 自訂遮罩欄位管理
 */
class CustomFieldController extends Controller
{
    // 列出所有自訂欄位
    public function index()
    {
        return response()->json(CustomMaskField::latest()->get());
    }

    // 新增自訂欄位
    public function store(Request $request)
    {
        $field = CustomMaskField::create([
            'label' => $request->input('label'),
            'mask_type' => $request->input('mask_type', 'full'),
            'keep_chars' => $request->input('keep_chars', 0),
        ]);

        return response()->json([
            'message' => '自訂欄位新增成功',
            'field' => $field,
        ], 201);
    }

    // 刪除自訂欄位
    public function destroy($id)
    {
        $field = CustomMaskField::find($id);
        if (!$field) {
            return response()->json(['message' => '找不到此欄位'], 404);
        }

        $field->delete();

        return response()->json(['message' => '欄位已刪除']);
    }
}
