// รูปการ์ดจริง (หน้า/หลัง) ต่อชนิดช่อง — ใช้กับ CardFrame ตอนลงกระดาน
// มีศิลป์แค่ 4 ชนิด: question / subject / knowledge / goldking(AR)
// penalty / bonus ไม่มีรูป → คืน null แล้ว CardFrame เรนเดอร์เฟรมแต่งธีม (CSS) แทน
type CardArtKind = 'question' | 'subject' | 'knowledge' | 'goldking';

const preloadCache = new Map<string, Promise<void>>();

const FRONT: Record<CardArtKind, string> = {
  question: '/assets/cards/question-front.png',
  subject: '/assets/cards/subject-front.png',
  knowledge: '/assets/cards/knowledge-front.png',
  goldking: '/assets/cards/ar-front.png',
};

const BACK: Record<CardArtKind, string> = {
  question: '/assets/cards/question-back.png',
  subject: '/assets/cards/subject-back.png',
  knowledge: '/assets/cards/knowledge-back.png',
  goldking: '/assets/cards/ar-back.png',
};

export function getCardFront(kind: string | undefined | null): string | null {
  return kind && kind in FRONT ? FRONT[kind as CardArtKind] : null;
}

export function getCardBack(kind: string | undefined | null): string | null {
  return kind && kind in BACK ? BACK[kind as CardArtKind] : null;
}

function preloadImage(url: string): Promise<void> {
  const cached = preloadCache.get(url);
  if (cached) return cached;

  const pending = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (typeof image.decode !== 'function') {
        resolve();
        return;
      }
      image.decode().then(resolve, resolve);
    };
    image.onerror = () => {
      preloadCache.delete(url);
      reject(new Error(`โหลดรูปการ์ดไม่สำเร็จ: ${url}`));
    };
    image.src = url;
  });
  preloadCache.set(url, pending);
  return pending;
}

// หลังการ์ด = ภาพเดียวที่ด่านจั่ว (CardPicker) โชว์ → gate ตรงนี้พอ
export function preloadCardBack(kind: CardArtKind): Promise<void> {
  return preloadImage(BACK[kind]);
}

// รูป "หน้าการ์ด" ตอนนี้ใช้จริงแค่การ์ดความรู้ (CardFrame โหมด art วางข้อความทับ) —
// question/subject/goldking ใช้โหมด themed (กรอบทอง CSS) จึงไม่ต้องโหลดหน้าการ์ดของ 3 ชนิดนั้น
// (ประหยัด ~5.3 MB ต่อการเปิดเกม · ถ้าวันหลังเปลี่ยนช่องฟ้า/สาระไปใช้โหมด art ต้องเติมกลับที่นี่)
const FRONT_IN_USE: CardArtKind[] = ['knowledge'];

// โหลดหลังการ์ดก่อนเพราะเป็นภาพแรกที่ผู้เล่นเห็น แล้วจึงโหลดหน้าการ์ดที่ใช้จริงในช่วง idle ถัดไป
export async function preloadAllCardArt(): Promise<void> {
  const kinds = Object.keys(BACK) as CardArtKind[];
  await Promise.all(kinds.map((kind) => preloadImage(BACK[kind])));
  await Promise.all(FRONT_IN_USE.map((kind) => preloadImage(FRONT[kind])));
}
