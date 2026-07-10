# แผนงาน: ระบบหลังบ้านจัดการเนื้อหาการ์ด (Teacher CMS) — PHP + MySQL

> อัปเดตล่าสุด: 2026-07-05 · สถานะ: กำลังพัฒนา

## Context (ทำไปทำไม)

ปัจจุบันคำถามทั้งหมดฝังอยู่ใน `src/data/cards.json` ซึ่ง bundle ตอน build — ครูแก้เนื้อหาเองไม่ได้ ต้องแก้โค้ดแล้ว rebuild ทุกครั้ง

**เป้าหมาย:** ให้ครู **เพิ่ม / ลบ / แก้ไข** คำถามของการ์ด 3 ชนิดได้อิสระผ่านหน้าเว็บหลังบ้าน โดยเก็บบันทึกที่ **เซิร์ฟเวอร์จริง + ฐานข้อมูล**

**การตัดสินใจที่ล็อกไว้:**
- Backend = **PHP REST API + MySQL** (เข้ากับ infra เดิม: เซิร์ฟเวอร์ของผู้ใช้ + phpMyAdmin + Cloudflare Tunnel + โดเมนเอง)
- **แยกคลังคำถาม AR ทองต่างหาก** (`gold_quiz`) — เดิมช่องทองใช้คลัง `quiz` ร่วมกับช่องฟ้า
- Auth = **รหัส/บัญชีเดียวร่วม** (shared password)
- เกมยัง**เล่นออฟไลน์ได้**: sync เนื้อหาจากเซิร์ฟเวอร์ → แคช localStorage → เล่นจากแคช; `cards.json` เป็น seed/fallback
- **กษัตริย์ 7 พระองค์ (`kings.json`) ไม่อยู่ในขอบเขต** — คงบันเดิลไว้ (ครูแก้แค่คำถาม/การ์ด)

---

## สถาปัตยกรรมภาพรวม

```
[หน้าครู (React Admin)]  --login + CRUD-->  [PHP API]  <-->  [MySQL]
                                               ^
[เกม (PWA)]  --GET sync ครั้งแรก/เป็นระยะ-->   |
     |  cache ลง localStorage
     v
  เล่นจากแคช (ออฟไลน์ได้) ; ถ้าไม่เคย sync ใช้ cards.json (seed)
```

---

## ส่วนที่ 1 — ฐานข้อมูล MySQL (สร้างผ่าน phpMyAdmin)

ไฟล์ `server/schema.sql` + `server/seed.sql`:

- **`quiz`** (ช่องคำถามฟ้า) — `id VARCHAR PK`, `king_id`, `difficulty ENUM('easy','medium','hard')`, `reward INT`, `time_limit_sec INT`, `question TEXT`, `choices JSON`, `explanation TEXT`, `updated_at`
- **`knowledge`** (การ์ดความรู้ชมพู) — `id`, `king_id`, `title`, `body TEXT`, `question TEXT`, `choices JSON`, `updated_at`
- **`gold_quiz`** (คลัง AR ทอง **ใหม่**) — โครงเดียวกับ `quiz`
- **`app_config`** — เก็บ `admin_password_hash` + `content_version` (bump ทุกครั้งที่แก้)

`choices` = JSON array ของ `{text, correct}` (ตรงกับ `QuizChoice`)

`seed.sql` = แปลงข้อมูลจาก `cards.json` → insert เข้า `quiz` + `knowledge`; และ **คัดลอก `quiz` → `gold_quiz`** เป็นค่าตั้งต้น

---

## ส่วนที่ 2 — PHP REST API (โฟลเดอร์ `server/`)

- `server/config.example.php` — ตัวอย่างค่า DB + รหัสครู + token secret + CORS *(config.php จริงไม่ commit)*
- `server/db.php` — สร้าง PDO (prepared statements)
- `server/lib.php` — helper: ส่ง JSON, CORS, อ่าน body, ตรวจ token, bump `content_version`
- `server/auth.php` — `POST` ตรวจรหัสครู → คืน token (signed HMAC มีวันหมดอายุ, stateless)
- `server/content.php` — endpoint หลัก:
  - `GET  ?type=quiz|knowledge|gold` → คืนทั้งคลัง + `content_version` (**public** ให้เกม sync)
  - `POST` (token) → เพิ่ม 1 การ์ด
  - `PUT` (token) → แก้ตาม id
  - `DELETE ?type=&id=` (token) → ลบ
  - ทุก write → bump `content_version`

Response: `{ ok, data, version, error? }` JSON ล้วน UTF-8 · CORS อนุญาต prod + `localhost:5173`

**Cloudflare Tunnel**: ชี้มาที่ path PHP (เช่น `https://โดเมน/api/`) — รายละเอียดใน `server/README.md`

---

## ส่วนที่ 3 — Frontend: ชั้นเชื่อมต่อ + sync

### 3.1 `src/core/api.ts` (ใหม่)
- base URL จาก `import.meta.env.VITE_API_BASE`
- `login(password)` → เก็บ token ใน `localStorage['bg7_admin_token']`
- `fetchContent(type)`, `createCard/updateCard/deleteCard(type, payload)` (แนบ token header)

### 3.2 Refactor `src/core/content.ts` (จุดระวังสุด)
- คงชื่อ/ลายเซ็น getter เดิม (`getQuizForKing`, `getRandomKnowledge`, `getKing`, `KINGS`, `KNOWLEDGE_CAP`) ไม่กระทบ consumer ~10 ไฟล์
- ภายในเปลี่ยน `QUIZ`/`KNOWLEDGE`/`GOLD` เป็น `let` — seed จาก `cards.json` (gold seed = ก็อป quiz)
- `hydrateFromCache()` — อ่าน `localStorage['bg7_content']` ทับ seed (เรียกก่อน React mount)
- `syncContent()` (async) — ดึง API 3 type สำเร็จ → อัปเดตอาเรย์ + เขียนแคช; fail → เงียบ ใช้แคช/seed
- เพิ่ม **`getGoldQuizForKing(kingId, difficulty, excludeIds)`** (pool = `GOLD`)
- `KNOWLEDGE_TOTAL` → เปลี่ยนเป็น `knowledgeTotal()` (ไม่มี consumer ภายนอก)

### 3.3 `src/App.tsx` — `useEffect` เรียก `syncContent()` ครั้งเดียวตอน mount

### 3.4 ต่อคลัง gold แยกใน UI เกม
- `src/components/CardModal.tsx` (~บรรทัด 42): ช่องทอง → เรียก `getGoldQuizForKing` (ช่องฟ้ายังใช้ `getQuizForKing`)
- `ARGoldChallenge.tsx` — ไม่ต้องแก้ (รับ `quiz` เป็น prop อยู่แล้ว)

### 3.5 `src/core/types.ts` — alias `GoldQuizCard = QuizCard` (โครงเหมือนกัน)

---

## ส่วนที่ 4 — หน้าครู (Admin CMS UI)

`src/screens/Admin/AdminPanel.tsx` (+ ฟอร์มย่อย) — full-screen modal

**ทางเข้า:** ปุ่มใน `src/screens/Settings/Settings.tsx` → "📚 จัดการเนื้อหาการ์ด (หลังบ้าน)"

**Flow:**
1. ไม่มี token → หน้า **Login** (ช่องรหัสครู) → `api.login()`
2. เข้าแล้ว → 3 แท็บ: **คำถาม (ฟ้า) · ความรู้ (ชมพู) · AR ทอง**
3. กรองตามพระองค์ (dropdown จาก `KINGS`) → ลิสต์การ์ด → ปุ่ม **เพิ่ม / แก้ไข / ลบ**
4. ฟอร์ม (reuse quiz & gold): `king_id`, `question`, ตัวเลือก 4 ข้อ + ติ๊กข้อถูก, `difficulty`, `reward`, `time_limit_sec`, `explanation`
   - ฟอร์มความรู้: `king_id`, `title`, `body`, `question`, ตัวเลือก + ข้อถูก
   - validate: มีข้อถูกอย่างน้อย 1, ไม่ว่าง
5. บันทึก → API → refresh + `syncContent()`
6. ปุ่ม "ออกจากระบบ" (ล้าง token)

สไตล์: ใช้ `@/theme/tokens` + ปุ่มแตะง่ายแบบแท็บเล็ต

---

## ส่วนที่ 5 — Config / env

- `.env` (ไม่ commit): `VITE_API_BASE=https://โดเมนของคุณ/api`
- `.env.example`, `server/config.example.php`, `server/README.md` (ขั้นตอน deploy)

---

## ไฟล์ที่แตะ/สร้าง

**สร้างใหม่:**
- `server/` : `schema.sql`, `seed.sql`, `config.example.php`, `db.php`, `lib.php`, `auth.php`, `content.php`, `README.md`
- `src/core/api.ts`
- `src/screens/Admin/AdminPanel.tsx` (+ ฟอร์มย่อย)
- `.env.example`

**แก้ไข:**
- `src/core/content.ts` (hydrate-able + `getGoldQuizForKing` + `syncContent`)
- `src/components/CardModal.tsx` (ช่องทอง → `getGoldQuizForKing`)
- `src/screens/Settings/Settings.tsx` (ปุ่มเข้าหลังบ้าน)
- `src/App.tsx` (เรียก `syncContent`)
- `src/core/types.ts` (alias `GoldQuizCard`)
- `.gitignore` (เพิ่ม `server/config.php`, `.env`)

**ไม่แตะ:** `kings.json`, `board-*.json`, `store.ts` (ยกเว้นจำเป็น), ระบบเกมหลัก

---

## การทดสอบ (Verification)

1. **DB**: import `schema.sql`+`seed.sql` → เช็ก 3 ตาราง (quiz 14, knowledge 14, gold_quiz 14)
2. **API (curl)**: `GET content.php?type=quiz` คืน JSON · `POST` ไม่มี token → 401 · login → token · POST มี token → เพิ่มได้
3. **เกม**: `npm run dev` → ช่องฟ้า/ทอง/ชมพู คำถามมาจากคลังถูกต้อง (ทองแยกจากฟ้า) · ปิดเน็ต → ยังเล่นได้
4. **หน้าครู**: เปิดจากโหมดครู → login → เพิ่ม/แก้/ลบ → เล่นเกมเห็นเนื้อหาใหม่
5. **Build**: `npm run build` ผ่าน
6. **ออฟไลน์**: หลัง sync แรก ปิดเน็ต → รีโหลด → ได้เนื้อหาล่าสุดจากแคช

---

## จุดเสี่ยง / ต้องระวัง
- **CORS + Cloudflare**: dev + prod ต้องอยู่ใน allow-list ของ PHP
- **รหัสเดียวร่วม**: เก็บ `password_hash()`, token หมดอายุได้, write ต้องมี token — ปลอดภัยระดับห้องเรียน
- **content.ts เป็น hot path**: hydrate seed/แคชแบบ synchronous ก่อน React mount กัน getter ว่าง
- เนื้อหาประวัติศาสตร์ยังเป็นตัวอย่าง — ครูต้องตรวจก่อนใช้จริง

---

## ความคืบหน้า (Checklist)

- [x] `server/config.example.php`
- [x] `server/db.php`
- [x] `server/lib.php`
- [x] `server/auth.php`
- [x] `server/content.php`
- [x] `server/schema.sql`
- [x] `server/seed.sql`
- [x] `server/README.md`
- [x] `.gitignore` + `.env.example`
- [x] `src/core/types.ts` (alias)
- [x] `src/core/api.ts`
- [x] `src/core/content.ts` (refactor)
- [x] `src/App.tsx` (sync)
- [x] `src/components/CardModal.tsx` (gold pool)
- [x] `src/screens/Settings/Settings.tsx` (ปุ่ม)
- [x] `src/screens/Admin/AdminPanel.tsx`
- [x] `npm run build` ผ่าน
