import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGame } from '@/core/store';
import { color, radius } from '@/theme/tokens';

// ── แถบอันดับสดของห้องแข่ง ── ของชิ้นเดียวที่เปลี่ยน "เกมเดี่ยว" ให้เป็น "เกมแข่ง"
// อ่านจาก store อย่างเดียว (heartbeat ที่ App.tsx เป็นคนเติมข้อมูล) ไม่มี logic เกมในนี้
export function RoomStandings() {
  const room = useGame((s) => s.room);
  const secondsLeft = useCountdown(room?.state?.room.endsAt ?? null, room?.state?.room.serverTime ?? null);

  if (!room?.state) return null;
  const { teams, room: info } = room.state;
  const running = info.status === 'running';

  return (
    <div style={wrap}>
      <div style={header}>
        <span style={{ fontWeight: 800 }}>🌐 ห้อง {info.code}</span>
        {running && <span style={clock(secondsLeft)}>⏱ {formatClock(secondsLeft)}</span>}
        {room.offline && <span style={offlineChip}>ขาดการเชื่อมต่อ</span>}
      </div>
      <div style={list}>
        {teams.slice(0, 6).map((t, i) => {
          const me = t.name === room.teamName;
          return (
            <div key={t.name} style={row(me)}>
              <span style={{ width: 20, textAlign: 'center' }}>{medal(i)}</span>
              <span style={nameCell}>
                {t.online ? '' : '⚪ '}
                {t.name}
                {t.suspect && ' ⚠️'}
              </span>
              <span style={{ fontWeight: 900 }}>👑 {t.kingCoins}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// นับถอยหลังจาก "เวลาเซิร์ฟเวอร์" เป็นฐาน แล้วเดินต่อด้วยนาฬิกาเครื่องระหว่างรอ sync รอบถัดไป
// (ห้ามคิดจาก Date.now() ตรง ๆ — นาฬิกาแท็บเล็ตแต่ละทีมไม่ตรงกัน เวลาจะเพี้ยนคนละเรื่อง)
function useCountdown(endsAt: number | null, serverTime: number | null): number {
  const [drift, setDrift] = useState(0);
  useEffect(() => {
    setDrift(0);
    if (!endsAt || !serverTime) return;
    const iv = window.setInterval(() => setDrift((d) => d + 1), 1000);
    return () => window.clearInterval(iv);
  }, [endsAt, serverTime]);
  if (!endsAt || !serverTime) return 0;
  return Math.max(0, endsAt - serverTime - drift);
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function medal(i: number): string {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
}

const wrap: CSSProperties = {
  // ซ้ายล่างของกระดาน — มุมซ้ายบนเป็นของ HUD หัวใจ/เหรียญ และขวาบนเป็นแถวเหรียญกษัตริย์อยู่แล้ว
  position: 'absolute',
  left: 10,
  bottom: 10,
  zIndex: 30,
  minWidth: 178,
  maxWidth: 240,
  padding: '7px 9px',
  borderRadius: radius.md,
  background: 'rgba(255,253,246,.93)',
  border: `1.5px solid ${color.secondary}`,
  boxShadow: '0 4px 14px rgba(0,0,0,.18)',
  fontSize: 13,
  pointerEvents: 'none', // เป็นป้ายบอกสถานะ ไม่ใช่ปุ่ม — ห้ามบังการแตะกระดาน
};

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  marginBottom: 4,
  color: color.primary,
};

function clock(sec: number): CSSProperties {
  return {
    marginLeft: 'auto',
    fontWeight: 900,
    color: sec <= 60 ? color.danger : color.text,
  };
}

const offlineChip: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#8B0000',
  background: '#FDECEC',
  borderRadius: radius.pill,
  padding: '1px 7px',
};

const list: CSSProperties = { display: 'grid', gap: 3 };

function row(me: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 5px',
    borderRadius: 7,
    background: me ? '#FFF3CC' : 'transparent',
    fontWeight: me ? 800 : 600,
    color: color.text,
  };
}

const nameCell: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
