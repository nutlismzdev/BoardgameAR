// ── ค่าคงที่โหมด "AR การ์ดจริง" (image-target tracking ด้วย MindAR) ──
// การ์ด AR เป็น "ใบเดียว" (ทอง) → target index 0 · พระองค์/วิดีโอมาจาก state เกม
// three + mind-ar โหลดผ่าน npm + dynamic import (Vite lazy-chunk) ใน imageTracker.ts
export const AR = {
  // ไฟล์ image target ที่คอมไพล์จากภาพการ์ดทอง (วางใน public/ar/ — ดู README)
  // รองรับ multi-target: คอมไพล์ทั้งหน้า+หลังในไฟล์เดียว (หน้า=0, หลัง=1) → ส่องด้านไหนก็ติด
  mindTargetUrl: '/ar/gold-card.mind',
  // index ของ target ที่ต้องจับ — [0]=หน้าอย่างเดียว, [0,1]=ทั้งหน้าและหลัง
  targetIndices: [0, 1] as number[],
  // สัดส่วนความสูง/กว้างของการ์ด (1060x1484 → 1.4) ใช้กำหนดขนาดระนาบวิดีโอบน anchor (กว้าง=1)
  cardAspectHeight: 1484 / 1060,
  // อัตราขยายระนาบวิดีโอเทียบการ์ด (ปรับจูนตอนทดสอบเครื่องจริง)
  videoPlaneScale: 1,
  // หา target ไม่เจอเกินเวลานี้ (ms) → fallback วิดีโอเต็มจอ + โหมดกล้องหน้าเดิม
  scanTimeoutMs: 6000,
  // ความยาวคลิปบทเรียน (วิ) ก่อนเข้าคำถาม (เท่าโหมดเดิม)
  lessonSeconds: 15,

  // ── สเตจบทเรียนบนการ์ด: โมเดล 3D หรือ คลิป 15 วิ ──
  // 'model' = วางโมเดล .glb ยืนบนการ์ด (เล่นแอนิเมชันวน lessonSeconds วิ แล้วเข้าคำถาม)
  // 'video' = ของเดิม เล่นคลิปบทเรียนทับการ์ด
  // ⚠️ สวิตช์กลับไปใช้คลิป = แก้บรรทัดนี้เป็น 'video' บรรทัดเดียว (โค้ดวิดีโอยังอยู่ครบ ไม่ถูกลบ)
  lessonStageMode: 'model' as 'model' | 'video',
  // โมเดลบทเรียน (แปลงจาก FBX → GLB + meshopt + webp ด้วย fbx2gltf/gltf-transform: 11.2MB → 0.8MB)
  lessonModelUrl: '/ar/models/catwalk.glb',
  // ความสูงโมเดลบนการ์ด เทียบ "ความกว้างการ์ด = 1" (โค้ดย่อให้เองจาก modelNativeHeight)
  modelHeightOnCard: 1.1,
  // ความสูงจริงของโมเดลในไฟล์ (หน่วยของ glTF) — ต้องเป็น "ค่าคงที่วัดมาก่อน" ห้ามคำนวณตอนรัน:
  // Box3.setFromObject โกหกกับ skinned mesh (มันคูณ scale ของ node เมช = 100 กับ geometry bbox ±1 → ได้ ~190)
  // แต่ตอนเรนเดอร์ three ใช้ bone matrices ซึ่ง bindMatrix หัก scale นั้นทิ้ง → ขนาดจริงตามกระดูก = 1.9
  // 🔁 เปลี่ยนโมเดล = วัดใหม่ด้วย `gltf-transform inspect <file.glb>` แล้วอ่าน bboxMax.y - bboxMin.y ของ SCENES
  modelNativeHeight: 1.9,
  // หมุนรอบแกนตั้งของการ์ด (เรเดียน) — ปรับให้โมเดลหันหน้าเข้าหาผู้เล่นตอนทดสอบเครื่องจริง
  modelSpinY: 0,

  // ── เว็บ AR ภายนอก (MyWebAR) สำหรับ "ดูเรื่องราว/เบาะแส" บนการ์ดทอง ──
  // จอกลางวาด QR ของ URL นี้ให้ผู้เล่นสแกนด้วยมือถืออีกเครื่อง แล้วเอาไปส่องภาพการ์ดบนจอ
  // ⚠️ ไม่มีการเชื่อมข้อมูลกับเกม (ไม่มี challenge id) — เปลี่ยนโปรเจกต์ AR = แก้บรรทัดนี้บรรทัดเดียว
  webArUrl: 'https://mywebar.com/b/BoardGame7King',
} as const;
