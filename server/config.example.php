<?php
// คัดลอกไฟล์นี้เป็น config.php แล้วใส่ค่าจริง (config.php ถูก .gitignore ไว้ — ห้าม commit ค่าจริง)

return [
    // ── ฐานข้อมูล MySQL (ดูค่าจาก phpMyAdmin / โฮสต์ของคุณ) ──
    'db_host' => 'localhost',
    'db_name' => 'boardgame7',
    'db_user' => 'root',
    'db_pass' => '',
    'db_charset' => 'utf8mb4',

    // ── รหัสครู (บัญชีเดียวร่วม) ──
    // สร้าง hash ด้วย:  php -r "echo password_hash('รหัสที่ต้องการ', PASSWORD_DEFAULT), PHP_EOL;"
    // แล้วเอาผลลัพธ์มาวางที่นี่
    'admin_password_hash' => '$2y$10$REPLACE_WITH_YOUR_OWN_HASH',

    // ── กุญแจลับสำหรับเซ็น token (สุ่มยาว ๆ เก็บเป็นความลับ) ──
    // สร้างด้วย:  php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
    'token_secret' => 'REPLACE_WITH_RANDOM_64_HEX',
    'token_ttl_hours' => 12, // token หมดอายุกี่ชั่วโมง

    // ── CORS: origin ที่อนุญาตให้เรียก API (หน้าเว็บเกม/หน้าครู) ──
    'allowed_origins' => [
        'http://localhost:5173',   // dev (vite)
        'http://localhost:4173',   // vite preview
        'https://your-domain.example', // prod — เปลี่ยนเป็นโดเมนจริงของคุณ
    ],
];
