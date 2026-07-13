// ── ค่าคงที่โหมด "AR การ์ดจริง" (image-target tracking ด้วย MindAR) ──
// การ์ด AR เป็น "ใบเดียว" (ทอง) → target index 0 · พระองค์/วิดีโอมาจาก state เกม
// three + mind-ar โหลดผ่าน npm + dynamic import (Vite lazy-chunk) ใน imageTracker.ts
export const AR = {
  // ไฟล์ image target ที่คอมไพล์จากภาพหน้าการ์ดทอง (วางใน public/ar/ — ดู README)
  mindTargetUrl: '/ar/gold-card.mind',
  // การ์ดทองใบเดียว = target index 0
  targetIndex: 0,
  // สัดส่วนความสูง/กว้างของการ์ด (1060x1484 → 1.4) ใช้กำหนดขนาดระนาบวิดีโอบน anchor (กว้าง=1)
  cardAspectHeight: 1484 / 1060,
  // อัตราขยายระนาบวิดีโอเทียบการ์ด (ปรับจูนตอนทดสอบเครื่องจริง)
  videoPlaneScale: 1,
  // หา target ไม่เจอเกินเวลานี้ (ms) → fallback วิดีโอเต็มจอ + โหมดกล้องหน้าเดิม
  scanTimeoutMs: 6000,
  // ความยาวคลิปบทเรียน (วิ) ก่อนเข้าคำถาม (เท่าโหมดเดิม)
  lessonSeconds: 15,
} as const;
