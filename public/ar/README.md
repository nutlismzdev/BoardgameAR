# public/ar — ไฟล์ AR การ์ดจริง (MindAR)

โฟลเดอร์นี้เก็บ **image target** ที่โหลดตอน runtime สำหรับโหมด "ส่องการ์ดจริง"
(`three` + `mind-ar` ติดตั้งผ่าน npm แล้ว โหลดแบบ dynamic import — ไม่ต้องวาง .js ที่นี่)

## ต้องมี 1 ไฟล์ (ยังไม่ commit — ต้องเตรียมเอง)

### `gold-card.mind` — image target (รองรับหลายด้าน = multi-target)
1. เตรียมภาพการ์ด AR ทอง เวอร์ชันสุดท้ายที่จะปริ้นจริง — **หน้าและหลัง** (เช่น `ar-front.png`, `ar-back.png`)
2. คอมไพล์เป็น `.mind` (multi-target):
   - ออนไลน์: https://hiukim.github.io/mind-ar-js-doc/tools/compile
   - อัปโหลด **`ar-front.png` ก่อน (=target 0) แล้ว `ar-back.png` (=target 1)** — ใส่หลายรูปในครั้งเดียวได้
   - กด "Start" → ดาวน์โหลด `targets.mind` → เปลี่ยนชื่อเป็น `gold-card.mind`
3. วางไฟล์ที่ `public/ar/gold-card.mind`

> โค้ดจับ target ตาม `AR.targetIndices` ใน `src/ar/arConfig.ts` — `[0,1]` = จับทั้งหน้าและหลัง
> ถ้าอยากจับด้านเดียว เปลี่ยนเป็น `[0]` · ถ้าคอมไพล์แค่รูปเดียวแต่ตั้ง `[0,1]` ก็ยังทำงาน (target 1 แค่ไม่เจอ)

> path ตั้งใน `src/ar/arConfig.ts` (`mindTargetUrl`)

## หมายเหตุ
- ถ้ายังไม่มี `gold-card.mind` → โหมด AR จะ fallback เป็นวิดีโอปกติ (กล้องหน้า) โดยอัตโนมัติ ไม่ค้าง
- ปริ้นการ์ด **กระดาษด้าน (matte)** ห้ามฟอยล์เมทัลลิก (สะท้อนแสง = tracking พัง)
- ภาพที่คอมไพล์ต้องเป็น "หน้าการ์ดที่จะปริ้นจริง" (ลายตรงกัน tracking ถึงจะแม่น)
- `mind-ar` ติดตั้งด้วย `--ignore-scripts` (ข้ามการ build `canvas` ฝั่ง node ที่ไม่ใช้ในเบราว์เซอร์)
