<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'name' => '系統管理員',
                'username' => 'admin',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
                'email' => 'admin@demo.com',
            ]
        );

        User::updateOrCreate(
            ['username' => 'worker1'],
            [
                'name' => '王師傅',
                'username' => 'worker1',
                'password' => Hash::make('worker123'),
                'role' => 'worker',
                'email' => null,
            ]
        );
    }
}
