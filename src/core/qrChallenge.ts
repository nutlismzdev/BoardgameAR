// ── โหมด QR: ฝังคำถามลง URL#hash ให้ผู้เล่นสแกนไปตอบบน "มือถือส่วนตัว" ──
// tablet encode → วาดเป็น QR ; มือถือ decode จาก location.hash แล้ว render เอง (ไม่เรียก API)
// ออนไลน์แค่ตอน "โหลดหน้า answer.html" เท่านั้น — ตรรกะคำถาม/เฉลยทำบนมือถือล้วน
// ⚠️ payload มี index เฉลย (a) → โหมด "เชื่อใจ": มือถือ (ของผู้เล่นเอง) เห็นได้ ผู้เล่นอื่นเห็นแค่ QR ทึบ
// ไฟล์นี้ต้อง standalone (ไม่ import store/UI) เพื่อให้ answer bundle เล็ก
import type { QuizCard } from './types';

export interface QrChallenge {
  i?: string; // challenge id — ใช้จับคู่ผลตอบระหว่างมือถือ↔tablet (โหมดอัตโนมัติผ่าน server)
  q: string; // โจทย์
  c: string[]; // ตัวเลือก
  a: number; // index ตัวเลือกที่ถูก
  r: number; // เหรียญรางวัลเมื่อตอบถูก
  t?: string; // ป้ายบริบท (พระนาม/วิชา)
  d?: 'easy' | 'medium' | 'hard'; // ระดับความยาก
  x?: string; // คำอธิบายเฉลย (optional)
}

// id สุ่มสำหรับ 1 คำถาม — ไม่พึ่ง crypto.randomUUID (ใช้ไม่ได้บน http LAN ที่ไม่ secure context)
export function genChallengeId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().replace(/-/g, '').slice(0, 24);
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).slice(0, 24);
}

// base64url ที่รองรับ UTF-8 (ภาษาไทย) — btoa ตรง ๆ พังกับ non-Latin1
function b64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeChallenge(ch: QrChallenge): string {
  return b64urlEncode(JSON.stringify(ch));
}

export function decodeChallenge(s: string): QrChallenge | null {
  try {
    const obj = JSON.parse(b64urlDecode(s)) as QrChallenge;
    if (typeof obj?.q === 'string' && Array.isArray(obj?.c) && typeof obj?.a === 'number') {
      return obj;
    }
    return null;
  } catch {
    return null;
  }
}

// URL ที่ฝังใน QR — สแกนแล้วเปิด answer.html พร้อม payload ใน hash
export function buildChallengeUrl(ch: QrChallenge, base?: string): string {
  const origin = (base || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${origin}/answer.html#${encodeChallenge(ch)}`;
}

// แปลง QuizCard (ช่องฟ้า/สาระ) → payload สำหรับ QR
export function buildQuizChallenge(quiz: QuizCard, label?: string, id?: string): QrChallenge {
  return {
    i: id,
    q: quiz.question,
    c: quiz.choices.map((ch) => ch.text),
    a: quiz.choices.findIndex((ch) => ch.correct),
    r: quiz.reward,
    t: label,
    d: quiz.difficulty,
    x: quiz.explanation,
  };
}
