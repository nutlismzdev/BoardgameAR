import { useState } from 'react';
import type { CSSProperties } from 'react';
import { sfx } from '@/core/sfx';
import { getCardBack, getCardFront } from '@/core/cardAssets';

// ── ด่าน "จั่วการ์ด" — โชว์การ์ดคว่ำ 5 ใบ (รูปหลังการ์ดจริง) ให้ผู้เล่นแตะเลือกเอง ──
// เลือกใบไหนก็พลิกเผย "หน้าการ์ดจริง" ของชนิดนั้น แล้วค่อยเปิดเนื้อหา
// ให้ฟีลว่าความสุ่มเกิดจากมือผู้เล่นเอง (เนื้อหายัง random เหมือนเดิม แค่เลือกใบเปิด)
export type PickKind = 'question' | 'subject' | 'knowledge' | 'goldking';

const GLOW: Record<PickKind, string> = {
  question: 'rgba(30,136,229,.7)',
  subject: 'rgba(38,166,154,.7)',
  knowledge: 'rgba(236,64,122,.7)',
  goldking: 'rgba(201,162,39,.85)',
};
const LABEL: Record<PickKind, string> = {
  question: 'การ์ดคำถาม',
  subject: 'สาระการเรียนรู้',
  knowledge: 'การ์ดความรู้',
  goldking: 'เหรียญกษัตริย์',
};

const COUNT = 5;

export function CardPicker({ kind, onPicked }: { kind: PickKind; onPicked: () => void }) {
  const back = getCardBack(kind);
  const front = getCardFront(kind);
  const glow = GLOW[kind];
  const [chosen, setChosen] = useState<number | null>(null);

  const pick = (i: number) => {
    if (chosen !== null) return; // เลือกได้ครั้งเดียว
    setChosen(i);
    sfx.reveal();
    setTimeout(onPicked, 900); // รอเอฟเฟกต์พลิกการ์ดจบก่อนเผยเนื้อหา
  };

  const mid = (COUNT - 1) / 2;

  return (
    <div style={overlay}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={title}>{chosen === null ? 'เลือกการ์ดของคุณ' : 'เปิดการ์ด!'}</h2>
        <p style={subtitle}>
          {chosen === null ? `แตะเลือก 1 ใบจาก ${COUNT} ใบ · ${LABEL[kind]}` : 'ดวงของคุณเอง ✨'}
        </p>
      </div>

      <div style={fanWrap}>
        {Array.from({ length: COUNT }, (_, i) => {
          const rot = (i - mid) * 8; // พัดออกเป็นรูปพัด
          const lift = Math.abs(i - mid) * 16; // ปลายพัดยกโค้งขึ้น
          const isChosen = chosen === i;
          const gone = chosen !== null && !isChosen;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              className="pick-card"
              style={{
                ...cardBtn,
                transform: isChosen
                  ? 'translateY(-40px) scale(1.16)'
                  : gone
                  ? `translateY(80px) rotate(${rot}deg) scale(.78)`
                  : `translateY(${lift}px) rotate(${rot}deg)`,
                opacity: gone ? 0 : 1,
                zIndex: isChosen ? 10 : 1,
                filter: isChosen
                  ? `drop-shadow(0 0 26px ${glow})`
                  : 'drop-shadow(0 8px 16px rgba(0,0,0,.42))',
                cursor: chosen === null ? 'pointer' : 'default',
              }}
            >
              {/* ตัวพลิก 3D: หน้าหลัง (back) → พลิกเผยหน้าจริง (front) */}
              <div style={{ ...flipInner, transform: isChosen ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                {back && <img src={back} alt="" draggable={false} style={{ ...face, transform: 'rotateY(0deg)' }} />}
                {front && (
                  <img src={front} alt="" draggable={false} style={{ ...face, transform: 'rotateY(180deg)' }} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <style>{PICK_FX}</style>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'radial-gradient(120% 120% at 50% 30%, rgba(30,18,8,.74), rgba(10,6,3,.92))',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 28,
  zIndex: 120,
  padding: 24,
  animation: 'pickBackdropIn .35s ease',
};

const title: CSSProperties = {
  margin: '0 0 2px',
  fontSize: 26,
  fontWeight: 900,
  color: '#FFE9A8',
  textShadow: '0 2px 10px rgba(0,0,0,.6)',
};
const subtitle: CSSProperties = { margin: 0, fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,.85)' };

const fanWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  gap: 'clamp(6px, 1.4vw, 14px)',
  paddingTop: 56,
  minHeight: 'clamp(210px, 44vw, 320px)',
};

const cardBtn: CSSProperties = {
  position: 'relative',
  width: 'clamp(112px, 22vw, 168px)',
  aspectRatio: '722 / 1019', // สัดส่วนรูปการ์ดจริง
  border: 'none',
  background: 'transparent',
  padding: 0,
  perspective: 900,
  transition: 'transform .5s cubic-bezier(.2,1.1,.4,1), opacity .5s ease, filter .3s ease',
};

const flipInner: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  transformStyle: 'preserve-3d',
  transition: 'transform .85s cubic-bezier(.3,1,.5,1)',
};

const face: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: 12,
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.25)',
};

const PICK_FX = `
@keyframes pickBackdropIn{from{opacity:0}to{opacity:1}}
.pick-card:hover{filter:brightness(1.07) drop-shadow(0 0 16px rgba(255,255,255,.4)) !important;}
`;
