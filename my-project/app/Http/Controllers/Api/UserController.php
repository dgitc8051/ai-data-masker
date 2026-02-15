<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * 列出所有使用者
     * GET /api/users
     */
    public function index()
    {
        $users = User::select('id', 'name', 'username', 'role', 'line_user_id', 'line_display_name', 'created_at')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($u) {
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'username' => $u->username,
                    'role' => $u->role,
                    'line_bound' => !empty($u->line_user_id),
                    'line_display_name' => $u->line_display_name,
                    'created_at' => $u->created_at,
                ];
            });

        return response()->json($users);
    }

    /**
     * 列出所有師傅（給指派用）
     * GET /api/users/workers
     */
    public function workers()
    {
        $workers = User::where('role', 'worker')
            ->select('id', 'name', 'username')
            ->orderBy('name')
            ->get();

        return response()->json($workers);
    }

    /**
     * 新增使用者
     * POST /api/users
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:users',
            'password' => 'required|string|min:3',
            'role' => 'in:admin,worker',
        ]);

        $user = User::create([
            'name' => $request->name,
            'username' => $request->username,
            'password' => Hash::make($request->password),
            'role' => $request->input('role', 'worker'),
        ]);

        return response()->json([
            'message' => '使用者建立成功',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'role' => $user->role,
            ],
        ], 201);
    }

    /**
     * 刪除使用者
     * DELETE /api/users/{id}
     */
    public function destroy($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json(['message' => '找不到此使用者'], 404);
        }

        if ($user->role === 'admin') {
            // 防止刪除最後一個管理員
            $adminCount = User::where('role', 'admin')->count();
            if ($adminCount <= 1) {
                return response()->json(['message' => '無法刪除最後一位管理員'], 400);
            }
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => '使用者已刪除']);
    }

    /**
     * 修改密碼（管理員用）
     * PATCH /api/users/{id}/password
     */
    public function updatePassword(Request $request, $id)
    {
        $request->validate([
            'password' => 'required|string|min:3',
        ]);

        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => '找不到此使用者'], 404);
        }

        $user->update(['password' => Hash::make($request->password)]);

        // 讓舊 token 失效（強制重新登入）
        $user->tokens()->delete();

        return response()->json([
            'message' => "已更新「{$user->name}」的密碼",
        ]);
    }

    /**
     * 解除 LINE 綁定（管理員用）
     * DELETE /api/users/{id}/line
     */
    public function unbindLine($id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => '找不到此使用者'], 404);
        }

        if (empty($user->line_user_id)) {
            return response()->json(['message' => '此使用者尚未綁定 LINE'], 400);
        }

        $user->update(['line_user_id' => null, 'line_display_name' => null]);

        return response()->json([
            'message' => "已解除「{$user->name}」的 LINE 綁定",
        ]);
    }
}
