import { useOrientation } from '@/hooks/useOrientation';
import { GameBoardPortrait } from './GameBoard.portrait';
import { GameBoardLandscape } from './GameBoard.landscape';

// ตัวเลือก Layout ตามการหมุนจอ — state คงอยู่ใน core/store (ไม่รีเซ็ตเมื่อหมุน)
export function GameBoard() {
  const orientation = useOrientation();
  return orientation === 'portrait' ? <GameBoardPortrait /> : <GameBoardLandscape />;
}
