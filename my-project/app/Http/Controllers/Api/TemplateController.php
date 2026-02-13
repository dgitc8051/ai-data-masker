<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Template;
use Illuminate\Http\Request;

/**
 * 範本管理 CRUD
 */
class TemplateController extends Controller
{
    // 列出所有範本
    public function index()
    {
        return response()->json(Template::latest()->get());
    }

    // 建立範本
    public function store(Request $request)
    {
        $template = Template::create([
            'name' => $request->input('name', '未命名範本'),
            'fields' => $request->input('fields', []),
        ]);

        return response()->json([
            'message' => '範本建立成功',
            'template' => $template,
        ], 201);
    }

    // 更新範本
    public function update(Request $request, $id)
    {
        $template = Template::find($id);
        if (!$template) {
            return response()->json(['message' => '找不到此範本'], 404);
        }

        $template->update([
            'name' => $request->input('name', $template->name),
            'fields' => $request->input('fields', $template->fields),
        ]);

        return response()->json([
            'message' => '範本更新成功',
            'template' => $template,
        ]);
    }

    // 刪除範本
    public function destroy($id)
    {
        $template = Template::find($id);
        if (!$template) {
            return response()->json(['message' => '找不到此範本'], 404);
        }

        $template->delete();

        return response()->json(['message' => '範本已刪除']);
    }
}
