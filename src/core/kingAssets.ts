import { KINGS } from './content';

const KING_PAWN_BY_ORDER = new Map(KINGS.map((king) => [king.id, `/assets/chess/${king.order}.png`]));
const KING_COIN_BY_ID = new Map(KINGS.map((king) => [king.id, `/assets/coins/${king.id}.png`]));

export function getKingPawnImage(kingId: string | null | undefined): string {
  if (!kingId) return '/assets/chess/1.png';
  return KING_PAWN_BY_ORDER.get(kingId) ?? '/assets/chess/1.png';
}

export function getKingCoinImage(kingId: string | null | undefined): string {
  if (!kingId) return '/assets/coins/king_ramkhamhaeng.png';
  return KING_COIN_BY_ID.get(kingId) ?? '/assets/coins/king_ramkhamhaeng.png';
}
