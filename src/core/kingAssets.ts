import { KINGS } from './content';

const KING_PAWN_BY_ORDER = new Map(KINGS.map((king) => [king.id, `/assets/chess/king_${king.order}.png`]));
const KING_COIN_BY_ID = new Map(KINGS.map((king) => [king.id, `/assets/coins/${king.id}.png`]));

export function getKingPawnImage(kingId: string | null | undefined): string {
  if (!kingId) return '/assets/chess/king_1.png';
  return KING_PAWN_BY_ORDER.get(kingId) ?? '/assets/chess/king_1.png';
}

export function getKingCoinImage(kingId: string | null | undefined): string {
  if (!kingId) return '/assets/coins/king_ramkhamhaeng.png';
  return KING_COIN_BY_ID.get(kingId) ?? '/assets/coins/king_ramkhamhaeng.png';
}

// ── ภาพ "การ์ด AR ทอง" ใบจริง 1 ใบ/พระองค์ (public/assets/ar-cards/{king.id}.png) ──
// จอกลางโชว์ใบนี้ให้ผู้เล่นเอามือถือที่เปิด MyWebAR มาส่องดูเบาะแส ก่อนไปตอบคำถาม
// คำถามที่ "พิมพ์บนภาพ" ต้องตรงกับ cards.json.gold ของพระองค์เดียวกัน (ดู CLAUDE.md)
// คืน null เมื่อยังไม่มีไฟล์ของพระองค์นั้น → UI ถอยไปโชว์กรอบข้อความแทน ไม่ค้าง
const KING_AR_CARD_BY_ID = new Map(KINGS.map((king) => [king.id, `/assets/ar-cards/${king.id}.png`]));

export function getKingArCardImage(kingId: string | null | undefined): string | null {
  if (!kingId) return null;
  return KING_AR_CARD_BY_ID.get(kingId) ?? null;
}
