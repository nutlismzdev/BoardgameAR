// คลังคลิปบทเรียน AR ที่วางไว้ใน public/video/
// เสิร์ฟจาก origin ของแอปเอง (ไม่ผ่าน server/uploads) → path ขึ้นต้นด้วย '/'
// ซึ่ง resolveApiAssetUrl คืนค่าตรง ๆ โดยไม่เติม VITE_API_BASE
// เพิ่มคลิปใหม่ = วางไฟล์ลง public/video/ แล้วเติม 1 บรรทัดที่นี่ (ชื่อไฟล์ ASCII เท่านั้น)
export const LESSON_VIDEO_POOL = [
  '/video/king-listening-to-commoner.mp4',
  '/video/king-ramkhamhaeng-inscription.mp4',
  '/video/king-walking-sukhothai.mp4',
];

// hash สั้น ๆ ให้ id การ์ด → ตัวเลข (FNV-1a) — ไม่ต้องเข้ารหัส แค่ต้องกระจายสม่ำเสมอ
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── คลิปสำรองของบทเรียน AR (ชั้นสุดท้าย) ──
// เดิมบทเรียน AR พึ่ง `quiz.videoUrl` จาก CMS อย่างเดียว โดยมี `king.arVideo` เป็นตัวสำรอง
// แต่ `arVideo` ใน kings.json เป็น '' ทั้ง 7 พระองค์ และ seed ของ GOLD คือสำเนาการ์ดฟ้า
// ที่ไม่มีฟิลด์ videoUrl เลย → ถ้า API ล่ม/การ์ดใบนั้นยังไม่ได้ผูกวิดีโอ ค่าจะเป็น '' แล้ว
// QrVideoStage จะ `onEnded()` ทันที = **ข้ามวิดีโอไปคำถามแบบเงียบ ๆ** (บั๊กที่เจอจริง)
// ให้ผูกกับคลิปในเครื่องเป็นชั้นสุดท้าย บทเรียนจึงมีวิดีโอเสมอ แม้ออฟไลน์/ไม่มี backend
//
// เลือกแบบ "คงที่ตาม id การ์ด" ไม่ใช่สุ่มใหม่ทุกครั้ง เพราะการ์ดใบเดิมควรได้คลิปเดิม
// (เด็กจั่วใบซ้ำแล้วเจอคลิปคนละอันจะสับสนว่าดูผิดเรื่องหรือเปล่า) และเบราว์เซอร์แคชได้ด้วย
export function fallbackLessonVideo(seed: string, pool: string[] = LESSON_VIDEO_POOL): string {
  if (!pool.length) return '';
  return pool[hashString(seed || 'default') % pool.length];
}

// URL คลิปบทเรียนของการ์ดทอง 1 ใบ — เรียงลำดับความสำคัญไว้ที่เดียว ห้ามคัดลอกไปเขียนซ้ำที่อื่น
// CMS (ครูกำหนดเอง) > King.arVideo (ยังว่างทั้งหมด แต่คงไว้เผื่ออนาคต) > คลิปสำรองในเครื่อง
export function lessonVideoFor(
  cardId: string,
  cmsVideoUrl?: string | null,
  kingArVideo?: string | null
): string {
  return cmsVideoUrl?.trim() || kingArVideo?.trim() || fallbackLessonVideo(cardId);
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// คิววิดีโอสำหรับแจกให้การ์ด `count` ใบ — สลับลำดับคลังใหม่ทุกรอบแล้วแจกวน (round-robin)
// จึงได้ทั้ง "สุ่ม" และ "กระจายเท่า ๆ กัน" (จำนวนใบต่อคลิปต่างกันไม่เกิน 1)
export function shuffledVideoQueue(count: number, pool: string[] = LESSON_VIDEO_POOL): string[] {
  if (!pool.length || count <= 0) return [];
  const out: string[] = [];
  while (out.length < count) {
    for (const url of shuffle(pool)) {
      out.push(url);
      if (out.length === count) break;
    }
  }
  return out;
}
