<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::firstOrCreate(
            ['username' => 'admin'],
            [
                'name' => '系統管理員',
                'username' => 'admin',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
                'email' => 'admin@demo.com',
            ]
        );
        \Log::info($admin->wasRecentlyCreated ? 'UserSeeder: admin 帳號已建立' : 'UserSeeder: admin 帳號已存在，未修改');

        $worker = User::firstOrCreate(
            ['username' => 'worker1'],
            [
                'name' => '王師傅',
                'username' => 'worker1',
                'password' => Hash::make('worker123'),
                'role' => 'worker',
                'email' => null,
            ]
        );
        \Log::info($worker->wasRecentlyCreated ? 'UserSeeder: worker1 帳號已建立' : 'UserSeeder: worker1 帳號已存在，未修改');
    }
}
