// ตัวช่วยดึงเนื้อหา (kings/cards) — layer เดียวที่แตะไฟล์ JSON เนื้อหา

import kingsData from '@/data/kings.json';
import cardsData from '@/data/cards.json';
import { fetchContent } from './api';
import type {
  King,
  QuizCard,
  KnowledgeCard,
  Difficulty,
  GoldQuizCard,
  SubjectQuizCard,
  SubjectArea,
} from './types';

export const KINGS = kingsData.kings as King[];
const CACHE_KEY = 'bg7_content';

// คลัง "ภาพรวม 7 มหาราช" — คำถามที่ไม่ผูกพระองค์ใดพระองค์หนึ่ง เก็บใน king_id นี้
// ไม่ใส่ใน KINGS (ไม่ใช่พระองค์จริง ไม่มีหมาก/เหรียญ/ช่องบนกระดาน) ใช้เป็น "คลังสำรอง"
// pickQuiz จะหยิบมาถามเฉพาะเมื่อพระองค์ของช่องนั้นยังไม่มีคำถามของตัวเอง
export const OVERVIEW_KING_ID = 'king_overview';
export const OVERVIEW_KING_LABEL = 'ภาพรวม 7 มหาราช';

// ── กลุ่มสาระการเรียนรู้ (8 วิชาตามหลักสูตรแกนกลาง) — ป้าย/ไอคอนใช้ร่วมทั้งการ์ดในเกมและหลังบ้าน ──
export const SUBJECTS: { id: SubjectArea; label: string; icon: string }[] = [
  { id: 'thai', label: 'ภาษาไทย', icon: '📖' },
  { id: 'math', label: 'คณิตศาสตร์', icon: '🔢' },
  { id: 'science', label: 'วิทยาศาสตร์', icon: '🔬' },
  { id: 'social', label: 'สังคมศึกษา', icon: '🌏' },
  { id: 'health_pe', label: 'สุขศึกษาและพลศึกษา', icon: '🤸' },
  { id: 'art', label: 'ศิลปะ', icon: '🎨' },
  { id: 'occupation', label: 'การงานอาชีพ', icon: '🛠️' },
  { id: 'foreign_language', label: 'ภาษาต่างประเทศ', icon: '🗣️' },
];
export const SUBJECT_LABEL: Record<SubjectArea, string> = Object.fromEntries(
  SUBJECTS.map((s) => [s.id, s.label])
) as Record<SubjectArea, string>;
export const SUBJECT_ICON: Record<SubjectArea, string> = Object.fromEntries(
  SUBJECTS.map((s) => [s.id, s.icon])
) as Record<SubjectArea, string>;
export function subjectLabel(id: SubjectArea | string | undefined): string {
  return (id && SUBJECT_LABEL[id as SubjectArea]) || 'สาระการเรียนรู้';
}

export function getKing(id: string | null | undefined): King | undefined {
  if (!id) return undefined;
  return KINGS.find((k) => k.id === id);
}

let QUIZ = [...(cardsData.quiz as QuizCard[])];
let KNOWLEDGE = [...(cardsData.knowledge as KnowledgeCard[])];
// การ์ดทอง = 1 ข้อ/พระองค์ ตรงกับคำถามที่ "พิมพ์อยู่บนการ์ด AR จริง" (public/assets/ar-cards/)
// จึงต้อง seed จาก cards.json.gold เท่านั้น — ห้ามกลับไป copy QUIZ เพราะคำถามบนจอ
// จะไม่ตรงกับใบที่เด็กถืออยู่ในมือ (ดู CLAUDE.md หัวข้อการ์ดทอง)
let GOLD: GoldQuizCard[] = [...((cardsData as { gold?: GoldQuizCard[] }).gold ?? [])];
let SUBJECT: SubjectQuizCard[] = [...((cardsData as { subject?: SubjectQuizCard[] }).subject ?? [])];

interface ContentCache {
  version: number;
  quiz: QuizCard[];
  knowledge: KnowledgeCard[];
  gold: GoldQuizCard[];
  subject: SubjectQuizCard[];
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function applyContent(cache: ContentCache): void {
  if (cache.quiz.length) QUIZ = cache.quiz;
  if (cache.knowledge.length) KNOWLEDGE = cache.knowledge;
  if (cache.gold.length) GOLD = cache.gold;
  if (cache.subject.length) SUBJECT = cache.subject;
}

export function hydrateFromCache(): void {
  if (!isBrowser()) return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<ContentCache>;
    applyContent({
      version: Number(parsed.version ?? 1),
      quiz: Array.isArray(parsed.quiz) ? (parsed.quiz as QuizCard[]) : [],
      knowledge: Array.isArray(parsed.knowledge) ? (parsed.knowledge as KnowledgeCard[]) : [],
      gold: Array.isArray(parsed.gold) ? (parsed.gold as GoldQuizCard[]) : [],
      subject: Array.isArray(parsed.subject) ? (parsed.subject as SubjectQuizCard[]) : [],
    });
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

export async function syncContent(): Promise<void> {
  if (!isBrowser()) return;
  try {
    const [quiz, knowledge, gold, subject] = await Promise.all([
      fetchContent('quiz'),
      fetchContent('knowledge'),
      fetchContent('gold'),
      fetchContent('subject'),
    ]);
    const cache: ContentCache = {
      version: Math.max(quiz.version, knowledge.version, gold.version, subject.version),
      quiz: quiz.data,
      knowledge: knowledge.data,
      gold: gold.data,
      subject: subject.data,
    };
    applyContent(cache);
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ออฟไลน์ / ยังไม่ได้ตั้ง API / server ล่ม: ใช้ cache หรือ seed ต่อไป
  }
}

function pickQuiz(
  source: QuizCard[],
  kingId: string | null,
  difficulty: Difficulty | 'all',
  excludeIds: string[]
): QuizCard {
  let pool = source.filter((q) => q.kingId === kingId);
  // พระองค์นี้ยังไม่มีคำถามของตัวเอง → ใช้คลัง "ภาพรวม 7 มหาราช" แทน (สำรองอย่างเดียว)
  if (!pool.length) pool = source.filter((q) => q.kingId === OVERVIEW_KING_ID);
  if (difficulty !== 'all') {
    const byDiff = pool.filter((q) => q.difficulty === difficulty);
    if (byDiff.length) pool = byDiff;
  }
  const fresh = pool.filter((q) => !excludeIds.includes(q.id));
  if (fresh.length) pool = fresh;
  const list = pool.length ? pool : source;
  return list[Math.floor(Math.random() * list.length)];
}

// สุ่มคำถามของมหาราชพระองค์นั้น + คัดระดับความยาก (fallback ไล่ระดับ)
export function getQuizForKing(
  kingId: string | null,
  difficulty: Difficulty | 'all' = 'all',
  excludeIds: string[] = []
): QuizCard {
  return pickQuiz(QUIZ, kingId, difficulty, excludeIds);
}

export function getGoldQuizForKing(
  kingId: string | null,
  difficulty: Difficulty | 'all' = 'all',
  excludeIds: string[] = []
): GoldQuizCard {
  return pickQuiz(GOLD, kingId, difficulty, excludeIds);
}

// ช่องกลุ่มสาระฯ — สุ่มคำถามของพระองค์ที่ผูกกับช่อง (คละวิชาใน 6 กลุ่มสาระ)
// fallback: ถ้าพระองค์นั้นยังไม่มีคำถามสาระ ใช้ทั้งคลัง (เกมไม่ค้าง)
export function getSubjectQuizForKing(
  kingId: string | null,
  difficulty: Difficulty | 'all' = 'all',
  excludeIds: string[] = []
): SubjectQuizCard {
  return pickQuiz(SUBJECT, kingId, difficulty, excludeIds) as SubjectQuizCard;
}

// สุ่มการ์ดความรู้ที่ผู้เล่นยังไม่มี (ช่องชมพู) — สุ่มจากทั้งคลัง ไม่ผูกกับพระองค์ของช่อง
// เพื่อให้แต่ละคนเก็บได้ไม่ซ้ำและหลากหลาย (fallback: สุ่มทั้งคลังถ้าเก็บครบแล้ว)
export function getRandomKnowledge(excludeIds: string[] = []): KnowledgeCard {
  const fresh = KNOWLEDGE.filter((k) => !excludeIds.includes(k.id));
  const list = fresh.length ? fresh : KNOWLEDGE;
  return list[Math.floor(Math.random() * list.length)];
}

export function knowledgeTotal(): number {
  return KNOWLEDGE.length;
}

export const KNOWLEDGE_CAP = 10; // เก็บได้สูงสุด 10 ใบ/คน
