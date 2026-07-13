# DEPLOY.md — รัน "บอร์ดเกม 7 มหาราช" บน **Windows Server** (Production)

คู่มือ deploy บน Windows Server ด้วย **PowerShell** + **pm2** (คุมโปรเซส) + **Cloudflare Tunnel** (เปิดสู่อินเทอร์เน็ตโดยไม่ต้องเปิดพอร์ต/ไม่ต้องมี public IP)

> ⚠️ **อ่านก่อน — สแตกนี้ไม่มี Node server แบบ backend**
> - **Frontend** = React + Vite → รันด้วย **vite dev server** (`npm run dev:local`) ที่พอร์ต `5174` ซึ่ง **มี proxy `/api` → PHP ในตัว** → พอร์ตเดียวเสิร์ฟทั้งหน้าเว็บ + API
> - **Backend** = **PHP** (`server\*.php`) + **MySQL** — ไม่ใช่ Node
> - เราจึงใช้ pm2 **หุ้ม 2 โปรเซส**: vite (`5174`) และ `php -S` (`8000`) · **MySQL รันเป็น Windows Service** (ไม่เอาเข้า pm2)
> - **Cloudflare Tunnel รันเป็น Windows Service อยู่แล้ว** (แชร์กับแอปอื่นในองค์กร) และเป็นแบบ **remotely-managed** (จัดการ public hostname ผ่าน **dashboard** ไม่ใช่ `config.yml`)

> 📌 ค่าจริงที่ใช้ในเอกสารนี้:
> - โปรเจกต์อยู่ที่ `C:\BoardGameAR`
> - โดเมน **`boardgame.itac-huahincity.com`**
> - Cloudflare Tunnel ชื่อ **`cctvrequest`** (รันเป็น service ด้วย `cloudflared tunnel run --token …`)

---

## 0) ภาพรวมสถาปัตยกรรม (production)

```
                         Cloudflare Edge (HTTPS)
                                  │
              Cloudflare Tunnel (service: cctvrequest, remotely-managed)
              public hostname ตั้งใน dashboard → localhost:5174
                                  │
                     boardgame.itac-huahincity.com
                                  │
                     pm2: bg7-web  (vite dev :5174)
                     ├─ เสิร์ฟ frontend (React)
                     └─ proxy /api/*  ─────────────┐
                                                    │  (ตัด /api ออก)
                                          pm2: bg7-api (php -S 127.0.0.1:8000 -t server)
                                          เสิร์ฟ *.php + \uploads\*
                                                    │
                                          MySQL (Windows Service, 127.0.0.1:3306)
```

**ทำไมพอร์ตเดียว (5174):** `vite.config.ts` ตั้ง proxy ให้ `/api/*` วิ่งไป `127.0.0.1:8000` (ตัด prefix `/api` ออกอัตโนมัติ) → เบราว์เซอร์คุยกับ origin เดียว (`boardgame.itac-huahincity.com`) ทั้งหน้าเว็บและ API → **ไม่มีปัญหา CORS** และ Cloudflare Tunnel ชี้ปลายทางเดียว (`localhost:5174`)

> ⚠️ **หมายเหตุ production:** วิธีนี้ใช้ **vite dev server** เป็นตัวเสิร์ฟจริง — เหมาะกับ **ห้องเรียน/โหลดไม่สูง** (ตามการใช้งานจริงของโปรเจกต์นี้) ไม่ได้ optimize/hardened เท่า static build ถ้าต้องรับโหลดสูง/ใช้งานยาว ดู **ภาคผนวก B** (build จริง) หรือ **ภาคผนวก C** (IIS)

---

## 1) ติดตั้งของที่ต้องมี (รัน PowerShell แบบ Administrator)

ใช้ **winget** (มากับ Windows Server 2022+/Windows 11) ถ้าไม่มีให้ดาวน์โหลด installer เอง

```powershell
winget install OpenJS.NodeJS.LTS          # Node LTS + npm
winget install Oracle.MySQL               # MySQL Server (หรือ MariaDB)
# cloudflared: มีติดตั้งเป็น Windows Service อยู่แล้ว (แชร์กับแอปอื่น) — ปกติไม่ต้องลงใหม่
```

PHP: winget อาจไม่มี — ดาวน์โหลด Thread-Safe (TS) x64 zip จาก https://windows.php.net/download/ แตกไปที่ `C:\php` แล้วเพิ่ม `C:\php` เข้า PATH ระบบ (ถาวร) แล้วเปิด PowerShell ใหม่:

```powershell
[Environment]::SetEnvironmentVariable('Path', $env:Path + ';C:\php', 'Machine')
```

ตั้งค่า `php.ini` (เปิดส่วนขยายที่ API ใช้ + เพิ่มลิมิตอัปโหลดวิดีโอ AR):

```powershell
Copy-Item C:\php\php.ini-production C:\php\php.ini
# แก้ C:\php\php.ini:
#   extension_dir = "ext"
#   เอา ; หน้าบรรทัดเหล่านี้ออก:  extension=pdo_mysql  ·  extension=mbstring  (fileinfo ปกติเปิดอยู่)
#   ⚠️ วิดีโอ AR รับได้ถึง 200 MB แต่ค่าตั้งต้น PHP เล็กมาก (2M) — ต้องเพิ่ม:
#       upload_max_filesize = 210M
#       post_max_size = 220M
#       memory_limit = 256M   (อย่างน้อย)
#       max_execution_time = 300
```

ติดตั้ง dependencies ของโปรเจกต์ + pm2:

```powershell
cd C:\BoardGameAR
npm ci                     # ติดตั้ง node_modules (รวม vite)
npm install -g pm2
```

ตรวจเวอร์ชัน:

```powershell
node -v; php -v; pm2 -v; cloudflared --version
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" --version
```

> ถ้า `php -v` แล้วเตือน extension โหลดไม่ได้ = แก้ `extension_dir`/บรรทัด extension ใน php.ini ยังไม่ถูก

---

## 2) เตรียมฐานข้อมูล MySQL

เพิ่ม path ของ mysql.exe เข้า session (หรือใส่ PATH ถาวร):

```powershell
$env:Path += ';C:\Program Files\MySQL\MySQL Server 8.0\bin'
```

สร้าง DB + user:

```powershell
mysql -u root -p -e "CREATE DATABASE boardgame7 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'bg7'@'localhost' IDENTIFIED BY 'ตั้งรหัสยาก';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON boardgame7.* TO 'bg7'@'localhost'; FLUSH PRIVILEGES;"
```

นำเข้า schema + seed — ⚠️ **PowerShell ไม่รองรับ `<` redirect** ให้ใช้ `Get-Content | mysql` แทน:

```powershell
Get-Content -Raw C:\BoardGameAR\server\schema.sql | mysql -u bg7 -p boardgame7
Get-Content -Raw C:\BoardGameAR\server\seed.sql   | mysql -u bg7 -p boardgame7
```

> `content.php` auto-migrate ตาราง `subject_quiz`/คอลัมน์ `gold_quiz.video_url` ให้ DB เดิม

---

## 3) ตั้งค่า Backend (`server\config.php`)

```powershell
Copy-Item C:\BoardGameAR\server\config.example.php C:\BoardGameAR\server\config.php
```

สร้างค่าลับ:

```powershell
php -r "echo password_hash('รหัสครูที่ต้องการ', PASSWORD_DEFAULT), PHP_EOL;"   # -> admin_password_hash
php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"                              # -> token_secret
```

แก้ `C:\BoardGameAR\server\config.php`:

```php
return [
    'db_host' => 'localhost',
    'db_name' => 'boardgame7',
    'db_user' => 'bg7',
    'db_pass' => 'รหัส DB ที่ตั้งไว้',
    'db_charset' => 'utf8mb4',

    'admin_password_hash' => '$2y$10$...ผลจาก password_hash...',
    'token_secret' => '...ผล bin2hex 64 ตัว...',
    'token_ttl_hours' => 12,

    // setup พอร์ตเดียว (5174 + proxy) เป็น same-origin จึงไม่พึ่ง CORS
    // ใส่โดเมนหน้าเว็บไว้ก็ไม่เสียหาย (เผื่อวันหน้าเรียก API ข้าม origin)
    'allowed_origins' => [
        'https://boardgame.itac-huahincity.com',
    ],
];
```

> `config.php` ถูก `.gitignore` — ห้าม commit

ให้บัญชีที่รัน PHP เขียนโฟลเดอร์อัปโหลดวิดีโอ AR ได้ (NTFS):

```powershell
New-Item -ItemType Directory -Force C:\BoardGameAR\server\uploads | Out-Null
# ให้สิทธิ์ Modify แก่บัญชีที่จะรัน pm2/php (แก้ USERNAME เป็นบัญชีจริง เช่น เครื่อง\Administrator)
icacls C:\BoardGameAR\server\uploads /grant "USERNAME:(OI)(CI)M"
```

---

## 4) ตั้งค่า Frontend (ไม่ต้อง build — ใช้ vite dev server)

vite dev อ่านตัวแปรจาก `.env.local` — ต้องตั้ง `VITE_API_BASE=/api` (client เรียก `/api/...` แล้วให้ vite proxy ตัด `/api` ส่งไป php:8000)

```powershell
cd C:\BoardGameAR
# เขียน .env.local แบบ UTF-8 ไม่มี BOM (สำคัญ — BOM ทำให้ vite อ่านค่าเพี้ยน)
Set-Content -Path .env.local -Value 'VITE_API_BASE=/api' -Encoding utf8NoBOM
```

> ⚠️ `-Encoding utf8NoBOM` ใช้ได้กับ **PowerShell 7+** · ถ้าเป็น Windows PowerShell 5.1 ให้ใช้:
> `[IO.File]::WriteAllText("$PWD\.env.local", "VITE_API_BASE=/api")`

**สำคัญ — `allowedHosts`:** vite 5.4.12+ บล็อก Host ที่ไม่รู้จัก (กัน DNS-rebinding) ต้อง allow โดเมนที่เข้าผ่าน tunnel ไว้ใน `vite.config.ts` (ตั้งไว้แล้วในโปรเจกต์นี้):

```ts
server: {
  host: true,
  allowedHosts: ['boardgame.itac-huahincity.com'],  // ← ถ้าเปลี่ยนโดเมนต้องแก้ตรงนี้
  proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') } },
}
```

> ถ้าลืม/โดเมนไม่ตรง → เปิดผ่านโดเมนจะขึ้น **"Blocked request. This host is not allowed."**

---

## 5) รันด้วย pm2 (PowerShell)

ใส่ **absolute path** กัน cwd เพี้ยน:

```powershell
cd C:\BoardGameAR

# 1) backend — php -S (interpreter none = รัน exe ตรง ไม่ผ่าน node), cwd ต้องเป็นรากโปรเจกต์


# 2) frontend — vite dev :5174 (เรียก vite.js ตรง เลี่ยงปัญหา npm.cmd บน pm2/Windows)
pm2 start "C:\BoardGameAR\node_modules\vite\bin\vite.js" --name bg7-web --cwd C:\BoardGameAR `
  --interpreter node -- --host 127.0.0.1 --port 5174

pm2 status
pm2 logs bg7-api --lines 30     # ดู error PHP ถ้ามี
```

> ถ้า `pm2 start php` หา php ไม่เจอ ให้ใช้ full path: `pm2 start "C:\php\php.exe" ...`

**ตรวจบนเครื่องก่อนต่อ tunnel** (ใช้ `curl.exe` = curl จริงของ Windows ไม่ใช่ alias):

```powershell
curl.exe -s http://127.0.0.1:5174/ | Select-Object -First 1              # ควรได้ HTML ของหน้าเว็บ
curl.exe -s "http://127.0.0.1:5174/api/content.php?type=quiz"            # ควรได้ JSON ผ่าน proxy
curl.exe -s "http://127.0.0.1:8000/content.php?type=quiz"               # เช็ก php ตรง ๆ
```

`content.php` ควรคืน JSON `{"ok":true,...}` · ถ้าได้ `missing config.php` = ข้าม step 3 · `db connection failed` = ค่า DB ผิด

### ให้ pm2 ฟื้นเองหลังรีบูต (Windows)

`pm2 startup` **ไม่รองรับ Windows** — เลือกวิธีใดวิธีหนึ่ง:

- **แนะนำ (เซิร์ฟเวอร์ headless ไม่ต้อง login):** ติดตั้ง pm2 เป็น Windows Service ด้วย [pm2-installer](https://github.com/jessety/pm2-installer) (ใช้ nssm ภายใน) แล้ว `pm2 save`
- **ง่ายกว่าแต่ต้องมีการ login ของ user:**
  ```powershell
  npm install -g pm2-windows-startup
  pm2-startup install
  pm2 save
  ```

---

## 6) เปิดสู่อินเทอร์เน็ตด้วย Cloudflare Tunnel (dashboard-managed)

Tunnel `cctvrequest` รันเป็น **Windows Service** อยู่แล้ว ด้วยคำสั่งแบบ token:

```
cloudflared.exe tunnel run --token eyJ…
```

> 🔑 **แบบ token = remotely-managed** → cloudflared **ไม่อ่าน `config.yml` ในเครื่อง** (ไฟล์ `C:\Users\<user>\.cloudflared\config.yml` เป็นของ tunnel เก่าที่ไม่ได้ใช้ — **อย่าไปแก้ ไม่มีผล**) ทุกอย่างตั้งผ่าน **Cloudflare Zero Trust dashboard**

**เพิ่ม public hostname ของบอร์ดเกม (ทำครั้งเดียว):**

1. เข้า **Cloudflare Zero Trust dashboard** → **Networks → Tunnels** → เลือก tunnel **`cctvrequest`**
2. แท็บ **Public Hostname** → **Add a public hostname** → กรอก:

   | ช่อง | ค่า |
   |---|---|
   | **Subdomain** | `boardgame` |
   | **Domain** | `itac-huahincity.com` |
   | **Path** | **เว้นว่าง** (สำคัญ — พอร์ตเดียวเสิร์ฟทุก path ทั้งหน้าเว็บ + `/api`) |
   | **Type** | `HTTP` |
   | **URL** | `localhost:5174` |

3. กด **Save** → DNS (`boardgame.itac-huahincity.com`) ถูกสร้างอัตโนมัติ · การตั้งค่า push ลง service ทันที **ไม่ต้อง restart**

> ⚠️ **Path ต้องเว้นว่าง** — ห้ามใส่ `^/api` เพราะ vite เสิร์ฟทั้ง frontend และ proxy `/api` บนพอร์ตเดียว
> ⚠️ **Type = HTTP** (ไม่ใช่ HTTPS) เพราะ vite dev เสิร์ฟ HTTP ธรรมดา

---

## 7) ตรวจ end-to-end (จากภายนอก)

```powershell
curl.exe -sI https://boardgame.itac-huahincity.com | Select-Object -First 1        # HTTP/2 200
curl.exe -s "https://boardgame.itac-huahincity.com/api/content.php?type=subject"   # {"ok":true,...}
```

จากนั้นเปิด `https://boardgame.itac-huahincity.com` บนแท็บเล็ต → หมุนจอแนวนอน → Settings → หลังบ้าน (login รหัสครู) เพื่อยืนยัน CRUD + อัปโหลดวิดีโอ

---

## 8) อัปเดตเวอร์ชันใหม่ (redeploy)

```powershell
cd C:\BoardGameAR
git pull
npm ci                   # ถ้า package.json เปลี่ยน (มี dependency ใหม่)
pm2 restart bg7-web      # โหลดโค้ด frontend ใหม่ (vite ไม่ต้อง build)
pm2 restart bg7-api      # ถ้าแก้ไฟล์ PHP ใน server\
# แก้ schema DB ต้องรัน migration/schema เพิ่มเอง (ดู CLAUDE.md)
```

> `server\config.php` และ `.env.local` ถูก `.gitignore` — git pull จะไม่ทับ

---

## ภาคผนวก A — เปลี่ยนโดเมน/พอร์ต

- **เปลี่ยนโดเมน:** แก้ 2 ที่ → `allowedHosts` ใน `vite.config.ts` + `allowed_origins` ใน `config.php` แล้วไปแก้ public hostname ใน Cloudflare dashboard
- **เปลี่ยนพอร์ต frontend:** แก้ `--port` ใน pm2 (bg7-web) + URL ใน dashboard ให้ตรง
- **เปลี่ยนพอร์ต backend:** แก้ `-S 127.0.0.1:<port>` (bg7-api) + `target` ของ proxy ใน `vite.config.ts`

## ภาคผนวก B — production จริงจัง: static build (ไม่ใช้ dev server)

ถ้าต้องรับโหลดสูง/ใช้งานยาว ให้เลิกใช้ vite dev แล้ว build เป็น static + เสิร์ฟด้วย router เดียวที่รวม frontend + API:

```powershell
cd C:\BoardGameAR
Set-Content -Path .env.production -Value 'VITE_API_BASE=/api' -Encoding utf8NoBOM
npm run build        # -> dist\
```

สร้าง `server\router-single.php` (พอร์ตเดียวเสิร์ฟ dist\ + /api → server\):

```php
<?php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/api(/.*)?$#', $uri, $m)) {
    $path = $m[1] ?: '/'; $file = __DIR__ . $path;          // __DIR__ = server\
    if ($path !== '/' && file_exists($file) && !is_dir($file)) {
        if (substr($file, -4) === '.php') { $_SERVER['SCRIPT_NAME'] = '/api' . $path; require $file; return true; }
        header('Content-Type: ' . (mime_content_type($file) ?: 'application/octet-stream'));
        header('Content-Length: ' . filesize($file)); readfile($file); return true;   // uploads\*
    }
    http_response_code(404); echo '{"ok":false,"error":"not found"}'; return true;
}
$distFile = 'C:/BoardGameAR/dist' . $uri;
if ($uri !== '/' && file_exists($distFile) && !is_dir($distFile)) return false;        // static จาก -t
require 'C:/BoardGameAR/dist/index.html'; return true;                                  // SPA fallback
```

```powershell
pm2 delete bg7-web bg7-api 2>$null
pm2 start php --name bg7 --interpreter none --cwd C:\BoardGameAR\server `
  -- -S 127.0.0.1:5174 -t C:\BoardGameAR\dist server\router-single.php
pm2 save
```

Cloudflare dashboard: URL ยังชี้ `localhost:5174` เหมือนเดิม (แค่เปลี่ยนเบื้องหลังจาก vite เป็น php router)

> ข้อจำกัด: `readfile` ไม่รองรับ Range/seek ของวิดีโอ และ `php -S` เป็น single-thread — ถ้าโหลดจริงจังใช้ **ภาคผนวก C (IIS)**

## ภาคผนวก C — production ระดับองค์กร: **IIS + PHP (FastCGI)**

ถ้าต้องรับหลายเครื่องพร้อมกัน/ใช้งานยาว ให้ใช้ **IIS** (มากับ Windows Server):

1. เปิด IIS + CGI: `Install-WindowsFeature Web-Server, Web-CGI`
2. ติดตั้ง PHP ผ่าน Web Platform Installer หรือผูก FastCGI เอง (Handler Mapping: `*.php` → `C:\php\php-cgi.exe`)
3. `npm run build` แล้วตั้ง site root = `C:\BoardGameAR\dist` (static + URL Rewrite fallback ไป `index.html`) + application `/api` ชี้ `C:\BoardGameAR\server` (PHP)
4. Cloudflare dashboard ชี้ URL ไปพอร์ต IIS (เช่น `localhost:8080`) แทน 5174

IIS จัดการ concurrency/process recycling/logging/Range request ได้จริง เหมาะกับ production ระยะยาวบน Windows มากกว่า vite dev / `php -S`

## Troubleshooting (Windows)

| อาการ | สาเหตุที่พบบ่อย |
|---|---|
| `Blocked request. This host is not allowed.` | ไม่ได้ใส่โดเมนใน `allowedHosts` (`vite.config.ts`) หรือแก้แล้วไม่ได้ `pm2 restart bg7-web` |
| หน้าเว็บขึ้นแต่ CMS ไม่ซิงก์ / API พัง | `.env.local` ไม่มี `VITE_API_BASE=/api` หรือมี **BOM** · php (bg7-api) ไม่รัน · proxy target พอร์ตผิด |
| `Get-Content ... < file` error | PowerShell ไม่รองรับ `<` — ใช้ `Get-Content -Raw file \| mysql ...` |
| เปิดโดเมนแล้ว 502 | pm2 bg7-web (5174) ไม่รัน หรือ URL ใน dashboard ผิดพอร์ต |
| API 404 ทุก endpoint | ใส่ **Path** ใน dashboard (ต้องเว้นว่าง) หรือ php ไม่รัน |
| `php` ไม่รู้จัก / extension โหลดไม่ได้ | ยังไม่ได้ใส่ `C:\php` ใน PATH หรือ php.ini ตั้ง `extension_dir`/`extension=pdo_mysql` ไม่ถูก |
| `db connection failed` | ค่า DB ใน `config.php` ผิด/ user ไม่มีสิทธิ์ |
| อัปโหลดวิดีโอ AR ไม่ได้ | `server\uploads\` ไม่มีสิทธิ์เขียน (ตั้ง icacls) · ไฟล์เกิน 200 MB / ไม่ใช่ MP4·WebM·MOV · `upload_max_filesize`/`post_max_size` ใน php.ini เล็กเกินไป |
| แก้ `config.yml` แล้วไม่มีผล | tunnel เป็น **dashboard-managed (token)** — ต้องแก้ที่ Cloudflare dashboard ไม่ใช่ config.yml |
| pm2 หายหลังรีบูต | ยังไม่ได้ตั้ง pm2 เป็น service (pm2-installer) หรือ `pm2 save` |
