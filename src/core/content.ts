// ตัวช่วยดึงเนื้อหา (kings/cards) — layer เดียวที่แตะไฟล์ JSON เนื้อหา

import kingsData from '@/data/kings.json';
import cardsData from '@/data/cards.json';
import type { King, QuizCard, KnowledgeCard, Difficulty } from './types';

export const KINGS = kingsData.kings as King[];

export function getKing(id: string | null | undefined): King | undefined {
  if (!id) return undefined;
  return KINGS.find((k) => k.id === id);
}

const QUIZ = cardsData.quiz as QuizCard[];
const KNOWLEDGE = cardsData.knowledge as KnowledgeCard[];

// สุ่มคำถามของมหาราชพระองค์นั้น + คัดระดับความยาก (fallback ไล่ระดับ)
export function getQuizForKing(
  kingId: string | null,
  difficulty: Difficulty | 'all' = 'all',
  excludeIds: string[] = []
): QuizCard {
  let pool = QUIZ.filter((q) => q.kingId === kingId);
  if (difficulty !== 'all') {
    const byDiff = pool.filter((q) => q.difficulty === difficulty);
    if (byDiff.length) pool = byDiff;
  }
  const fresh = pool.filter((q) => !excludeIds.includes(q.id));
  if (fresh.length) pool = fresh;
  const list = pool.length ? pool : QUIZ;
  return list[Math.floor(Math.random() * list.length)];
}

// สุ่มการ์ดความรู้ที่ผู้เล่นยังไม่มี (ช่องชมพู) — สุ่มจากทั้งคลัง ไม่ผูกกับพระองค์ของช่อง
// เพื่อให้แต่ละคนเก็บได้ไม่ซ้ำและหลากหลาย (fallback: สุ่มทั้งคลังถ้าเก็บครบแล้ว)
export function getRandomKnowledge(excludeIds: string[] = []): KnowledgeCard {
  const fresh = KNOWLEDGE.filter((k) => !excludeIds.includes(k.id));
  const list = fresh.length ? fresh : KNOWLEDGE;
  return list[Math.floor(Math.random() * list.length)];
}

export const KNOWLEDGE_TOTAL = KNOWLEDGE.length;
export const KNOWLEDGE_CAP = 10; // เก็บได้สูงสุด 10 ใบ/คน
