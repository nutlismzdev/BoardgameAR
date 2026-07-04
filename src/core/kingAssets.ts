import { KINGS } from './content';

const KING_PAWN_BY_ORDER = new Map(KINGS.map((king) => [king.id, `/assets/chess/${king.order}.png`]));

export function getKingPawnImage(kingId: string | null | undefined): string {
  if (!kingId) return '/assets/chess/1.png';
  return KING_PAWN_BY_ORDER.get(kingId) ?? '/assets/chess/1.png';
}
