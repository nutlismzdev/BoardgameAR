import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { sfx } from '@/core/sfx';
import { getCardBack, preloadCardBack } from '@/core/cardAssets';

// ── ด่าน "จั่วการ์ด" — โชว์การ์ดคว่ำ 5 ใบ (รูปหลังการ์ดจริง) ให้ผู้เล่นแตะเลือกเอง ──
// ให้ฟีลว่าความสุ่มเกิดจากมือผู้เล่นเอง (เนื้อหายัง random เหมือนเดิม แค่เลือกใบเปิด)
//
// **จงใจโชว์แต่หลังการ์ด ไม่พลิกเผยหน้า** — รูปหน้าการ์ด (`*-front.png`) เป็น "เทมเพลตเปล่า"
// ที่ออกแบบไว้ให้เอาเนื้อหาไปวางทับ (ช่องคำถาม/ช่องคำตอบว่าง ๆ) พลิกมาดูตอนยังไม่มีข้อความ
// จึงเห็นแค่ฟอร์มเปล่า ไม่ได้บอกอะไรที่ผู้เล่นยังไม่รู้ · ที่แย่กว่านั้นคือ CardFrame โชว์
// "หลังการ์ด" ซ้ำอีกรอบแล้วพลิกเอง → เดิมลำดับเป็น หลัง→หน้าเปล่า→หลัง→เนื้อหา (ย้อนแย้ง ~2.4 วิ)
//
// ตอนนี้แบ่งหน้าที่กันชัด: picker = เลือก + ส่งใบที่เลือกพลิกหนีเข้ากลางจอ →
// CardFrame (skipBackFlip) รับไม้ต่อ "พลิกเข้า" เป็นเนื้อหา = พลิกครั้งเดียวจบ
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
  const glow = GLOW[kind];
  const [chosen, setChosen] = useState<number | null>(null);
  const [dx, setDx] = useState(0); // ระยะเลื่อนใบที่เลือกให้ไปอยู่กลางจอ (วัดจริงตอนแตะ)
  // สเตจของใบที่เลือก: lift = สไลด์ขึ้นออกจากพัด (+แสงกวาด) · away = พลิกหนีส่งไม้ต่อให้ CardFrame
  const [stage, setStage] = useState<'idle' | 'lift' | 'away'>('idle');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const timersRef = useRef<number[]>([]);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    setChosen(null);
    setStage('idle');
    setDx(0);
    setLoadState('loading');
    // รอแค่ "หลังการ์ด" — รูปเดียวที่ด่านนี้โชว์ (เดิมรอ front ด้วยทั้งที่ไม่ได้ใช้ = ช้าขึ้นเท่าตัว)
    preloadCardBack(kind)
      .then(() => {
        if (!cancelled) setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
      timersRef.current.forEach(window.clearTimeout);
      timersRef.current = [];
    };
  }, [kind, loadAttempt]);

  const pick = (i: number) => {
    if (chosen !== null) return; // เลือกได้ครั้งเดียว
    // วัดระยะจากใบที่เลือกไปกลางจอ แล้วเลื่อนไปทับตำแหน่งที่ CardFrame จะโผล่พอดี
    // (ความกว้างการ์ดเป็น clamp() คำนวณล่วงหน้าไม่ได้ ต้องวัดจริง)
    const el = cardRefs.current[i];
    if (el) {
      const r = el.getBoundingClientRect();
      setDx(Math.round(window.innerWidth / 2 - (r.left + r.width / 2)));
    }
    setChosen(i);
    setStage('lift');
    sfx.reveal();
    // สเตจ 1 (0–540ms)  สไลด์ขึ้นออกจากพัด + ใบอื่นร่วงหาย + แสงกวาดผ่านหน้าการ์ด
    // สเตจ 2 (540–920ms) พลิกหนี → CardFrame พลิกเข้ารับไม้ต่อพอดี (พลิกครั้งเดียวตลอดพิธี)
    timersRef.current.push(window.setTimeout(() => setStage('away'), 540));
    timersRef.current.push(window.setTimeout(onPicked, 920));
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

      {loadState === 'loading' ? (
        <div style={loadingWrap} role="status" aria-live="polite">
          <span className="pick-load-seal" style={loadingSeal}>
            ๗
          </span>
          กำลังเตรียมสำรับ…
        </div>
      ) : loadState === 'error' ? (
        <div style={loadingWrap} role="alert">
          <span>โหลดรูปการ์ดไม่สำเร็จ</span>
          <button type="button" style={retryBtn} onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            ลองอีกครั้ง
          </button>
        </div>
      ) : (
      <div style={fanWrap}>
        {Array.from({ length: COUNT }, (_, i) => {
          const rot = (i - mid) * 8; // พัดออกเป็นรูปพัด
          const lift = Math.abs(i - mid) * 16; // ปลายพัดยกโค้งขึ้น
          const isChosen = chosen === i;
          const gone = chosen !== null && !isChosen;

          // ใบที่เลือก "สไลด์ขึ้นออกจากพัด" มาลอยเด่นกลางจอ → แล้วพลิกหนีส่งไม้ต่อให้ CardFrame
          // (เลื่อน dx ไปกลางจอด้วย เพื่อให้ตำแหน่งตอนพลิกหนีตรงกับที่ CardFrame จะพลิกเข้าพอดี)
          const lifted = `translate(${dx}px, -104px) scale(1.3)`;
          const chosenTransform = stage === 'away' ? `${lifted} rotateY(-92deg)` : lifted;
          return (
            <button
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              type="button"
              onClick={() => pick(i)}
              disabled={chosen !== null}
              // `pick-card` ติดตลอด (ให้ reduced-motion กดอนิเมชันได้ทุกสเตจ)
              // ส่วน `--able` มีเฉพาะตอนยังเลือกได้ (hover/active) — แยกสถานะออกจากตัวตน
              className={`pick-card${chosen === null ? ' pick-card--able' : ''}`}
              aria-label={`เลือกการ์ดใบที่ ${i + 1}`}
              style={{
                ...cardBtn,
                transform: isChosen
                  ? chosenTransform
                  : gone
                  ? `translateY(96px) rotate(${rot * 1.6}deg) scale(.72)`
                  : `translateY(${lift}px) rotate(${rot}deg)`,
                opacity: gone ? 0 : isChosen && stage === 'away' ? 0.15 : 1,
                zIndex: isChosen ? 10 : 1,
                filter: isChosen
                  ? `drop-shadow(0 14px 30px rgba(0,0,0,.5)) drop-shadow(0 0 34px ${glow})`
                  : 'drop-shadow(0 8px 16px rgba(0,0,0,.42))',
                cursor: chosen === null ? 'pointer' : 'default',
                // สไลด์ขึ้นแบบมีแรงส่ง (overshoot เล็กน้อย) แล้วสเตจพลิกหนีเร็วขึ้น
                // ต่อจังหวะกับ cardFlipIn ของ CardFrame ให้รู้สึกเป็นการ์ดใบเดียวกัน
                transition:
                  stage === 'away'
                    ? 'transform .38s ease-in, opacity .38s ease-in'
                    : 'transform .52s cubic-bezier(.18,1.28,.4,1), opacity .45s ease, filter .4s ease',
                // fill ต้องเป็น `backwards` ไม่ใช่ `both` — `both` ทำให้อนิเมชัน "ค้างคุม transform"
                // ต่อหลังเล่นจบ พอกดเลือกแล้วถอดอนิเมชัน + ตั้ง transform ใหม่ในเฟรมเดียวกัน
                // Chrome จะไม่เริ่ม transition → การ์ดกระโดดขึ้นทันที (วัดได้: ถึงที่หมายใน 13ms)
                // `backwards` ใช้แค่ตอนหน่วงก่อนเริ่ม พอจบแล้วปล่อย transform คืนให้ inline + transition
                animation: `pickDealIn .42s ${i * 0.07}s backwards`,
              }}
            >
              {back && (
                <img
                  src={back}
                  alt=""
                  draggable={false}
                  decoding="async"
                  style={face}
                />
              )}
              {/* action ตอนเลือก: แสงกวาดผ่านหน้าการ์ด + ขอบทองเรือง — บอกว่า "ใบนี้แหละ"
                  เรนเดอร์เฉพาะสเตจ lift (พอพลิกหนีก็ไม่ต้องมีแล้ว) */}
              {isChosen && stage === 'lift' && (
                <>
                  <span style={shineSweep} />
                  <span style={{ ...pickRing, boxShadow: `0 0 0 3px ${glow}` }} />
                </>
              )}
            </button>
          );
        })}
      </div>
      )}

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
  // ใบการ์ดหมุน 3D เอง (rotateY ตอนพลิกหนี) → perspective ต้องอยู่ที่พ่อ ไม่งั้นแบนไม่มีมิติ
  perspective: 1200,
};

const cardBtn: CSSProperties = {
  position: 'relative',
  width: 'clamp(112px, 22vw, 168px)',
  aspectRatio: '722 / 1019', // สัดส่วนรูปการ์ดจริง
  border: 'none',
  background: 'transparent',
  padding: 0,
  transformStyle: 'preserve-3d',
  transformOrigin: 'center',
  // transition ตั้งต่อใบ (สเตจลอยเข้ากลาง vs สเตจพลิกหนี ใช้จังหวะต่างกัน)
};

const face: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: 12,
  boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.25)',
};

// แสงกวาดเฉียงผ่านหน้าการ์ดใบที่เลือก (เหมือนแสงตกกระทบตอนยกการ์ดขึ้น)
const shineSweep: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 12,
  pointerEvents: 'none',
  background:
    'linear-gradient(105deg, transparent 34%, rgba(255,255,255,.15) 44%, rgba(255,255,255,.72) 50%, rgba(255,255,255,.15) 56%, transparent 66%)',
  backgroundSize: '260% 100%',
  animation: 'pickShine .62s ease-out .06s both',
};

// ขอบเรืองสีตามชนิดการ์ด — เต้นเบา ๆ ย้ำว่าใบนี้ถูกเลือก
const pickRing: CSSProperties = {
  position: 'absolute',
  inset: -3,
  borderRadius: 15,
  pointerEvents: 'none',
  animation: 'pickRingPulse .54s ease-out both',
};

const loadingWrap: CSSProperties = {
  minHeight: 'clamp(210px, 44vw, 320px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  color: '#FFE9A8',
  fontSize: 17,
  fontWeight: 700,
};

const loadingSeal: CSSProperties = {
  width: 54,
  height: 54,
  display: 'grid',
  placeItems: 'center',
  border: '3px double #C9A227',
  borderRadius: '50%',
  animation: 'pickLoadPulse 1s ease-in-out infinite',
};

const retryBtn: CSSProperties = {
  minHeight: 42,
  padding: '9px 18px',
  color: '#2A2118',
  background: '#FFE9A8',
  border: '1px solid #C9A227',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
};

const PICK_FX = `
@keyframes pickBackdropIn{from{opacity:0}to{opacity:1}}
@keyframes pickLoadPulse{0%,100%{opacity:.45;transform:scale(.94)}50%{opacity:1;transform:scale(1)}}
/* แจกการ์ดทีละใบจากกองกลาง — บอกว่า "นี่คือสำรับของจริง" ก่อนให้เลือก */
@keyframes pickDealIn{
  from{opacity:0;transform:translate(0,120px) rotate(0deg) scale(.7)}
  to{opacity:1}
}
/* แสงกวาดผ่านตอนการ์ดสไลด์ขึ้น */
@keyframes pickShine{
  from{background-position:180% 0;opacity:0}
  35%{opacity:1}
  to{background-position:-80% 0;opacity:0}
}
/* ขอบเรืองเบ่งออกแล้วจางลง */
@keyframes pickRingPulse{
  from{opacity:0;transform:scale(.9)}
  45%{opacity:1;transform:scale(1.04)}
  to{opacity:.45;transform:scale(1)}
}
/* ยกใบที่ชี้/แตะค้างให้เด่น — สื่อว่า "แตะได้" โดยไม่ต้องมีข้อความบอก */
.pick-card--able:hover{filter:brightness(1.08) drop-shadow(0 0 18px rgba(255,255,255,.45)) !important;}
.pick-card--able:active{filter:brightness(1.12) drop-shadow(0 0 22px rgba(255,255,255,.5)) !important;}
/* ผู้ใช้ที่ขอลดการเคลื่อนไหว: ตัดทั้งอนิเมชันและ transition ทุกสเตจ (ยังเลือกการ์ดได้ปกติ
   แค่การ์ดไปโผล่ที่ตำแหน่งใหม่ทันที) — รวมชีพจรตอนโหลดที่วนไม่รู้จบด้วย */
@media (prefers-reduced-motion: reduce){
  .pick-card{animation:none !important;transition:none !important;}
  .pick-load-seal{animation:none !important;}
}
`;
