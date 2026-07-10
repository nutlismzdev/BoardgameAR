# Teacher CMS API

PHP/MySQL API สำหรับจัดการคำถามช่องฟ้า, การ์ดความรู้ และคลัง AR ทองแยกจากกัน

## ติดตั้ง

1. สร้างฐานข้อมูล MySQL เช่น `boardgame7`
2. Import `schema.sql` ใน phpMyAdmin
3. Import `seed.sql`
4. คัดลอก `config.example.php` เป็น `config.php`
5. แก้ค่า DB, `admin_password_hash`, `token_secret`, และ `allowed_origins`

สร้างรหัสครู:

```bash
php -r "echo password_hash('รหัสครู', PASSWORD_DEFAULT), PHP_EOL;"
```

สร้าง token secret:

```bash
php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
```

## Endpoints

- `POST auth.php` body `{ "password": "..." }`
- `GET content.php?type=quiz`
- `GET content.php?type=knowledge`
- `GET content.php?type=gold`
- `POST content.php?type=...` ใช้ `Authorization: Bearer <token>`
- `PUT content.php?type=...` ใช้ `Authorization: Bearer <token>`
- `DELETE content.php?type=...&id=...` ใช้ `Authorization: Bearer <token>`
- `POST upload.php` multipart field `video` ใช้ `Authorization: Bearer <token>` สำหรับวิดีโอ AR ทอง

วิดีโอ AR ทองรองรับ MP4, WebM, MOV ขนาดไม่เกิน 200 MB และบันทึกใน `server/uploads/`.
บนโฮสต์จริงต้องตั้ง permission ให้ PHP เขียนโฟลเดอร์นี้ได้.

## Vite

ตั้งค่า `.env`:

```env
VITE_API_BASE=https://your-domain.example/api
```

ถ้าใช้ Cloudflare Tunnel ให้ชี้ path `/api/` ไปยังโฟลเดอร์ PHP นี้ และเพิ่มโดเมนใน `allowed_origins`.
