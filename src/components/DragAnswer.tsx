import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { QuizCard } from '@/core/types';
import { useHandTracking, type HandStatus, type HandFrame } from '@/core/useHandTracking';
import { color, radius, elevation, difficultyMeta } from '@/theme/tokens';
import { QuestionImage } from './QuestionImage';

// ── คำถามแบบ "ลากคำตอบไปวางในช่อง" (drag-to-slot) ──
// เดิมฝังอยู่ใน ARGoldChallenge (ชื่อ DragQuestion) และเรียก useGame ตรง ๆ เพื่อทำปุ่มคำใบ้
// → ใช้ซ้ำบนมือถือ (answer.html) ไม่ได้เลย เพราะจะลาก store ทั้งก้อนขึ้นเครื่องที่ไม่มีผู้เล่น
// (ผลคือปุ่มคำใบ้โชว์ "มี 🪙 0" กดไม่ได้ตลอดกาล — บั๊กจริงบนเส้นทางการ์ดทองผ่าน QR)
//
// ตอนนี้เป็นคอมโพเนนต์ล้วน ๆ: รับ quiz + hidden (controlled) + slot ปุ่มเสริม (header/footer)
// ใครเรียกใช้เป็นคนถือ logic ไอเทม/คำใบ้เอง — แท็บเล็ตใช้ store, มือถือใช้ payload+รายงานกลับ
//
// ลากได้ 2 ทาง: (1) ยกมือ+จีบนิ้วผ่านกล้องหน้า (hand tracking) (2) แตะลากบนจอ (fallback)
const SLOT_MARGIN = 48; // px ขยายพื้นที่รับรอบช่องวาง ให้เล็งด้วยนิ้วง่ายขึ้น

// เปิดกล้องหน้าแบบ best-effort — ใช้ทั้งใน DragAnswerStage และ ARGoldChallenge
// ปิด/คืนกล้องอัตโนมัติเมื่อ enabled = false หรือ unmount (ไม่งั้นไฟกล้องค้าง + กินแบต)
export function useFrontCamera(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [camReady, setCamReady] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setCamReady(false);
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' } }, // กล้องหน้า — ให้ยกมือลากคำตอบผ่านกล้อง
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          stream = null;
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCamReady(true);
      } catch {
        /* ไม่มีสิทธิ์กล้อง — ใช้พื้นหลังเข้ม + แตะลากบนจอแทน */
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };
  }, [enabled, videoRef]);
  return camReady;
}

export function DragAnswer({
  quiz,
  hidden = [],
  onCorrect,
  onWrong,
  videoRef,
  handEnabled,
  mirror = true,
  header,
  footer,
}: {
  quiz: QuizCard;
  hidden?: number[]; // ตัวเลือกที่ถูกตัดออก (คำใบ้/50:50) — controlled จากข้างนอกเสมอ
  onCorrect: (index: number) => void;
  onWrong: (index: number) => void; // วางคำตอบผิด — ผู้เรียกเป็นคนตัดสินบทลงโทษ (เสียหัวใจ ฯลฯ)
  videoRef: RefObject<HTMLVideoElement | null>;
  handEnabled: boolean;
  mirror?: boolean;
  header?: ReactNode; // แถบบริบท/ตัวจับเวลาของผู้เรียก
  footer?: ReactNode; // ปุ่มไอเทม/คำใบ้ของผู้เรียก
}) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const choiceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pinchPrevRef = useRef(false);
  const lastOverSlotRef = useRef(0); // เวลาล่าสุดที่นิ้ว (ตอนจีบ) ลอยเหนือช่องวาง
  // ตำแหน่งนิ้ว/ชิปอัปเดตผ่าน ref + เขียน DOM ตรง ๆ ทุกเฟรม (ไม่ setState ต่อเฟรม = ไม่ re-render ทั้งการ์ด)
  const posRef = useRef({ x: 0, y: 0 });
  const cursorDotRef = useRef<HTMLDivElement | null>(null);
  const chipRef = useRef<HTMLDivElement | null>(null);
  const presentRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [overSlot, setOverSlot] = useState(false); // นิ้วที่ถือคำตอบลอยเหนือช่องอยู่ไหม (ไฮไลต์)
  const [wrong, setWrong] = useState(false); // วางคำตอบผิดแล้ว (โชว์ ❌ สั่นสั้น ๆ ก่อนแจ้งผล)
  const settledRef = useRef(false); // กันตัดสินซ้ำ (ถูก/ผิด เกิดครั้งเดียว แม้ frame มือ/pointer ยิงซ้อน)
  const wrongTimerRef = useRef<number | null>(null);
  const [cursorPresent, setCursorPresent] = useState(false); // เจอมือในเฟรมไหม (ใช้ mount จุดนิ้ว)
  const [handStatus, setHandStatus] = useState<HandStatus>('loading');
  const diff = difficultyMeta[quiz.difficulty] ?? difficultyMeta.medium;

  useEffect(
    () => () => {
      if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current);
    },
    []
  );

  // เขียนตำแหน่งจุดนิ้ว + ชิปที่ลากลง DOM โดยตรง (เลี่ยง re-render ต่อเฟรม)
  const applyLivePos = (x: number, y: number) => {
    posRef.current = { x, y };
    if (cursorDotRef.current) {
      cursorDotRef.current.style.left = `${x}px`;
      cursorDotRef.current.style.top = `${y}px`;
    }
    if (chipRef.current) {
      chipRef.current.style.left = `${x}px`;
      chipRef.current.style.top = `${y}px`;
    }
  };

  // หาช่องคำตอบที่อยู่ใต้พิกัด (x,y) — ใช้ตอน "จับ" ด้วยนิ้ว
  const hitTestChoice = (x: number, y: number): number | null => {
    for (let i = 0; i < choiceRefs.current.length; i++) {
      const el = choiceRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  };

  // ช่องวางอยู่ใต้พิกัด (x,y) ไหม — ขยายขอบรับ (margin) ให้เล็งง่ายขึ้น
  const isOverSlot = (x: number, y: number): boolean => {
    const r = slotRef.current?.getBoundingClientRect();
    if (!r) return false;
    const m = SLOT_MARGIN;
    return x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
  };

  // ตัดสินถูก/ผิด (เรียกเมื่อยืนยันว่าวางลงช่องแล้ว) — ตัดสินได้ครั้งเดียว
  const commitDrop = (idx: number) => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (quiz.choices[idx]?.correct) {
      onCorrect(idx);
    } else {
      // ตอบผิด (ไม่มีลองใหม่ฟรี) → โชว์ ❌ สั้น ๆ ให้เห็นก่อนค่อยแจ้งผล
      setWrong(true);
      setActiveIndex(null);
      wrongTimerRef.current = window.setTimeout(() => onWrong(idx), 700);
    }
  };

  // hand tracking: ปลายนิ้ว = cursor, จีบนิ้ว = จับ/วาง (edge detection)
  const handleFrame = useCallback(
    (f: HandFrame) => {
      if (f.present !== presentRef.current) {
        presentRef.current = f.present;
        setCursorPresent(f.present); // เปลี่ยน state เฉพาะตอน "เจอ/หายมือ" ไม่ใช่ทุกเฟรม
      }
      if (!f.present) {
        pinchPrevRef.current = false;
        return;
      }
      applyLivePos(f.x, f.y); // ขยับจุดนิ้ว/ชิปผ่าน DOM โดยตรง
      const was = pinchPrevRef.current;
      pinchPrevRef.current = f.pinching;

      if (activeIndex !== null) {
        const over = isOverSlot(f.x, f.y);
        if (over) lastOverSlotRef.current = performance.now();
        setOverSlot((prev) => (prev !== over ? over : prev));
      }

      if (f.pinching && !was && activeIndex === null) {
        const idx = hitTestChoice(f.x, f.y);
        if (idx !== null && !hidden.includes(idx)) {
          posRef.current = { x: f.x, y: f.y }; // seed ตำแหน่ง mount ของชิป
          setActiveIndex(idx);
        }
      } else if (!f.pinching && was && activeIndex !== null) {
        const idx = activeIndex;
        setActiveIndex(null);
        setOverSlot(false);
        // ปล่อยแล้วนับว่าวางลงช่อง ถ้าอยู่เหนือช่อง หรือ "เพิ่งลอยเหนือช่อง" ภายใน 450ms
        // (กันจังหวะแบมือที่นิ้วขยับหลุดช่องเล็กน้อย — สาเหตุที่วางไม่ค่อยติด)
        if (isOverSlot(f.x, f.y) || performance.now() - lastOverSlotRef.current < 450) {
          commitDrop(idx);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeIndex, hidden]
  );

  useHandTracking({ videoRef, enabled: handEnabled, onFrame: handleFrame, onStatus: setHandStatus, mirror });

  // fallback: แตะลากบนจอ (pointer)
  useEffect(() => {
    if (activeIndex === null) return;
    const move = (e: PointerEvent) => applyLivePos(e.clientX, e.clientY);
    const up = (e: PointerEvent) => {
      const idx = activeIndex;
      setActiveIndex(null);
      if (isOverSlot(e.clientX, e.clientY)) commitDrop(idx);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  return (
    <div style={panel}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#B8860B' }}>
        {handEnabled ? '🖐️ ยกมือหน้ากล้อง แล้วจีบนิ้วเพื่อจับ–วางคำตอบ' : '🖐️ ลากคำตอบที่ถูกไปวางในช่อง'}
      </div>
      {handEnabled && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            marginTop: 4,
            color:
              handStatus === 'ready' ? color.success : handStatus === 'error' ? color.danger : color.textMuted,
          }}
        >
          {handStatus === 'loading' && '⏳ กำลังเปิดระบบตรวจจับมือ…'}
          {handStatus === 'ready' && (cursorPresent ? '✋ เจอมือแล้ว — จีบนิ้วเพื่อจับคำตอบ' : '👋 ยกมือขึ้นให้กล้องเห็น')}
          {handStatus === 'error' && '⚠️ ตรวจจับมือไม่ได้ — ใช้นิ้วแตะลากบนจอแทนได้'}
        </div>
      )}

      {header}

      {/* ป้ายระดับความยาก — สีเดียวกับ CardModal ให้รู้ว่าคำถามระดับไหน */}
      <div style={{ marginTop: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 14,
            fontWeight: 800,
            color: diff.color,
            background: diff.bg,
            border: `1.5px solid ${diff.border}`,
            borderRadius: radius.pill,
            padding: '4px 11px',
          }}
        >
          {diff.icon} ระดับ{diff.label}
        </span>
      </div>
      <p style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 14px' }}>{quiz.question}</p>
      <QuestionImage url={quiz.imageUrl} maxHeight={160} />

      {/* ช่องวางคำตอบ — ไฮไลต์เมื่อนิ้วที่ถือคำตอบลอยเหนือช่อง (พร้อมปล่อย) */}
      <div
        ref={slotRef}
        key={wrong ? 'wrong' : 'idle'}
        style={{
          minHeight: 88,
          borderRadius: radius.lg,
          border: `3px ${wrong ? 'solid' : overSlot ? 'solid' : 'dashed'} ${
            wrong ? color.danger : overSlot ? color.success : color.secondary
          }`,
          background: wrong ? '#FDE8E8' : overSlot ? '#E6F6E9' : '#FFF9E6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: wrong ? color.danger : overSlot ? color.success : color.textMuted,
          marginBottom: 16,
          transform: overSlot ? 'scale(1.03)' : 'scale(1)',
          boxShadow: overSlot ? `0 0 0 4px ${color.success}33` : 'none',
          transition: 'transform .12s, background .12s, box-shadow .12s',
          animation: wrong ? 'goldShake .4s ease' : undefined,
        }}
      >
        {wrong ? '❌ ตอบผิด!' : overSlot ? '✅ ปล่อยนิ้วเพื่อวางที่นี่' : 'วางคำตอบที่นี่'}
      </div>

      {/* คำตอบให้ลาก */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {quiz.choices.map((c, i) => {
          const isHidden = hidden.includes(i);
          return (
            <div
              key={i}
              ref={(el) => {
                choiceRefs.current[i] = el;
              }}
              onPointerDown={(e) => {
                if (isHidden || settledRef.current) return;
                posRef.current = { x: e.clientX, y: e.clientY };
                setActiveIndex(i);
              }}
              style={{
                touchAction: 'none',
                userSelect: 'none',
                cursor: isHidden ? 'default' : 'grab',
                fontSize: 18,
                fontWeight: 700,
                textAlign: 'center',
                padding: '14px 12px',
                minHeight: 56,
                borderRadius: radius.md,
                border: isHidden ? '2px dashed #bbb' : `2px solid ${color.secondary}`,
                background: isHidden ? '#f2f2f2' : activeIndex === i ? '#EEE' : '#fff',
                color: isHidden ? '#bbb' : color.text,
                opacity: isHidden ? 0.5 : activeIndex === i ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isHidden ? '✖' : c.text}
            </div>
          );
        })}
      </div>

      {footer}

      {/* ชิปที่กำลังลาก (ลอยตามนิ้ว) */}
      {activeIndex !== null && (
        <div
          ref={chipRef}
          style={{
            position: 'fixed',
            left: posRef.current.x,
            top: posRef.current.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 400,
            fontSize: 18,
            fontWeight: 800,
            padding: '14px 18px',
            borderRadius: radius.md,
            background: color.secondary,
            color: '#fff',
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          }}
        >
          {quiz.choices[activeIndex].text}
        </div>
      )}

      {/* จุดปลายนิ้ว (hand cursor) — โชว์ตำแหน่งมือที่ตรวจจับได้ */}
      {handEnabled && cursorPresent && (
        <div
          ref={cursorDotRef}
          style={{
            position: 'fixed',
            left: posRef.current.x,
            top: posRef.current.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 450,
            width: activeIndex !== null ? 26 : 34,
            height: activeIndex !== null ? 26 : 34,
            borderRadius: '50%',
            border: '3px solid #fff',
            background: activeIndex !== null ? color.secondary : 'rgba(201,162,39,.35)',
            boxShadow: '0 0 0 2px rgba(0,0,0,.35), 0 4px 14px rgba(0,0,0,.5)',
            transition: 'width .1s, height .1s, background .1s',
          }}
        />
      )}

      <style>{`@keyframes goldShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

// ── จอเต็มจอสำหรับตอบแบบลากคำตอบ (กล้องหน้าเป็นพื้นหลัง) ──
// ใช้กับการ์ดฟ้า/สาระทั้งบนแท็บเล็ต (CardModal) และบนมือถือ (answer.html)
// การ์ดทองมีเปลือกของตัวเองอยู่แล้ว (ARGoldChallenge) เพราะต้องมีจอ "ได้เหรียญ/เสียหัวใจ" ต่อท้าย
export function DragAnswerStage({
  quiz,
  hidden,
  onSettle,
  onExit,
  exitLabel = '← ตอบแบบปุ่มกดแทน',
  badge,
  useCamera = true,
  hand = true,
  header,
  footer,
}: {
  quiz: QuizCard;
  hidden?: number[];
  onSettle: (correct: boolean, index: number) => void;
  onExit?: () => void; // ทางออกฉุกเฉิน (กล้องเสีย/ตรวจมือไม่ได้) — ไม่ตัดสินถูก-ผิด
  exitLabel?: string;
  badge?: string;
  useCamera?: boolean; // ปิดกล้องได้ในโหมดครู → เล่นบนพื้นหลังเข้ม + แตะลากบนจอ
  hand?: boolean; // ใช้จีบนิ้ว (ต้องมีกล้อง) — ปิดแล้วเหลือแตะลากอย่างเดียว (ไม่โหลด MediaPipe)
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wantCamera = useCamera && hand;
  const camReady = useFrontCamera(videoRef, wantCamera);

  return (
    <div style={shell}>
      <video ref={videoRef} playsInline muted style={videoStyle(camReady)} />
      <div style={shade} />

      {onExit && (
        <button onClick={onExit} style={backBtn}>
          {exitLabel}
        </button>
      )}

      {badge && <div style={badgeStyle}>{badge}</div>}

      <DragAnswer
        quiz={quiz}
        hidden={hidden}
        videoRef={videoRef}
        handEnabled={wantCamera && camReady}
        onCorrect={(idx) => onSettle(true, idx)}
        onWrong={(idx) => onSettle(false, idx)}
        header={header}
        footer={footer}
      />
    </div>
  );
}

// ── styles ──
const panel: CSSProperties = {
  position: 'relative',
  zIndex: 5,
  width: 'min(640px, 94vw)',
  maxHeight: '86vh',
  overflowY: 'auto',
  background: 'rgba(255,253,248,.96)',
  color: color.text,
  borderRadius: radius.lg,
  boxShadow: elevation.modal,
  padding: 22,
  textAlign: 'center',
};

const shell: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 300,
  background: 'linear-gradient(160deg, #1a1206, #2a1e0a)',
  color: '#fff',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

function videoStyle(ready: boolean): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: ready ? 1 : 0,
    transform: 'scaleX(-1)', // mirror กล้องหน้า — ขยับมือขวาไปทางขวาบนจอ
  };
}

const shade: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(180deg, rgba(0,0,0,.5), rgba(0,0,0,.2) 40%, rgba(0,0,0,.65))',
  pointerEvents: 'none',
};

const backBtn: CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  zIndex: 10,
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 800,
  color: '#fff',
  background: 'rgba(0,0,0,.45)',
  border: '1px solid rgba(255,255,255,.28)',
  borderRadius: radius.pill,
  padding: '10px 16px',
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
};

const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  zIndex: 10,
  fontSize: 15,
  fontWeight: 800,
  color: '#fff',
  background: 'rgba(184,134,11,.9)',
  borderRadius: radius.pill,
  padding: '8px 14px',
};
