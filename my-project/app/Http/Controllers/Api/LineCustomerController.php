<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\LineCustomer;
use App\Models\Ticket;

class LineCustomerController extends Controller
{
    /**
     * 公開 API：LIFF 登入後註冊/更新客戶資料
     * POST /api/line-customers/register
     */
    public function register(Request $request)
    {
        $request->validate([
            'line_user_id' => 'required|string',
            'line_display_name' => 'required|string',
        ]);

        $customer = LineCustomer::updateOrCreate(
            ['line_user_id' => $request->input('line_user_id')],
            [
                'line_display_name' => $request->input('line_display_name'),
                'avatar_url' => $request->input('avatar_url'),
                'last_visited_at' => now(),
            ]
        );

        // 回傳客戶過去的資料（用於自動帶入）
        return response()->json([
            'message' => 'ok',
            'customer' => [
                'line_user_id' => $customer->line_user_id,
                'line_display_name' => $customer->line_display_name,
                'customer_name' => $customer->customer_name,
                'phone' => $customer->phone,
                'address' => $customer->address,
            ],
        ]);
    }

    /**
     * 管理員 API：列出所有 LINE 客戶
     * GET /api/line-customers
     */
    public function index(Request $request)
    {
        $query = LineCustomer::latest('last_visited_at');

        // 搜尋
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('line_display_name', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $customers = $query->get();

        // 附加工單數量
        $lineIds = $customers->pluck('line_user_id')->toArray();
        $ticketCounts = Ticket::whereIn('customer_line_id', $lineIds)
            ->selectRaw('customer_line_id, count(*) as cnt')
            ->groupBy('customer_line_id')
            ->pluck('cnt', 'customer_line_id');

        $customers->each(function ($c) use ($ticketCounts) {
            $c->tickets_count = $ticketCounts[$c->line_user_id] ?? 0;
        });

        return response()->json($customers);
    }
}
