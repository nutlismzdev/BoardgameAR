import type { CSSProperties } from 'react';

// ── ตราประทับผลลัพธ์บน "จอกลาง" — เด้งเต็มจอทันทีที่รู้ผล ──
// ใช้ทั้งโหมดตอบบน tablet (ช่องฟ้า/สาระ) และโหมดตอบผ่านมือถือ (QR)
//
// **จงใจเป็น position:fixed คลุมทั้งจอ ไม่ได้อยู่ในกล่องการ์ด** เพราะเนื้อหาการ์ดอยู่ใน
// กล่อง maxHeight:88vh + overflow:auto — ถ้าวางในนั้นจะหายใต้ fold เหมือนที่ปุ่มเคยเป็น
// `pointerEvents:none` ทั้งชั้น เพื่อไม่บังการกดปุ่มที่อยู่ข้างใต้
//
// ผู้เรียกต้องใส่ `key` ที่เปลี่ยนทุกครั้งที่ตอบ (ดู `stamp.id` ใน CardModal) —
// ถ้า element ไม่ remount อนิเมชัน CSS จะไม่เล่นซ้ำ ตอบถูกติดกันสองใบจะเงียบ
export const STAMP_MS = 1400; // อายุตราประทับ — ผู้เรียกใช้จับเวลาปิดการ์ดให้ตรงกัน

export function ResultStamp({ kind }: { kind: 'correct' | 'wrong' }) {
  const ok = kind === 'correct';
  return (
    <div style={wrap} aria-hidden="true">
      {/* แสงวาบเต็มจอ — บอกผลตั้งแต่เสี้ยววินาทีแรกแม้ยังไม่ทันอ่านอะไร */}
      <div style={{ ...flash, background: ok ? FLASH_OK : FLASH_NO }} />

      {/* รัศมีพุ่งออกจากตรากลางจอ (เฉพาะตอบถูก) */}
      {ok && <div style={rays} />}

      <div style={ok ? stampOk : stampNo}>
        <span style={mark}>{ok ? '✓' : '✕'}</span>
        <span style={label}>{ok ? 'ถูกต้อง!' : 'ยังไม่ถูก'}</span>
      </div>

      {/* ดาวกระจายรอบตรา (เฉพาะตอบถูก) — วางเป็นวงกลมด้วย rotate+translate */}
      {ok &&
        SPARKS.map((s, i) => (
          <span
            key={i}
            style={{
              ...spark,
              transform: `rotate(${s.deg}deg) translateY(-${s.dist}px)`,
              animationDelay: `${s.delay}s`,
              fontSize: s.size,
            }}
          >
            {s.ch}
          </span>
        ))}

      <style>{STAMP_FX}</style>
    </div>
  );
}

const FLASH_OK = 'radial-gradient(circle at 50% 50%, rgba(76,201,106,.42), rgba(27,122,52,0) 62%)';
const FLASH_NO = 'radial-gradient(circle at 50% 50%, rgba(228,87,46,.42), rgba(176,32,32,0) 62%)';

const SPARKS = [
  { ch: '⭐', deg: 0, dist: 150, delay: 0.06, size: 30 },
  { ch: '✨', deg: 52, dist: 132, delay: 0.13, size: 26 },
  { ch: '🎉', deg: 104, dist: 148, delay: 0.02, size: 30 },
  { ch: '⭐', deg: 156, dist: 128, delay: 0.17, size: 24 },
  { ch: '✨', deg: 208, dist: 150, delay: 0.09, size: 28 },
  { ch: '🎊', deg: 256, dist: 134, delay: 0.2, size: 28 },
  { ch: '⭐', deg: 306, dist: 146, delay: 0.11, size: 26 },
];

const wrap: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  zIndex: 130, // เหนือการ์ด (100) แต่ใต้ AR เต็มจอ
  pointerEvents: 'none',
};

const flash: CSSProperties = {
  position: 'absolute',
  inset: 0,
  animation: 'stampFlash .5s ease-out both',
};

const rays: CSSProperties = {
  position: 'absolute',
  width: 'min(70vh, 380px)',
  aspectRatio: '1',
  borderRadius: '50%',
  background:
    'repeating-conic-gradient(rgba(255,240,170,.5) 0deg 7deg, transparent 7deg 20deg)',
  maskImage: 'radial-gradient(circle, transparent 34%, #000 46%, transparent 72%)',
  WebkitMaskImage: 'radial-gradient(circle, transparent 34%, #000 46%, transparent 72%)',
  animation: 'stampRays 1.1s ease-out both',
};

const stampBase: CSSProperties = {
  position: 'relative',
  width: 'min(42vh, 236px)',
  aspectRatio: '1',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  color: '#fff',
  borderRadius: '50%',
  border: '7px solid rgba(255,255,255,.94)',
};

const stampOk: CSSProperties = {
  ...stampBase,
  background: 'radial-gradient(circle at 38% 30%, #5FD97C, #1B7A34)',
  boxShadow: '0 0 0 9px rgba(31,122,52,.3), 0 20px 50px rgba(0,0,0,.45)',
  animation: `stampIn ${STAMP_MS}ms cubic-bezier(.2,1.4,.4,1) both`,
};

const stampNo: CSSProperties = {
  ...stampBase,
  background: 'radial-gradient(circle at 38% 30%, #F0714A, #B02020)',
  boxShadow: '0 0 0 9px rgba(176,32,32,.28), 0 20px 50px rgba(0,0,0,.45)',
  animation: `stampWrongIn ${STAMP_MS}ms cubic-bezier(.2,1.2,.4,1) both`,
};

const mark: CSSProperties = {
  fontSize: 'min(21vh, 112px)',
  fontWeight: 900,
  lineHeight: 0.92,
  textShadow: '0 4px 12px rgba(0,0,0,.3)',
};

const label: CSSProperties = {
  fontSize: 'min(4.4vh, 26px)',
  fontWeight: 900,
  letterSpacing: 0.5,
  textShadow: '0 2px 8px rgba(0,0,0,.35)',
};

const spark: CSSProperties = {
  position: 'absolute',
  lineHeight: 1,
  transformOrigin: '50% 50%',
  animation: 'stampSpark .95s ease-out both',
};

const STAMP_FX = `
@keyframes stampFlash{from{opacity:0}25%{opacity:1}to{opacity:0}}
/* ตรา: กระแทกลงมาจากบน → เด้งนิ่ง → จางหาย (ให้ความรู้สึก "ตัดสินแล้ว") */
@keyframes stampIn{
  0%{opacity:0;transform:scale(2.7) rotate(-20deg)}
  38%{opacity:1;transform:scale(.9) rotate(-8deg)}
  50%{transform:scale(1.08) rotate(-8deg)}
  60%{transform:scale(.98) rotate(-8deg)}
  68%,84%{transform:scale(1) rotate(-8deg)}
  100%{opacity:0;transform:scale(1.05) rotate(-8deg)}
}
/* ผิด: กระแทกแล้วสั่นปฏิเสธซ้ายขวา (ภาษากายของ "ไม่ใช่") */
@keyframes stampWrongIn{
  0%{opacity:0;transform:scale(2.7)}
  34%{opacity:1;transform:scale(1)}
  44%{transform:scale(1) translateX(-13px) rotate(-3deg)}
  54%{transform:scale(1) translateX(13px) rotate(3deg)}
  64%{transform:scale(1) translateX(-8px) rotate(-2deg)}
  74%{transform:scale(1) translateX(5px) rotate(1deg)}
  82%,86%{transform:scale(1) translateX(0) rotate(0)}
  100%{opacity:0;transform:scale(1)}
}
@keyframes stampRays{from{opacity:0;transform:scale(.5) rotate(0)}30%{opacity:.95}to{opacity:0;transform:scale(1.25) rotate(38deg)}}
@keyframes stampSpark{0%{opacity:0;transform:rotate(0) translateY(0) scale(.2)}35%{opacity:1}to{opacity:0}}
/* ผู้ใช้ที่ขอลดการเคลื่อนไหว: ยังบอกผลชัด แต่ไม่กระแทก/ไม่สั่น/ไม่มีดาววิ่ง */
@media (prefers-reduced-motion: reduce){
  @keyframes stampIn{0%{opacity:0}12%,86%{opacity:1;transform:none}100%{opacity:0}}
  @keyframes stampWrongIn{0%{opacity:0}12%,86%{opacity:1;transform:none}100%{opacity:0}}
  @keyframes stampRays{0%,100%{opacity:0}}
  @keyframes stampSpark{0%,100%{opacity:0}}
  @keyframes stampFlash{0%,100%{opacity:0}}
}
`;
