// ชิ้นส่วนที่ใช้ร่วมกันของแบบทดสอบ — สไตล์ "ใบลาน" + แถบไทม์ไลน์ ๓๐ ช่อง
//
// ทำไมหน้าตาต้องเงียบกว่ากระดานเกม: นี่คือ "การวัดผล" ไม่ใช่การ์ดในเกม
// จึงไม่มีแสงเรือง/คอนเฟตติ/เสียงถูก-ผิด และไม่โหลดฟอนต์ใหม่ (แอปต้องเปิดออฟไลน์ได้)
//
// ⚠️ inline style ทำ :hover/:focus-visible/media query ไม่ได้ → สิ่งที่ต้องใช้ pseudo-class
// อยู่ใน `TEST_STYLE` แล้วผูกด้วย className (แพตเทิร์นเดียวกับ `STYLE` ใน Home.tsx)

import type { CSSProperties, ReactNode } from 'react';
import { KINGS, kingShortLabel } from '@/core/content';
import { TEST_QUESTIONS, questionByNo } from '@/core/pretest';
import { eraColor, ERA_FALLBACK } from '@/theme/tokens';

const TH = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
export const toThai = (s: string | number) => String(s).replace(/[0-9]/g, (d) => TH[+d]);

export const PAPER = 'radial-gradient(125% 95% at 50% -12%, #FBF4E1 0%, #F3E7C9 52%, #ECDCB8 100%)';
export const INK = '#3A2A18';
export const GOLD = '#C79A3A';
export const CRIMSON = '#8A1414';
/** สีตัวอักษรรอง — ตรวจแล้วผ่าน AA บนพื้นการ์ด #FFFDF6 (ของเดิม #8A7A58 ได้แค่ 4.09:1) */
export const MUTED = '#6E6047';

export const TEST_STYLE = `
.t-tap { transition: background-color .15s ease, border-color .15s ease, box-shadow .15s ease; }
@media (hover: hover) {
  .t-tap:not(:disabled):hover { filter: brightness(1.04); border-color: ${GOLD}; }
}
.t-tap:not(:disabled):active { transform: translateY(1px); }
.t-tap:focus-visible, .t-input:focus-visible {
  outline: 3px solid ${CRIMSON};
  outline-offset: 2px;
}
/* body ถูกล็อก (position:fixed) → กล่องที่สกรอลล์เองต้องกันแรงเลื่อนทะลุไปหน้าแม่ */
.t-scroll { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
/* ⚠️ กองเนื้อหาแนวตั้งด้วย "การไหลปกติ" ไม่ใช่ grid/flex
   เพราะลูกที่เป็นกล่องเลื่อนเอง (เช่น กล่องครอบตารางที่ตั้ง overflow-x: auto)
   มี "ขนาดต่ำสุดอัตโนมัติ = 0" ตามสเปก → ในกริดที่พื้นที่ไม่พอ แถวนั้นจะยุบเหลือ 0
   แล้ว **ตารางหายไปทั้งก้อนโดยไม่มี error** (เจอจริง: จอครูขึ้นสรุป+หมวดล่างครบ แต่ไม่มีตารางรายชื่อ)
   การไหลปกติคิดความสูงจากเนื้อหาเสมอ จึงไม่มีวันยุบ */
.t-stack > * + * { margin-top: 14px; }
.t-cell:focus-visible { outline: 2px solid ${INK}; outline-offset: 1px; }
/* หมวดพับเก็บ — ใช้ <details> ของเบราว์เซอร์ (กดด้วยคีย์บอร์ดได้ ไม่ต้องมี state)
   ทำ marker เองเพราะ summary ที่เป็น flex จะไม่โชว์สามเหลี่ยมมาตรฐาน */
.t-fold > summary { list-style: none; cursor: pointer; }
.t-fold > summary::-webkit-details-marker { display: none; }
.t-fold > summary::before { content: '▸'; display: inline-block; width: 1em; color: ${GOLD}; font-weight: 700; }
.t-fold[open] > summary::before { content: '▾'; }
.t-fold > summary:focus-visible { outline: 3px solid ${CRIMSON}; outline-offset: 2px; border-radius: 8px; }
@media (hover: hover) { .t-fold > summary:hover { background: rgba(201,162,39,.10); } }
/* จอแคบ: ป้ายพระองค์ใต้แถบไทม์ไลน์เหลือกว้าง ~35px = อ่านไม่ออกอยู่ดี ซ่อนดีกว่าโชว์เป็น "…" */
@media (max-width: 780px) {
  .t-strip-label { display: none; }
  .t-strip { gap: 5px !important; }
}
@media (max-width: 560px) {
  .t-nav-long { display: none; }
}
@media (min-width: 561px) {
  .t-nav-short { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .t-tap { transition: none; }
  .t-tap:not(:disabled):active { transform: none; }
}
`;

export function colorOfKing(kingId: string): string {
  const king = KINGS.find((k) => k.id === kingId);
  return (king && eraColor[king.era]) || ERA_FALLBACK;
}

export function labelOfKing(kingId: string): string {
  const king = KINGS.find((k) => k.id === kingId);
  return king ? kingShortLabel(king.name) : 'ภาพรวม';
}

export type CellState = 'empty' | 'answered' | 'correct' | 'wrong';

const CELL_LABEL: Record<CellState, string> = {
  empty: 'ยังไม่ตอบ',
  answered: 'ตอบแล้ว',
  correct: 'ตอบถูก',
  wrong: 'ตอบผิด',
};

// ข้อ 1–30 เรียงตามรัชสมัยพอดี → จับกลุ่มตามพระองค์ได้จากลำดับข้อตรง ๆ
const GROUPS = TEST_QUESTIONS.reduce<{ kingId: string; nos: number[] }[]>((acc, q) => {
  const last = acc[acc.length - 1];
  if (last && last.kingId === q.kingId) last.nos.push(q.no);
  else acc.push({ kingId: q.kingId, nos: [q.no] });
  return acc;
}, []);

/**
 * แถบไทม์ไลน์ ๓๐ ช่อง — 1 ช่อง = 1 ข้อ ระบายสีตามยุคของพระองค์ที่ข้อนั้นถาม
 *
 * เรียงตาม "เลขข้อต้นฉบับ" เสมอ (ไม่ใช่ลำดับที่แจก) เพราะข้อ 1→30 เรียงตามเวลาจริง
 * แถบนี้จึงเป็นเส้นเวลาประวัติศาสตร์ ไม่ใช่แค่ตัวนับความคืบหน้า — และใช้แตะข้ามข้อได้ในตัว
 */
export function EraStrip({
  state,
  currentNo,
  onPick,
  showLabels = true,
  compact = false,
  ariaLabel = 'ความคืบหน้ารายข้อ',
}: {
  state: (no: number) => CellState;
  currentNo?: number;
  onPick?: (no: number) => void;
  showLabels?: boolean;
  compact?: boolean;
  ariaLabel?: string;
}) {
  // แตะได้ต้องสูงพอตามเกณฑ์เป้าหมายสัมผัส (ช่องบางอยู่แล้วเพราะมี 30 ช่อง จึงชดเชยด้วยความสูง)
  const h = compact ? 12 : onPick ? 34 : 26;
  return (
    <div
      className="t-strip"
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-end', width: '100%' }}
    >
      {GROUPS.map((g) => {
        const tint = colorOfKing(g.kingId);
        return (
          <div key={g.kingId} style={{ flex: g.nos.length, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {g.nos.map((no) => {
                const st = state(no);
                const active = currentNo === no;
                const label = `ข้อ ${no} ${labelOfKing(g.kingId)} — ${CELL_LABEL[st]}`;
                const look: CSSProperties = {
                  flex: 1,
                  height: h,
                  minWidth: 0,
                  padding: 0,
                  borderRadius: 3,
                  background: st === 'empty' || st === 'wrong' ? hexA(tint, 0.16) : tint,
                  border:
                    st === 'wrong'
                      ? `1.5px solid ${CRIMSON}`
                      : active
                      ? `2px solid ${INK}`
                      : `1px solid ${hexA(tint, 0.55)}`,
                  boxShadow: active ? `0 0 0 2px ${hexA(GOLD, 0.65)}` : 'none',
                  color: '#fff',
                  fontFamily: "'Sarabun',sans-serif",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: 1,
                  display: 'grid',
                  placeItems: 'center',
                };
                const mark = st === 'correct' ? '✓' : st === 'wrong' ? '✕' : '';
                return onPick ? (
                  <button
                    key={no}
                    type="button"
                    className="t-cell"
                    onClick={() => onPick(no)}
                    aria-label={label}
                    aria-current={active ? 'step' : undefined}
                    style={{ ...look, cursor: 'pointer' }}
                  >
                    {mark}
                  </button>
                ) : (
                  <span key={no} role="img" aria-label={label} style={look}>
                    {mark}
                  </span>
                );
              })}
            </div>
            {showLabels && (
              <div
                className="t-strip-label"
                style={{
                  marginTop: 5,
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: shade(tint),
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  borderTop: `2px solid ${hexA(tint, 0.35)}`,
                  paddingTop: 3,
                }}
              >
                {labelOfKing(g.kingId)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** ป้ายพระองค์ของข้อที่กำลังทำ (บอกบริบทให้เด็กโดยไม่บอกเฉลย) */
export function KingTag({ no }: { no: number }) {
  const q = questionByNo(no);
  if (!q) return null;
  const tint = colorOfKing(q.kingId);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        background: hexA(tint, 0.14),
        border: `1.5px solid ${hexA(tint, 0.5)}`,
        color: shade(tint),
        fontSize: 12.5,
        fontWeight: 700,
      }}
    >
      {labelOfKing(q.kingId)}
    </span>
  );
}

export function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** สีเดียวกันแต่เข้มพอใช้เป็นตัวอักษรบนพื้นครีม — สีป้ายยุคดิบ ๆ ได้ contrast แค่ ~3.9:1 */
export function shade(hex: string, amount = 0.34) {
  const h = hex.replace('#', '');
  const mix = (v: number) => Math.round(v * (1 - amount));
  const r = mix(parseInt(h.slice(0, 2), 16));
  const g = mix(parseInt(h.slice(2, 4), 16));
  const b = mix(parseInt(h.slice(4, 6), 16));
  return `rgb(${r},${g},${b})`;
}

export function Card({
  children,
  style,
  scroll = false,
}: {
  children: ReactNode;
  style?: CSSProperties;
  scroll?: boolean;
}) {
  return (
    <div
      className={scroll ? 't-scroll' : undefined}
      style={{
        background: '#FFFDF6',
        border: `1.5px solid ${hexA(GOLD, 0.55)}`,
        borderRadius: 14,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export const primaryBtn: CSSProperties = {
  fontFamily: "'Sarabun',sans-serif",
  fontSize: 17,
  fontWeight: 800,
  color: '#FFF7E2',
  background: CRIMSON,
  border: `2px solid ${CRIMSON}`,
  borderRadius: 12,
  padding: '13px 22px',
  minHeight: 48,
  cursor: 'pointer',
};

export const ghostBtn: CSSProperties = {
  fontFamily: "'Sarabun',sans-serif",
  fontSize: 16,
  fontWeight: 700,
  color: '#7A5B1E',
  background: '#FFFDF6',
  border: `1.5px solid ${GOLD}`,
  borderRadius: 12,
  padding: '12px 20px',
  minHeight: 48,
  cursor: 'pointer',
};

export const dangerBtn: CSSProperties = {
  ...ghostBtn,
  color: CRIMSON,
  borderColor: hexA(CRIMSON, 0.6),
};

export const fieldInput: CSSProperties = {
  fontFamily: "'Sarabun',sans-serif",
  // ต้อง ≥16px ไม่งั้น iOS ซูมเข้าตอนโฟกัสแล้วเลย์เอาต์เพี้ยน (กฎเดียวกับ styles.css)
  fontSize: 17,
  fontWeight: 600,
  color: INK,
  background: '#fff',
  border: `1.5px solid ${hexA(GOLD, 0.75)}`,
  borderRadius: 10,
  padding: '11px 13px',
  minHeight: 46,
  width: '100%',
  // เอา outline เริ่มต้นออกได้เพราะมี .t-input:focus-visible ใน TEST_STYLE มาแทนแล้ว
  outline: 'none',
};

export const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 21,
  fontWeight: 800,
  color: CRIMSON,
  textWrap: 'balance' as CSSProperties['textWrap'],
};

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** ระยะเวลาแบบอ่านออก — ใช้ในประโยค ("ใช้เวลา ๗ นาที ๓๐ วินาที") ต่างจากหน้าปัดนาฬิกา m:ss */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s} วินาที`;
  return s ? `${m} นาที ${s} วินาที` : `${m} นาที`;
}

/** วันเวลาแบบไทย — ใช้ Intl ไม่ฮาร์ดโค้ดรูปแบบ (ครูอาจเปิดบนเครื่องที่ตั้ง locale ต่างกัน) */
export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));
}
