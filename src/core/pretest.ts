// แบบทดสอบก่อนเรียน/หลังเรียน — ตัวคลังข้อสอบ + สลับชุด + ตรวจให้คะแนน
// module บริสุทธิ์: ไม่ import store / ไม่แตะ UI (แบบเดียวกับ diceLogic.ts, roomApi.ts)
// เนื้อหามาจาก src/data/pretest.json ที่สร้างด้วย `node scripts/parse-pretest.mjs`

import pretestData from '@/data/pretest.json';

export type TestMode = 'pre' | 'post';

export interface TestQuestion {
  no: number; // เลขข้อต้นฉบับ 1–30 (คงที่ตลอด — ใช้เป็นกุญแจของคำตอบเสมอ)
  kingId: string;
  question: string;
  choices: string[];
  answer: number; // index ของตัวเลือกที่ถูก (อ้างอิง choices ต้นฉบับ)
  explanation: string;
  keyFixed?: string; // มีค่า = เฉลยข้อนี้ถูกแก้จากไฟล์ Word ต้นฉบับ (ค่าเดิมที่ไฟล์เขียนไว้)
}

/** 1 ข้อ "ตามที่จะโชว์จริงให้เด็กคนนี้" — ลำดับตัวเลือกอาจถูกสลับแล้ว */
export interface TestItem {
  no: number;
  kingId: string;
  question: string;
  choices: string[]; // เรียงตามที่โชว์
  choiceMap: number[]; // choiceMap[ที่โชว์] = index ต้นฉบับ — ใช้แปลงคำตอบกลับก่อนบันทึกเสมอ
}

export interface KingScore {
  kingId: string;
  correct: number;
  total: number;
}

export interface TestScore {
  score: number;
  total: number;
  answered: number;
  byKing: KingScore[]; // เรียงตามลำดับเวลา (ข้อ 1→30 เรียงตามรัชสมัยอยู่แล้ว)
}

export const TEST_META = pretestData.meta;
export const TEST_QUESTIONS = pretestData.questions as TestQuestion[];
export const TEST_TOTAL = TEST_QUESTIONS.length;

export const TEST_MODE_LABEL: Record<TestMode, string> = {
  pre: 'แบบทดสอบก่อนเรียน',
  post: 'แบบทดสอบหลังเรียน',
};

/** ยังไม่ตอบ = -1 (ไม่ใช้ null เพราะต้อง serialize ลง localStorage/JSON ทุกครั้งที่แตะคำตอบ) */
export const UNANSWERED = -1;
export const emptyAnswers = (): number[] => Array<number>(TEST_TOTAL).fill(UNANSWERED);

// ── สุ่มแบบมี seed ────────────────────────────────────────────────────────
// ต้อง deterministic: เด็กปิดแท็บกลางคันแล้วกลับมาทำต่อ ต้องได้ข้อเรียงเดิมและตัวเลือกเรียงเดิม
// ไม่งั้นคำตอบที่ตอบไปแล้วจะไปตรงกับตัวเลือกคนละอัน
function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rnd: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * ประกอบชุดข้อสอบของนักเรียนคนหนึ่ง
 *
 * - ก่อนเรียน: ลำดับเดิมตรงกับฉบับกระดาษของครูเสมอ (ครูอ่านตามได้)
 * - หลังเรียน (`shuffleSet`): สลับทั้งลำดับข้อและลำดับตัวเลือก และ **สลับไม่เหมือนกันทุกคน**
 *   เพราะ seed ผูกกับตัวนักเรียน → กันจำตำแหน่งเฉลยจากรอบก่อน และกันชะโงกดูของเพื่อนไปในตัว
 */
export function buildAttempt(mode: TestMode, studentKey: string, shuffleSet: boolean): TestItem[] {
  const plain = TEST_QUESTIONS.map<TestItem>((q) => ({
    no: q.no,
    kingId: q.kingId,
    question: q.question,
    choices: q.choices,
    choiceMap: q.choices.map((_, i) => i),
  }));
  if (mode === 'pre' || !shuffleSet) return plain;

  const rnd = mulberry32(hashSeed(`${studentKey}|${mode}`));
  return shuffle(plain, rnd).map((item) => {
    const order = shuffle(item.choiceMap, rnd);
    return {
      ...item,
      choices: order.map((i) => TEST_QUESTIONS[item.no - 1].choices[i]),
      choiceMap: order,
    };
  });
}

/** ตรวจคำตอบ (answers[no-1] = index ตัวเลือก "ต้นฉบับ" ที่เลือก หรือ UNANSWERED) */
export function scoreAttempt(answers: number[]): TestScore {
  const byKing: KingScore[] = [];
  let score = 0;
  let answered = 0;
  for (const q of TEST_QUESTIONS) {
    const picked = answers[q.no - 1] ?? UNANSWERED;
    const ok = picked === q.answer;
    if (picked !== UNANSWERED) answered++;
    if (ok) score++;
    let bucket = byKing.find((b) => b.kingId === q.kingId);
    if (!bucket) {
      bucket = { kingId: q.kingId, correct: 0, total: 0 };
      byKing.push(bucket);
    }
    bucket.total++;
    if (ok) bucket.correct++;
  }
  return { score, total: TEST_TOTAL, answered, byKing };
}

export function isCorrect(no: number, picked: number): boolean {
  return picked !== UNANSWERED && TEST_QUESTIONS[no - 1]?.answer === picked;
}

export function questionByNo(no: number): TestQuestion | undefined {
  return TEST_QUESTIONS[no - 1];
}

/** พระองค์ที่ควรกลับไปทบทวน — เรียงจากที่ผิดเยอะสุด (ใช้ทั้งหน้าผลเด็กและตารางครู) */
export function weakKings(byKing: KingScore[]): KingScore[] {
  return byKing
    .filter((k) => k.correct < k.total)
    .slice()
    .sort((a, b) => b.total - b.correct - (a.total - a.correct));
}

export interface TestGain {
  pre: number;
  post: number;
  diff: number;
  /** คะแนนพัฒนาการสัมพัทธ์ (normalized gain) — ดูว่าเก็บ "ส่วนที่ยังไม่รู้" ได้กี่ % */
  normalized: number | null;
  byKing: { kingId: string; pre: number; post: number; total: number }[];
}

export function compareAttempts(pre: TestScore, post: TestScore): TestGain {
  const room = pre.total - pre.score;
  return {
    pre: pre.score,
    post: post.score,
    diff: post.score - pre.score,
    normalized: room > 0 ? (post.score - pre.score) / room : null,
    byKing: pre.byKing.map((p) => ({
      kingId: p.kingId,
      pre: p.correct,
      post: post.byKing.find((q) => q.kingId === p.kingId)?.correct ?? 0,
      total: p.total,
    })),
  };
}

/**
 * เปิดคะแนน/เฉลยให้เด็กดูได้หรือยัง — เป็น "นโยบายการวัดผล" ไม่ใช่เรื่องการแสดงผล จึงอยู่ใน core/
 *
 * 🔒 ค่าเริ่มต้น `'post'` = รอบก่อนเรียนไม่โชว์แม้แต่คะแนน
 * ถ้าเฉลยตั้งแต่ก่อนเล่นเกม คะแนนหลังเรียนจะกลายเป็นการวัด "ความจำเฉลย" แทน "สิ่งที่ได้จากเกม"
 */
export function shouldRevealAnswers(mode: TestMode, setting: 'post' | 'always' | 'never'): boolean {
  if (setting === 'never') return false;
  if (setting === 'always') return true;
  return mode === 'post';
}

/** กุญแจนักเรียน (ใช้เป็น seed สลับข้อ + คีย์กันบันทึกซ้ำฝั่ง server) — ไม่มีชื่อจริงอยู่ในนี้ */
export function studentKey(room: string, no: string): string {
  return `${room.trim()}|${no.trim()}`.toLowerCase();
}
