// ── ช่องกลางให้มือถือ↔tablet คุยกัน (โหมด QR อัตโนมัติ) ──
// เบา standalone (ใช้ทั้งฝั่ง tablet และ answer bundle) — ไม่ import store/UI
import { QUIZ_ITEMS } from './qrChallenge';
import type { QrChallenge, QuizItem } from './qrChallenge';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

// มี backend ให้คุยไหม — ถ้าไม่ตั้ง VITE_API_BASE จะ fallback เป็นกดผลเองบน tablet
export function challengeApiAvailable(): boolean {
  return !!API_BASE;
}

export async function registerChallenge(challenge: QrChallenge): Promise<void> {
  if (!API_BASE || !challenge.i) throw new Error('ไม่มี challenge id หรือ API');
  const res = await fetch(`${API_BASE}/challenge.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: challenge.i, challenge }),
  });
  if (!res.ok) throw new Error(`challenge register ${res.status}`);
}

export async function fetchChallenge<T extends QrChallenge = QrChallenge>(id: string): Promise<T> {
  if (!API_BASE) throw new Error('ยังไม่ได้ตั้งค่า VITE_API_BASE');
  const res = await fetch(`${API_BASE}/challenge.php?id=${encodeURIComponent(id)}&payload=1`);
  const json = (await res.json().catch(() => null)) as { ok?: boolean; challenge?: T } | null;
  if (!res.ok || !json?.ok || !json.challenge) throw new Error(`challenge fetch ${res.status}`);
  return json.challenge;
}

// มือถือส่งผลการตอบขึ้น server (ผู้เล่นตรวจในเครื่องแล้ว)
// `items` = ไอเทมที่กดใช้ระหว่างตอบ — แท็บเล็ตเอาไปหักจำนวนจริงใน store
export async function postChallengeResult(
  id: string,
  correct: boolean,
  items: QuizItem[] = []
): Promise<void> {
  if (!API_BASE) throw new Error('ยังไม่ได้ตั้งค่า VITE_API_BASE');
  const res = await fetch(`${API_BASE}/challenge.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, correct, items }),
  });
  if (!res.ok) throw new Error(`challenge post ${res.status}`);
}

export interface ChallengeResult {
  answered: boolean;
  correct: boolean;
  items: QuizItem[]; // ไอเทมที่มือถือกดใช้ (แท็บเล็ตต้องหักตาม)
}

// tablet poll ว่ามีผลหรือยัง
export async function fetchChallengeResult(id: string): Promise<ChallengeResult> {
  const empty: ChallengeResult = { answered: false, correct: false, items: [] };
  if (!API_BASE) return empty;
  const res = await fetch(`${API_BASE}/challenge.php?id=${encodeURIComponent(id)}`);
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; answered?: boolean; correct?: boolean; items?: unknown }
    | null;
  if (!json || !json.ok) return empty;
  const items = Array.isArray(json.items)
    ? json.items.filter((i): i is QuizItem => QUIZ_ITEMS.includes(i as QuizItem))
    : [];
  return { answered: !!json.answered, correct: !!json.correct, items };
}
