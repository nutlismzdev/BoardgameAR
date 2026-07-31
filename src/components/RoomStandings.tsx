import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGame } from '@/core/store';
import { EFFECTS } from '@/core/roomApi';
import type { EffectKind, RoomTeam } from '@/core/roomApi';
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
  const [sabotageOpen, setSabotageOpen] = useState(false);
  if (!room?.state) return null;

  const teams = room.state.teams;
  const rows = pickRows(teams, room.teamName);
  // ป่วนได้เฉพาะทีมที่ "อันดับนำหน้าเรา" → ถ้าเรานำอยู่อันดับ 1 ก็ไม่มีใครให้ป่วน (ตามกฎ)
  const myRank = teams.findIndex((t) => t.name === room.teamName);
  const targets = myRank > 0 ? teams.slice(0, myRank) : [];
  const canSabotage =
    room.state.room.rules.sabotage && room.state.room.status === 'running' && targets.length > 0;

  return (
    <section style={panel}>
      {sabotageOpen && <SabotagePicker targets={targets} onClose={() => setSabotageOpen(false)} />}
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

      {/* ── ปุ่มส่งการ์ดป่วน ──
          เดิมเป็นชิปเล็ก ๆ ซ่อนอยู่มุมหัวแผง เด็กหาไม่เจอว่ามีของเล่นอยู่ตรงนี้
          ตอนนี้เป็นปุ่มเต็มความกว้างใต้ตารางอันดับ + บอกสถานะ 3 แบบในตัวเอง:
          พร้อมยิง (เรืองแสง) / กำลังคูลดาวน์ (นับถอยหลัง) / เหรียญไม่พอ */}
      {canSabotage && <SabotageButton onOpen={() => setSabotageOpen(true)} />}
    </section>
  );
}

/** ปุ่มป่วน — นับถอยหลังคูลดาวน์ให้เห็นเอง ไม่ต้องกดแล้วค่อยโดนบอกว่ายังไม่ได้ */
function SabotageButton({ onOpen }: { onOpen: () => void }) {
  const coins = useGame((s) => s.players[s.currentPlayerIndex]?.coins ?? 0);
  const wait = useGame((s) => s.sabotageWait);
  const pending = useGame((s) => !!s.outgoingSabotage);
  // เดินนาฬิกาต่อเองระหว่างรอ sync รอบถัดไป (server อัปเดตค่านี้ทุก 3 วิ)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick(0);
    if (wait <= 0) return;
    const iv = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(iv);
  }, [wait]);
  const left = Math.max(0, wait - tick);

  const cheapest = Math.min(...Object.values(EFFECTS).map((e) => e.price));
  const poor = coins < cheapest;
  const ready = left === 0 && !poor && !pending;

  return (
    <button style={sabotageBtn(ready, left > 0)} onClick={onOpen} disabled={!ready}>
      <span style={{ fontSize: 17 }}>😈</span>
      <span style={{ flex: 1, textAlign: 'left' }}>
        {pending ? 'กำลังส่ง…' : left > 0 ? `พร้อมใน ${formatClock(left)}` : poor ? `ต้องมี 🪙 ${cheapest}` : 'ส่งการ์ดป่วน'}
      </span>
      {ready && <span style={sabotageReadyDot} className="sab-pulse" />}
      <style>{`
        @keyframes sabPulse { 0%,100% { opacity:.35; transform:scale(.75) } 50% { opacity:1; transform:scale(1) } }
        .sab-pulse { animation: sabPulse 1.1s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .sab-pulse { animation: none } }
      `}</style>
    </button>
  );
}

/**
 * เลือกเป้าหมาย + การ์ดป่วน
 * ⚠️ รายชื่อที่ส่งเข้ามาถูกกรองแล้วว่า "นำหน้าเรา" — แต่ server ตรวจซ้ำอีกชั้นเสมอ (ห้ามเชื่อ client)
 */
function SabotagePicker({ targets, onClose }: { targets: RoomTeam[]; onClose: () => void }) {
  const coins = useGame((s) => s.players[s.currentPlayerIndex]?.coins ?? 0);
  const queueSabotage = useGame((s) => s.queueSabotage);
  const pending = useGame((s) => !!s.outgoingSabotage);
  const [target, setTarget] = useState(targets[0]?.name ?? '');

  const fire = (kind: EffectKind) => {
    if (!target || !queueSabotage(target, kind)) return;
    onClose(); // ผลจริงจะรู้ตอน heartbeat รอบหน้า (≤3 วิ) แล้วเด้งเป็นป้ายบอกให้เอง
  };

  return (
    <div style={pickerOverlay} onClick={onClose}>
      <div style={pickerPanel} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 900, color: color.primary }}>😈 ส่งการ์ดป่วน</div>
        <p style={pickerNote}>
          ป่วนได้เฉพาะทีมที่นำหน้าเรา · จ่ายด้วยเหรียญของเราเอง (มี 🪙 {coins}) · ส่งได้ 1 ใบต่อ 2 นาที
        </p>

        <div style={{ display: 'grid', gap: 6 }}>
          {targets.map((t) => (
            <button
              key={t.name}
              onClick={() => setTarget(t.name)}
              style={targetBtn(t.name === target)}
            >
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t.name}
              </span>
              <span style={{ fontWeight: 900 }}>👑 {t.kingCoins}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
          {(Object.keys(EFFECTS) as EffectKind[]).map((kind) => {
            const meta = EFFECTS[kind];
            const afford = coins >= meta.price && !pending;
            return (
              <button key={kind} disabled={!afford} onClick={() => fire(kind)} style={effectBtn(afford)}>
                <span style={{ fontSize: 20 }}>{meta.icon}</span>
                <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <b>{meta.label}</b>
                  <span style={{ display: 'block', fontSize: 11.5, opacity: 0.8 }}>{meta.detail}</span>
                </span>
                <span style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>🪙 {meta.price}</span>
              </button>
            );
          })}
        </div>

        <button style={closeBtn} onClick={onClose}>
          ปิด
        </button>
      </div>
    </div>
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

function sabotageBtn(ready: boolean, cooling: boolean): CSSProperties {
  return {
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    width: '100%',
    marginTop: 7,
    padding: '8px 11px',
    minHeight: 40,
    fontSize: 13,
    fontWeight: 900,
    borderRadius: radius.md,
    border: `2px solid ${ready ? '#B02020' : cooling ? '#C8B48A' : '#D8D2C4'}`,
    background: ready
      ? 'linear-gradient(160deg,#FFE0E0,#FFC9C9)'
      : cooling
      ? '#F4EFE3'
      : '#EFEDE7',
    color: ready ? '#8B0000' : '#8A7250',
    cursor: ready ? 'pointer' : 'not-allowed',
    boxShadow: ready ? '0 4px 12px rgba(176,32,32,.22)' : 'none',
  };
}

const sabotageReadyDot: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: '#B02020',
  flexShrink: 0,
};

const pickerOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 170,
  padding: 18,
};

const pickerPanel: CSSProperties = {
  width: 'min(420px, 96vw)',
  maxHeight: '90vh',
  overflowY: 'auto',
  display: 'grid',
  gap: 10,
  padding: 18,
  borderRadius: radius.lg,
  background: color.surface,
  boxShadow: '0 18px 50px rgba(0,0,0,.45)',
};

const pickerNote: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: color.textMuted,
};

function targetBtn(active: boolean): CSSProperties {
  return {
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 15,
    fontWeight: active ? 900 : 600,
    padding: '10px 12px',
    minHeight: 44,
    borderRadius: radius.md,
    border: `2px solid ${active ? color.primary : 'rgba(201,162,39,.45)'}`,
    background: active ? '#FFF3CC' : '#fff',
    color: color.text,
    cursor: 'pointer',
  };
}

function effectBtn(afford: boolean): CSSProperties {
  return {
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    minHeight: 52,
    borderRadius: radius.md,
    border: `2px solid ${afford ? '#E5A5A5' : '#ddd'}`,
    background: afford ? '#FFF6F6' : '#f2f2f2',
    color: afford ? color.text : '#aaa',
    cursor: afford ? 'pointer' : 'not-allowed',
    fontSize: 14,
  };
}

const closeBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 700,
  color: color.primary,
  background: 'transparent',
  border: `1.5px solid ${color.secondary}`,
  borderRadius: radius.pill,
  padding: 11,
  minHeight: 44,
  cursor: 'pointer',
};
