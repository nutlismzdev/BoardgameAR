import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGame } from '@/core/store';
import type { RoomTeam } from '@/core/roomApi';
import { color, radius } from '@/theme/tokens';

// ── ห้องแข่งออนไลน์: ป้ายบอกสถานะ 2 ชิ้น ──
// เดิมเป็นกล่องลอยทับมุมซ้ายล่างของกระดาน ซึ่ง **บังช่องบนกระดานจริง**
// ตอนนี้ย้ายมาอยู่ในแถบขวาที่เป็น layout จริง — ไม่ทับอะไร และได้พื้นที่ที่ว่างอยู่แล้วมาใช้:
//   · RoomClock      → แถวไอคอน ⚙️🏠 ด้านบน (ฝั่งซ้ายของแถวนั้นว่างเปล่ามาตลอด)
//   · RoomStandings  → แผงอันดับใต้แถวไอคอน (สูงเท่าที่จำเป็น มี scroll ในตัวเมื่อทีมเยอะ)
// ทั้งคู่คืน null เมื่อไม่ได้อยู่ในห้อง → โหมดเล่นปกติไม่เปลี่ยนอะไรเลย

const VISIBLE_ROWS = 4; // แสดง 4 ทีมแรก (+ ทีมเราเสมอ) ที่เหลือเลื่อนดู

/** ป้ายรหัสห้อง + เวลาถอยหลัง — วางในแถวไอคอนด้านบนของแถบขวา */
export function RoomClock() {
  const room = useGame((s) => s.room);
  const info = room?.state?.room ?? null;
  const left = useCountdown(info?.endsAt ?? null, info?.serverTime ?? null);

  if (!room || !info) return null;
  const running = info.status === 'running';
  const danger = running && left <= 60;

  return (
    <div style={clockWrap}>
      <span style={codeChip}>🌐 {info.code}</span>
      {running && (
        <span style={{ ...clockText, color: danger ? color.danger : color.text }}>⏱ {formatClock(left)}</span>
      )}
      {room.offline && <span style={offlineChip}>ออฟไลน์</span>}
    </div>
  );
}

/** แผงอันดับของทุกทีมในห้อง — วางเป็นการ์ดในแถบขวา (ไม่ลอยทับกระดาน) */
export function RoomStandings() {
  const room = useGame((s) => s.room);
  if (!room?.state) return null;

  const teams = room.state.teams;
  const rows = pickRows(teams, room.teamName);

  return (
    <section style={panel}>
      <div style={panelHeader}>
        <span>อันดับ</span>
        <span style={{ fontWeight: 700, color: color.textMuted }}>{teams.length} ทีม</span>
      </div>
      <div style={list}>
        {rows.map(({ team, rank }) => {
          const me = team.name === room.teamName;
          return (
            <div key={team.name} style={row(me)}>
              <span style={rankCell}>{medal(rank)}</span>
              <span style={nameCell} title={team.name}>
                {team.online ? '' : '⚪ '}
                {team.name}
                {team.suspect && ' ⚠️'}
              </span>
              <span style={scoreCell}>👑 {team.kingCoins}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// เลือกแถวที่จะแสดง: 4 ทีมแรก + **ทีมเราเสมอ** (ถ้าอันดับหลุดจาก 4 แรกก็ยังต้องเห็นตัวเอง
// ไม่งั้นพอตามหลังหลายทีมจะไม่รู้เลยว่าตัวเองอยู่อันดับไหน = เสียแรงจูงใจที่เป็นหัวใจของโหมดนี้)
function pickRows(teams: RoomTeam[], myName: string): { team: RoomTeam; rank: number }[] {
  const rows = teams.slice(0, VISIBLE_ROWS).map((team, i) => ({ team, rank: i }));
  const myRank = teams.findIndex((t) => t.name === myName);
  if (myRank >= VISIBLE_ROWS) rows.push({ team: teams[myRank], rank: myRank });
  return rows;
}

// นับถอยหลังจาก "เวลาเซิร์ฟเวอร์" เป็นฐาน แล้วเดินต่อด้วยนาฬิกาเครื่องระหว่างรอ sync รอบถัดไป
// (ห้ามคิดจาก Date.now() ตรง ๆ — นาฬิกาของแต่ละเครื่องไม่ตรงกัน เวลาจะเพี้ยนคนละเรื่อง)
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

// ── styles — ใช้ภาษาเดียวกับแผง "ผู้เล่น" ในแถบขวา ──
const clockWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginRight: 'auto', // ดันไอคอน ⚙️/🏠 ไปชิดขวาเหมือนเดิม
  minWidth: 0,
};

const codeChip: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '.04em',
  color: color.primary,
  background: 'rgba(255,255,255,.9)',
  border: '1.5px solid rgba(201,162,39,.5)',
  borderRadius: radius.pill,
  padding: '4px 9px',
  whiteSpace: 'nowrap',
};

const clockText: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  fontVariantNumeric: 'tabular-nums', // เลขไม่ขยับซ้ายขวาตอนนับถอยหลัง
};

const offlineChip: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  color: '#8B0000',
  background: '#FDECEC',
  borderRadius: radius.pill,
  padding: '2px 6px',
  whiteSpace: 'nowrap',
};

const panel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 8,
  borderRadius: radius.md,
  background: 'linear-gradient(160deg, rgba(255,255,255,.9), rgba(255,248,232,.9))',
  border: '1.5px solid rgba(201,162,39,.38)',
  boxShadow: '0 5px 14px rgba(90,60,20,.18)',
  flex: '0 0 auto',
};

const panelHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
  fontWeight: 900,
  color: color.primary,
  lineHeight: 1.1,
};

const list: CSSProperties = {
  display: 'grid',
  gap: 2,
  // เพดานความสูง ≈ 5 แถว — ทีมเยอะกว่านั้นเลื่อนดูได้ ไม่ไปเบียดการ์ดสะสมด้านล่าง
  maxHeight: 128,
  overflowY: 'auto',
};

function row(me: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 6px',
    borderRadius: 8,
    background: me ? 'rgba(255,236,179,.95)' : 'rgba(255,255,255,.55)',
    fontSize: 12.5,
    fontWeight: me ? 800 : 600,
    color: color.text,
  };
}

const rankCell: CSSProperties = {
  width: 18,
  textAlign: 'center',
  flexShrink: 0,
  fontSize: 12,
};

const nameCell: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const scoreCell: CSSProperties = {
  fontWeight: 900,
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
};
