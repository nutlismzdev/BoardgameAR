import { useEffect } from 'react';
import { useGame, teamCoins, teamKingCoins } from './store';
import { roomApiAvailable, syncRoom } from './roomApi';

// ── หัวใจของห้องแข่ง: ส่งแต้มของทีมเรา แล้วรับอันดับทั้งห้องกลับมาใน round trip เดียว ──
// วางไว้ที่ App.tsx ตัวเดียว **ห้ามยิงตามการเปลี่ยน state ของเกม** — เหรียญปกติเปลี่ยนบ่อยมาก
// (ทุกคำถามที่ตอบถูก) ถ้าผูกกับ state จะยิงรัวจนเซิร์ฟเวอร์ที่รับทีละคำขอรับไม่ไหว
//
// 3 วิ = พอให้ "เห็นคู่แข่งขยับ" โดยไม่หนักเกินไป · ถ้ายังใช้ `php -S` (รับทีละคำขอ)
// แล้วมีเกิน 4 ทีมในห้อง ให้ยืดเป็น 4000-5000 (ดู ROOM-PLAN.md ข้อ 2)
const HEARTBEAT_MS = 3000;

export function useRoomHeartbeat() {
  const code = useGame((s) => s.room?.code ?? null);
  const teamToken = useGame((s) => s.room?.teamToken ?? null);
  const idle = useGame((s) => s.phase === 'setup');

  useEffect(() => {
    if (!code || !teamToken || idle || !roomApiAvailable()) return;
    let alive = true;

    const tick = async () => {
      const s = useGame.getState();
      if (!s.room) return; // ออกจากห้องไปแล้ว
      try {
        const state = await syncRoom(
          s.room.code,
          s.room.teamToken,
          teamKingCoins(s.players),
          teamCoins(s.players)
        );
        if (alive) useGame.getState().updateRoomState(state);
      } catch {
        // เน็ตสะดุด/เซิร์ฟเวอร์ล่ม — **เกมในเครื่องต้องเดินต่อได้ปกติ** แค่แถบอันดับค้าง
        if (alive) useGame.getState().setRoomOffline(true);
      }
    };

    void tick();
    const iv = window.setInterval(tick, HEARTBEAT_MS);
    return () => {
      alive = false;
      window.clearInterval(iv);
    };
  }, [code, teamToken, idle]);
}
