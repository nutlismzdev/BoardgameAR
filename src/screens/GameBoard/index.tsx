import { useOrientation } from '@/hooks/useOrientation';
import { GameBoardPortrait } from './GameBoard.portrait';
import { GameBoardLandscape } from './GameBoard.landscape';
import { ExitConfirm } from '@/components/ExitConfirm';

// ตัวเลือก Layout ตามการหมุนจอ — state คงอยู่ใน core/store (ไม่รีเซ็ตเมื่อหมุน)
// ExitConfirm render นอก layout เพื่อให้กล่องยืนยันออกเกมโผล่ได้ทั้งแนวตั้ง/แนวนอน (เช่น กด back ตอนจอตั้ง)
export function GameBoard() {
  const orientation = useOrientation();
  return (
    <>
      {orientation === 'portrait' ? <GameBoardPortrait /> : <GameBoardLandscape />}
      <ExitConfirm />
    </>
  );
}
