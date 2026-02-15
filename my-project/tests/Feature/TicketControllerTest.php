<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Ticket;
use App\Models\TicketAttachment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class TicketControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $worker;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        $this->admin = User::create([
            'name' => '管理員',
            'username' => 'admin',
            'password' => bcrypt('admin123'),
            'role' => 'admin',
            'email' => 'admin@test.com',
        ]);

        $this->worker = User::create([
            'name' => '王師傅',
            'username' => 'worker1',
            'password' => bcrypt('worker123'),
            'role' => 'worker',
            'email' => null,
        ]);
    }

    // ========================
    // 登入 / 認證
    // ========================

    public function test_login_success()
    {
        $res = $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'admin123',
        ]);
        $res->assertStatus(200)->assertJsonStructure(['token', 'user']);
    }

    public function test_login_failure()
    {
        $res = $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'wrongpassword',
        ]);
        $res->assertStatus(401);
    }

    // ========================
    // 建票 (POST /api/repair-tickets)
    // ========================

    public function test_store_repair_ticket()
    {
        $res = $this->postJson('/api/repair-tickets', [
            'customer_name' => '王小明',
            'phone' => '0912345678',
            'address' => '台北市信義區松高路1號',
            'category' => '水管',
            'description' => '水管漏水嚴重',
            'preferred_time_slot' => '上午（09:00-12:00）, 下午（13:00-17:00）',
        ]);
        $res->assertStatus(201)
            ->assertJsonStructure(['message', 'ticket']);

        $this->assertDatabaseHas('tickets', [
            'customer_name' => '王小明',
            'phone' => '0912345678',
            'category' => '水管',
        ]);
    }

    public function test_store_repair_ticket_with_other_category()
    {
        $res = $this->postJson('/api/repair-tickets', [
            'customer_name' => '李大華',
            'phone' => '0987654321',
            'address' => '台南市安平區1號',
            'category' => '其他（洗衣機）',
            'description' => '洗衣機不運轉',
            'preferred_time_slot' => '晚上（18:00-21:00）',
        ]);
        $res->assertStatus(201);

        $this->assertDatabaseHas('tickets', [
            'category' => '其他（洗衣機）',
        ]);
    }

    public function test_store_repair_ticket_with_attachments()
    {
        $res = $this->post('/api/repair-tickets', [
            'customer_name' => '張三',
            'phone' => '0911222333',
            'address' => '高雄市前鎮區',
            'category' => '冷氣',
            'description' => '冷氣不涼',
            'preferred_time_slot' => '週末皆可',
            'attachments' => [
                UploadedFile::fake()->image('photo1.jpg', 800, 600),
                UploadedFile::fake()->image('photo2.jpg', 800, 600),
            ],
        ]);
        $res->assertStatus(201);

        $ticket = Ticket::where('phone', '0911222333')->first();
        $this->assertNotNull($ticket);
        $this->assertEquals(2, $ticket->attachments()->count());
    }

    public function test_store_minimal_ticket()
    {
        // 店家端建票最低限度只需 category
        $res = $this->postJson('/api/repair-tickets', [
            'category' => '電路',
        ]);
        $res->assertStatus(201);
    }

    // ========================
    // 查詢追蹤 (公開 API)
    // ========================

    public function test_track_by_phone_and_ticket_no()
    {
        $ticket = $this->createSampleTicket();

        $res = $this->getJson("/api/tickets/track?phone={$ticket->phone}&ticket_no={$ticket->ticket_no}");
        $res->assertStatus(200)
            ->assertJsonStructure(['tickets']);
    }

    public function test_track_by_line_id()
    {
        $ticket = $this->createSampleTicket(['customer_line_id' => 'U1234567890']);

        $res = $this->getJson('/api/tickets/track-by-line?line_user_id=U1234567890');
        $res->assertStatus(200)
            ->assertJsonStructure(['tickets']);
        $this->assertGreaterThan(0, count($res->json('tickets')));
    }

    public function test_track_detail_returns_ticket()
    {
        $ticket = $this->createSampleTicket();

        $res = $this->getJson("/api/tickets/track/{$ticket->id}?phone={$ticket->phone}&ticket_no={$ticket->ticket_no}");
        $res->assertStatus(200)
            ->assertJsonStructure(['ticket' => ['id', 'ticket_no', 'status', 'attachments']]);
    }

    public function test_track_detail_returns_editable_on_need_more_info()
    {
        $ticket = $this->createSampleTicket(['status' => 'need_more_info']);

        $res = $this->getJson("/api/tickets/track/{$ticket->id}?phone={$ticket->phone}&ticket_no={$ticket->ticket_no}");
        $res->assertStatus(200);

        $data = $res->json('ticket');
        $this->assertTrue($data['editable']);
        // editable 模式不遮罩姓名
        $this->assertEquals('王小明', $data['customer_name']);
    }

    public function test_track_detail_wrong_phone_returns_404()
    {
        $ticket = $this->createSampleTicket();

        $res = $this->getJson("/api/tickets/track/{$ticket->id}?phone=0999999999&ticket_no={$ticket->ticket_no}");
        $res->assertStatus(404);
    }

    // ========================
    // 補件 (POST /api/tickets/track/{id}/supplement)
    // ========================

    public function test_supplement_ticket()
    {
        $ticket = $this->createSampleTicket(['status' => 'need_more_info']);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/supplement", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            'customer_name' => '王小明（修改）',
            'category' => '電路',
            'address' => '新北市板橋區',
            'preferred_time_slot' => '上午（09:00-12:00）, 下午（13:00-17:00）',
        ]);
        $res->assertStatus(200)
            ->assertJsonStructure(['message', 'ticket']);

        $ticket->refresh();
        $this->assertEquals('info_submitted', $ticket->status);
        $this->assertEquals('電路', $ticket->category);
        $this->assertEquals('上午（09:00-12:00）, 下午（13:00-17:00）', $ticket->preferred_time_slot);
    }

    public function test_supplement_with_other_category()
    {
        $ticket = $this->createSampleTicket(['status' => 'need_more_info']);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/supplement", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            'category' => '其他（電視）',
        ]);
        $res->assertStatus(200);

        $ticket->refresh();
        $this->assertEquals('其他（電視）', $ticket->category);
    }

    public function test_supplement_with_photo_upload()
    {
        $ticket = $this->createSampleTicket(['status' => 'need_more_info']);

        $res = $this->post("/api/tickets/track/{$ticket->id}/supplement", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            'attachments' => [
                UploadedFile::fake()->image('new_photo.jpg', 640, 480),
            ],
        ]);
        $res->assertStatus(200);

        $this->assertEquals(1, $ticket->attachments()->count());
    }

    public function test_supplement_with_photo_deletion()
    {
        $ticket = $this->createSampleTicket(['status' => 'need_more_info']);
        $att = TicketAttachment::create([
            'ticket_id' => $ticket->id,
            'file_path' => 'tickets/test.jpg',
            'file_type' => 'photo',
            'original_name' => 'test.jpg',
        ]);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/supplement", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            'delete_attachment_ids' => json_encode([$att->id]),
        ]);
        $res->assertStatus(200);

        $this->assertEquals(0, $ticket->attachments()->count());
    }

    public function test_supplement_wrong_status_fails()
    {
        $ticket = $this->createSampleTicket(['status' => 'new']);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/supplement", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            'category' => '水管',
        ]);
        // 後端回 422 表示「此工單目前不接受補件」
        $res->assertStatus(422);
    }

    // ========================
    // 客戶取消 (POST /api/tickets/track/{id}/cancel)
    // ========================

    public function test_customer_cancel_new_ticket()
    {
        $ticket = $this->createSampleTicket(['status' => 'new']);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/cancel", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            'cancel_reason' => '不需要了',
        ]);
        $res->assertStatus(200);

        $ticket->refresh();
        $this->assertEquals('cancelled', $ticket->status);
        $this->assertEquals('不需要了', $ticket->cancel_reason);
    }

    public function test_customer_cancel_need_more_info_ticket()
    {
        $ticket = $this->createSampleTicket(['status' => 'need_more_info']);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/cancel", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            'cancel_reason' => '找到別家了',
        ]);
        $res->assertStatus(200);

        $ticket->refresh();
        $this->assertEquals('cancelled', $ticket->status);
    }

    public function test_customer_cancel_info_submitted_ticket()
    {
        $ticket = $this->createSampleTicket(['status' => 'info_submitted']);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/cancel", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            'cancel_reason' => '我不想修了',
        ]);
        $res->assertStatus(200);
    }

    public function test_customer_cancel_completed_ticket_fails()
    {
        $ticket = $this->createSampleTicket(['status' => 'completed']);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/cancel", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            'cancel_reason' => '不需要了',
        ]);
        // 後端回 422: 此工單目前無法取消
        $res->assertStatus(422);
    }

    public function test_customer_cancel_requires_reason()
    {
        $ticket = $this->createSampleTicket(['status' => 'new']);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/cancel", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            // 不提供 cancel_reason
        ]);
        $res->assertStatus(422); // validation error
    }

    // ========================
    // 管理員操作 (需認證)
    // ========================

    public function test_admin_list_tickets()
    {
        $this->createSampleTicket();
        $this->createSampleTicket(['phone' => '0988888888']);

        $res = $this->actingAs($this->admin)->getJson('/api/tickets');
        $res->assertStatus(200);
        // index 回傳的是 array (collection)
        $this->assertGreaterThan(0, count($res->json()));
    }

    public function test_admin_show_ticket()
    {
        $ticket = $this->createSampleTicket();

        $res = $this->actingAs($this->admin)->getJson("/api/tickets/{$ticket->id}");
        $res->assertStatus(200);
        // show 回傳的是 ticket 直接作為根，不包裹在 {ticket: ...}
        $this->assertEquals($ticket->ticket_no, $res->json('ticket_no'));
    }

    public function test_admin_update_ticket()
    {
        $ticket = $this->createSampleTicket();

        $res = $this->actingAs($this->admin)->patchJson("/api/tickets/{$ticket->id}", [
            'priority' => 'high',
        ]);
        $res->assertStatus(200);

        $ticket->refresh();
        $this->assertEquals('high', $ticket->priority);
    }

    public function test_admin_update_status_to_need_more_info()
    {
        $ticket = $this->createSampleTicket(['status' => 'new']);

        $res = $this->actingAs($this->admin)->patchJson("/api/tickets/{$ticket->id}/status", [
            'status' => 'need_more_info',
            'supplement_note' => '請補充照片',
        ]);
        $res->assertStatus(200);

        $ticket->refresh();
        $this->assertEquals('need_more_info', $ticket->status);
        $this->assertEquals('請補充照片', $ticket->supplement_note);
    }

    public function test_admin_add_comment()
    {
        $ticket = $this->createSampleTicket();

        $res = $this->actingAs($this->admin)->postJson("/api/tickets/{$ticket->id}/comments", [
            'content' => '已聯絡客戶確認地址',
        ]);
        $res->assertStatus(201);

        $this->assertEquals(1, $ticket->comments()->count());
    }

    public function test_admin_propose_time_slots()
    {
        // proposeTimeSlots 需 status=dispatched
        $ticket = $this->createSampleTicket(['status' => 'dispatched']);

        $res = $this->actingAs($this->worker)->postJson("/api/tickets/{$ticket->id}/propose-times", [
            'time_slots' => [
                ['date' => '2026-03-01', 'time' => '09:00-12:00'],
                ['date' => '2026-03-02', 'time' => '14:00-17:00'],
            ],
        ]);
        $res->assertStatus(200);

        $ticket->refresh();
        $this->assertEquals('time_proposed', $ticket->status);
        $this->assertNotNull($ticket->proposed_time_slots);
    }

    // ========================
    // 報價確認 (公開API)
    // ========================

    public function test_confirm_quote()
    {
        $ticket = $this->createSampleTicket([
            'status' => 'quoted',
            'quoted_amount' => 3500,
        ]);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/confirm-quote", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
        ]);
        $res->assertStatus(200);

        $ticket->refresh();
        $this->assertNotNull($ticket->quote_confirmed_at);
    }

    // ========================
    // 時段確認 (公開API)
    // ========================

    public function test_confirm_time_slot()
    {
        $ticket = $this->createSampleTicket([
            'status' => 'time_proposed',
            'proposed_time_slots' => [
                ['date' => '2026-03-01', 'time' => '09:00-12:00'],
                ['date' => '2026-03-02', 'time' => '14:00-17:00'],
            ],
        ]);

        $res = $this->postJson("/api/tickets/track/{$ticket->id}/confirm-time", [
            'phone' => $ticket->phone,
            'ticket_no' => $ticket->ticket_no,
            'selected_slot' => '2026-03-01 09:00-12:00',
        ]);
        $res->assertStatus(200);

        $ticket->refresh();
        $this->assertNotNull($ticket->confirmed_time_slot);
    }

    // ========================
    // 師傅操作
    // ========================

    public function test_worker_accept_ticket()
    {
        $ticket = $this->createSampleTicket(['status' => 'dispatched']);
        $ticket->assignedUsers()->attach($this->worker->id);

        $res = $this->actingAs($this->worker)->postJson("/api/tickets/{$ticket->id}/accept");
        $res->assertStatus(200);

        $ticket->refresh();
        // acceptTicket 把狀態改為 in_progress
        $this->assertEquals('in_progress', $ticket->status);
    }

    public function test_worker_submit_quote()
    {
        $ticket = $this->createSampleTicket(['status' => 'in_progress']);
        $ticket->assignedUsers()->attach($this->worker->id);

        $res = $this->actingAs($this->worker)->postJson("/api/tickets/{$ticket->id}/quote", [
            'quoted_amount' => 5000,
        ]);
        $res->assertStatus(200);

        $ticket->refresh();
        $this->assertEquals(5000, $ticket->quoted_amount);
    }

    public function test_worker_cancel_acceptance()
    {
        // workerCancelAcceptance 需 status in ['dispatched', 'time_proposed']
        $ticket = $this->createSampleTicket(['status' => 'dispatched']);
        $ticket->assignedUsers()->attach($this->worker->id);

        $res = $this->actingAs($this->worker)->postJson("/api/tickets/{$ticket->id}/cancel-accept", [
            'cancel_reason' => '時間衝突無法前往',
        ]);
        $res->assertStatus(200);

        $ticket->refresh();
        $this->assertEquals('dispatched', $ticket->status);
    }

    // ========================
    // 認證保護
    // ========================

    public function test_unauthenticated_access_to_protected_routes()
    {
        $this->getJson('/api/tickets')->assertStatus(401);
        $this->getJson('/api/me')->assertStatus(401);
    }

    // ========================
    // UserSeeder 測試
    // ========================

    public function test_user_seeder_first_or_create()
    {
        // 修改 admin 密碼
        $this->admin->update(['password' => bcrypt('mynewpassword')]);

        // 重新跑 seeder
        $this->seed(\Database\Seeders\UserSeeder::class);

        // admin 密碼不應被重設
        $this->admin->refresh();
        $this->assertTrue(\Hash::check('mynewpassword', $this->admin->password));
        $this->assertFalse(\Hash::check('admin123', $this->admin->password));
    }

    // ========================
    // Helper
    // ========================

    private function createSampleTicket(array $overrides = []): Ticket
    {
        static $counter = 0;
        $counter++;

        return Ticket::create(array_merge([
            'ticket_no' => 'TK-TEST-' . str_pad($counter, 3, '0', STR_PAD_LEFT),
            'title' => '報修工單',
            'customer_name' => '王小明',
            'phone' => '0912345678',
            'address' => 'Taipei City',
            'category' => '水管',
            'description_raw' => '水管漏水',
            'original_text' => '報修',
            'status' => 'new',
            'priority' => 'medium',
        ], $overrides));
    }
}
