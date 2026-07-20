// คลังคลิปบทเรียน AR ที่วางไว้ใน public/video/
// เสิร์ฟจาก origin ของแอปเอง (ไม่ผ่าน server/uploads) → path ขึ้นต้นด้วย '/'
// ซึ่ง resolveApiAssetUrl คืนค่าตรง ๆ โดยไม่เติม VITE_API_BASE
// เพิ่มคลิปใหม่ = วางไฟล์ลง public/video/ แล้วเติม 1 บรรทัดที่นี่ (ชื่อไฟล์ ASCII เท่านั้น)
export const LESSON_VIDEO_POOL = [
  '/video/king-listening-to-commoner.mp4',
  '/video/king-ramkhamhaeng-inscription.mp4',
  '/video/king-walking-sukhothai.mp4',
];

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
