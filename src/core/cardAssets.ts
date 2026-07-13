// รูปการ์ดจริง (หน้า/หลัง) ต่อชนิดช่อง — ใช้กับ CardFrame ตอนลงกระดาน
// มีศิลป์แค่ 4 ชนิด: question / subject / knowledge / goldking(AR)
// penalty / bonus ไม่มีรูป → คืน null แล้ว CardFrame เรนเดอร์เฟรมแต่งธีม (CSS) แทน
type CardArtKind = 'question' | 'subject' | 'knowledge' | 'goldking';

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
