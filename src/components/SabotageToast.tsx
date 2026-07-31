import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useGame } from '@/core/store';
import { EFFECTS } from '@/core/roomApi';
import { radius } from '@/theme/tokens';

// ── ป้ายแจ้งเตือนการ์ดป่วน ──
// ① โดนป่วน — ต้องบอกว่า "ใครส่งมา" เสมอ ความสนุกอยู่ที่รู้แล้วอยากเอาคืน
//    ถ้าไม่บอก มันจะกลายเป็นแค่ความซวยลอย ๆ ที่ทำให้เด็กงงว่าเกมพังหรือเปล่า
// ② ผลของใบที่เราส่งไป — server เป็นคนตัดสิน (คูลดาวน์/อันดับ/คิวเต็ม) จึงต้องรายงานกลับ
//    ไม่งั้นเด็กกดแล้วเงียบ ไม่รู้ว่าเหรียญที่จ่ายไปได้ผลไหม (จ่ายไปแล้วถูกคืนให้อัตโนมัติถ้าไม่ผ่าน)
const HIT_MS = 4200;
const FEEDBACK_MS = 3000;

export function SabotageToast() {
  const notice = useGame((s) => s.sabotageNotice);
  const feedback = useGame((s) => s.sabotageFeedback);
  const clearNotice = useGame((s) => s.clearSabotageNotice);
  const clearFeedback = useGame((s) => s.clearSabotageFeedback);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(clearNotice, HIT_MS);
    return () => window.clearTimeout(t);
  }, [notice?.id, clearNotice, notice]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(clearFeedback, FEEDBACK_MS);
    return () => window.clearTimeout(t);
  }, [feedback?.id, clearFeedback, feedback]);

  if (!notice && !feedback) return null;

  return (
    <div style={wrap}>
      {/* 👻 ผีหลอก — การ์ดที่ไม่มีผลกับเกมเลย มีไว้ให้เด็กแกล้งกันแบบไม่เจ็บ
          (ราคาถูกสุด และเป็นตัวที่ทำให้กลไกนี้รู้สึก "เล่นกัน" ไม่ใช่ "ทำร้ายกัน") */}
      {notice?.kind === 'ghost' && (
        <div key={`g${notice.id}`} style={ghostLayer} className="sab-ghost">
          👻
        </div>
      )}
      {notice && (
        // key = id → บังคับ remount ให้อนิเมชันเล่นใหม่ทุกใบ แม้โดนการ์ดชนิดเดิมติดกัน
        <div key={notice.id} style={hitCard} className="sabotage-pop">
          <span style={{ fontSize: 30 }}>{EFFECTS[notice.kind].icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900 }}>
              {notice.from} ส่ง{EFFECTS[notice.kind].label}มา!
            </div>
            <div style={{ fontSize: 13.5, opacity: 0.95 }}>{EFFECTS[notice.kind].detail}</div>
          </div>
        </div>
      )}
      {feedback && (
        <div key={feedback.id} style={feedbackCard(feedback.ok)} className="sabotage-pop">
          {feedback.ok ? '✅' : '⚠️'} {feedback.message}
        </div>
      )}
      <style>{`
        @keyframes sabGhost { 0% { left: -18vw; transform: rotate(-8deg) } 100% { left: 108vw; transform: rotate(8deg) } }
        .sab-ghost { animation: sabGhost 2.4s cubic-bezier(.4,0,.6,1) both }
        @keyframes sabotagePop { from { opacity: 0; transform: translateY(-14px) scale(.94) } to { opacity: 1; transform: none } }
        .sabotage-pop { animation: sabotagePop .28s cubic-bezier(.2,1.1,.4,1) both; }
        @media (prefers-reduced-motion: reduce) { .sabotage-pop, .sab-ghost { animation: none } }
      `}</style>
    </div>
  );
}

const wrap: CSSProperties = {
  position: 'fixed',
  top: 14,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 140, // เหนือกระดานและการ์ด แต่ต่ำกว่าจอ AR/ลากคำตอบเต็มจอ (z=300)
  display: 'grid',
  gap: 8,
  justifyItems: 'center',
  pointerEvents: 'none', // เป็นป้ายบอกสถานะ ไม่ใช่ปุ่ม — ห้ามบังการแตะ
  maxWidth: 'min(460px, 92vw)',
};

const ghostLayer: CSSProperties = {
  position: 'fixed',
  top: '38vh',
  left: '-18vw',
  fontSize: 'clamp(90px, 22vw, 190px)',
  opacity: 0.9,
  filter: 'drop-shadow(0 10px 28px rgba(0,0,0,.4))',
  pointerEvents: 'none',
  zIndex: 139,
};

const hitCard: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 18px',
  borderRadius: radius.lg,
  background: 'linear-gradient(160deg, #B02020, #7E0F0F)',
  color: '#FFF3E0',
  boxShadow: '0 12px 30px rgba(0,0,0,.4)',
  border: '2px solid rgba(255,220,180,.5)',
};

function feedbackCard(ok: boolean): CSSProperties {
  return {
    fontSize: 14.5,
    fontWeight: 800,
    padding: '9px 16px',
    borderRadius: radius.pill,
    background: ok ? 'rgba(46,125,50,.95)' : 'rgba(107,78,30,.95)',
    color: '#fff',
    boxShadow: '0 8px 20px rgba(0,0,0,.3)',
    textAlign: 'center',
  };
}
