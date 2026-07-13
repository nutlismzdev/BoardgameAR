# AR การ์ดจริง — Live Plan (ช่องทอง / เหรียญกษัตริย์)

> เอกสาร "แผนมีชีวิต" — อัปเดตทุกครั้งที่ทำคืบ ติ๊ก `[x]` เมื่อเสร็จ
> อัปเดตล่าสุด: 2026-07-13 · สถานะ: **เฟส 3 (hand-tracking บนสตรีมเดียว)**

## เป้าหมาย

ปริ้นการ์ด AR ใบจริง → เปิดกล้อง (หลัง) ส่องการ์ด → **วิดีโอบทเรียนเล่นทับบนการ์ด** (image-target AR)
→ ตอบคำถามด้วย **hand-tracking (จีบนิ้ว)** ผ่านกล้องเดียวกัน → ถูก = ได้เหรียญกษัตริย์

## ข้อสรุปที่ล็อกแล้ว (จากผู้ใช้ 2026-07-13)

1. **อุปกรณ์:** iPad (Safari) + Android tablet (Chrome) → **ต้องใช้ MindAR** (WebXR ตกรอบเพราะ iOS ไม่รองรับ)
2. **การตอบ:** ใช้ hand-tracking (จีบนิ้ว) ต้องเนียน น่าเชื่อ
3. **การ์ด:** ใช้ดีไซน์ปัจจุบัน (AR = ทอง ชัดเจน) → **การ์ด AR ใบเดียวเป็น target** พระองค์/วิดีโอมาจาก state เกม
4. **วิดีโอ:** เก็บในเครื่อง ตาม flow เดิม (`quiz.videoUrl` / local)

## สถาปัตยกรรม (ล็อก)

```
กล้องหลัง — 1 สตรีม — 1 <video> (ไม่ mirror)
   ├── MindAR (TF.js)  → track การ์ดทอง → THREE.VideoTexture ทับการ์ด
   └── MediaPipe hands → จีบนิ้ว → คำตอบ (reuse logic 2D จาก DragQuestion)
```

- **การ์ด AR ใบเดียว = image target เดียว** (targetIndex 0); พระองค์เลือกจาก `resolveLanding`
- **คำตอบเป็น overlay 2D** บนภาพกล้อง (ไม่ใช่วัตถุ 3D) → reuse `DragQuestion` เดิม
- ส่วนที่เป็น AR จริง = "วิดีโอบนการ์ด" เท่านั้น (เนียน + งานน้อย + เสี่ยงต่ำ)
- โหลด MindAR แบบ **สคริปต์ prebuilt ใน `public/ar/`** (ออฟไลน์ เหมือน mediapipe wasm) ไม่ผ่าน bundler

## Performance strategy (แท็บเล็ต)

| สเตจ | MindAR | MediaPipe | หมายเหตุ |
|---|---|---|---|
| scan | detect | off | เล็งการ์ด + UI นำทาง |
| video | track | off | วิดีโอ 15 วิ ทับการ์ด |
| question | เลือก A/B | track | ตอบด้วยจีบนิ้ว |

- **A** คง MindAR (overlay เกาะการ์ด, GPU หนัก — ลด detection rate)
- **B** ล็อก pose ปิด MindAR (เบา ลื่น, เหมาะวางแท็บเล็ตนิ่ง) ← เริ่มด้วยอันนี้

## ข้อกำหนดการปริ้นการ์ด

- [ ] ปริ้น **กระดาษด้าน (matte)** สีทองแบบหมึก **ห้ามฟอยล์เมทัลลิก** (สะท้อนแสง = tracking พัง)
- [ ] ขนาดคงที่ (แนะนำ 6×9 ซม.)
- [ ] เล่นแบบ **วางแท็บเล็ตบนขาตั้ง ส่องลงการ์ดบนโต๊ะ** (มือว่างจีบนิ้ว)

---

## เฟส 0 — MVP เร็ว (ทางเลือก/fallback)
- [ ] QR มุมการ์ด → jsQR → เล่นวิดีโอเต็มจอ + ตอบ UI เดิม (fallback ถ้า AR ไม่ติด)

## เฟส 1 — วางฐาน (build-safe, ยังไม่ผูก flow) ← **กำลังทำ**
- [x] เขียน live plan (ไฟล์นี้)
- [x] `useHandTracking` เพิ่ม option `mirror` (กล้องหลังไม่ mirror)
- [x] `src/ar/arConfig.ts` — ค่าคงที่ (path .mind, script, target index, timeout)
- [x] `public/ar/README.md` — วิธีคอมไพล์ `.mind` + วางไฟล์ MindAR
- [x] `src/ar/imageTracker.ts` — โครง wrapper MindAR (โหลดสคริปต์ runtime, start/stop/found/lost) *[skeleton — เติมส่วน THREE/MindAR ตอนทดสอบเครื่องจริง]*
- [x] `npm run build` ผ่าน (imageTracker ยัง isolated → tree-shaken ไม่กระทบ bundle/flow)

## เฟส 2 — ต่อ AR จริง (โค้ดเสร็จ · build ผ่าน · ต้องทดสอบเครื่อง)
- [x] ~~ดาวน์โหลด js วาง public~~ → เปลี่ยนเป็น **npm** `three@0.152.0` + `mind-ar@1.2.5` (`--ignore-scripts` ข้าม canvas) + dynamic import (lazy chunk)
- [x] **คอมไพล์ภาพการ์ดทอง → `public/ar/gold-card.mind`**
- [x] `imageTracker.ts`: MindARThree + anchor + THREE.VideoTexture plane ทับการ์ด
- [x] `ARCardStage.tsx`: สเตจ scan → video (วิดีโอทับการ์ด) กล้องหลัง + UI นำทาง + แถบเวลา
- [x] `ARGoldChallenge.tsx`: โหมด `arPhase 'card'|'done'` + gate กล้องหน้าไม่เปิดตอน 'card'
- [x] fallback อัตโนมัติ: โหลด MindAR ไม่ได้ / หา target ไม่เจอใน `scanTimeoutMs` → วิดีโอปกติ (กล้องหน้า); ถ้าไม่มีวิดีโอจะใช้ placeholder บนการ์ด
- [x] setting **`arCardMode`** + toggle ใน Teacher Mode — ปัจจุบันเปิดเป็นค่าเริ่มต้นเมื่อมี `.mind`
- [ ] ทดสอบ scan+วิดีโอบนเครื่องจริง

## เฟส 3 — hand-tracking บนสตรีมเดียว
- [x] แชร์ `<video>` ของ MindAR ให้ MediaPipe (`useHandTracking` รับ external videoRef + `mirror:false`)
- [x] สเตจ question: จีบนิ้วลากคำตอบ (reuse `DragQuestion`) บนภาพกล้องหลัง
- [ ] ทดสอบ GPU/เฟรมเรต โหมด A vs B → เลือก
- [x] ตัวชี้ปลายนิ้ว + feedback (reuse จาก `DragQuestion`)

## Code review fixes (2026-07-13)
- [x] 🔴 `ARCardStage` `startedRef` รีเซ็ตใน cleanup → AR ไม่ค้างใน dev (React.StrictMode mount ซ้ำ)
- [x] 🟡 `imageTracker.pauseTracking()` — เข้าสเตจคำถาม → หยุด render + TF.js detection (กล้องยังเล่นให้ MediaPipe) ลดโหลด GPU
- [x] 🟡 ออก/ยกเลิกก่อนตอบ = **ไม่เสียหัวใจ** (onCancel → closeEvent) · เสียหัวใจเฉพาะตอบผิดจริง (จอ fail → onDone(false))

## เฟส 4 — ขัดเกลา/ทดสอบ
- [ ] ทดสอบ iPad Safari (HTTPS, user-gesture, autoplay muted+playsInline)
- [ ] ทดสอบ Android Chrome
- [ ] แสงน้อย/เงา/มุม — ความทน tracking
- [ ] bundle/lazy-load เฉพาะช่องทอง (ไม่ถ่วง PWA)
- [ ] cache วิดีโอ/asset ผ่าน service worker (ออฟไลน์)

## Gotchas (ห้ามลืม)
- iOS Safari: ต้อง HTTPS + getUserMedia จาก user gesture; วิดีโอ texture `muted + playsInline + autoplay`
- กล้องหลัง `facingMode: environment`; **ไม่ mirror** (ต่างจากกล้องหน้าเดิม)
- เปิดกล้อง 1 ตัวเท่านั้น → MindAR + MediaPipe **แชร์ video element เดียว** (`mindar.getVideo()`) ✅ ต่อแล้ว
- ห้ามฟอยล์เมทัลลิก
- ✅ แก้แล้ว: ใช้ npm `three@0.152.0` (เวอร์ชันใหม่ถอด `sRGBEncoding` ที่ mind-ar 1.2.5 ใช้)
- ⚠️ ทดสอบ: MindAR (TF.js) + MediaPipe รันพร้อมกันตอนสเตจ question → เฝ้าดูเฟรมเรต/ความร้อนบนแท็บเล็ต (เฟส 4)
- ⚠️ arCardMode default = true แล้ว (มี gold-card.mind) → ทุกช่องทองจะโหลด chunk AR ~2.4MB (lazy) ครั้งแรก
