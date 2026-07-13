import { useCallback, useEffect, useRef, useState } from 'react';
import type { King, QuizCard } from '@/core/types';
import { useGame, HINT_PRICE } from '@/core/store';
import { resolveApiAssetUrl } from '@/core/api';
import { getKingCoinImage } from '@/core/kingAssets';
import { useHandTracking, type HandStatus, type HandFrame } from '@/core/useHandTracking';
import { color, radius, elevation, difficultyMeta } from '@/theme/tokens';
import { ARCardStage } from './ARCardStage';

// ── ช่องทอง = บทเรียน AR ── ส่องกล้อง → คลิปวิดีโอ 15 วิ (placeholder) →
// ลากคำตอบที่ถูกไปวางในช่อง (drag-to-slot) ในหน้ากล้อง AR → ถูก = ได้เหรียญกษัตริย์
const VIDEO_SECONDS = 15;
const SLOT_MARGIN = 48; // px ขยายพื้นที่รับรอบช่องวาง ให้เล็งด้วยนิ้วง่ายขึ้น

export function ARGoldChallenge({
  king,
  quiz,
  onDone,
  useCamera = true,
  cardMode = false,
}: {
  king: King;
  quiz: QuizCard;
  onDone: (correct: boolean) => void;
  useCamera?: boolean; // ปิดได้ในโหมดครู — เล่นบทเรียนบนพื้นหลังเข้มแทน (ยังชนะได้)
  cardMode?: boolean; // โหมดส่องการ์ดจริง (MindAR) — เปิดเมื่อมี gold-card.mind + ทดสอบแล้ว
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [stage, setStage] = useState<'video' | 'question' | 'done' | 'fail'>('video');
  const [secondsLeft, setSecondsLeft] = useState(VIDEO_SECONDS);
  // arPhase 'card' = โหมดส่องการ์ดจริง (MindAR, กล้องหลัง) · 'done' = เข้าสู่โหมดปกติ (กล้องหน้า)
  const [arPhase, setArPhase] = useState<'card' | 'done'>(useCamera && cardMode ? 'card' : 'done');
  const lessonUrl = resolveApiAssetUrl(quiz.videoUrl || king.arVideo || '');

  // เปิดกล้องหน้าแบบ best-effort (โหมดปกติ/หลัง fallback) — ข้ามตอน arPhase 'card' (MindAR ใช้กล้องหลังอยู่)
  useEffect(() => {
    if (!useCamera || arPhase === 'card') return;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' } }, // กล้องหน้า — ให้ยกมือลากคำตอบผ่านกล้อง
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCamReady(true);
      } catch {
        /* ไม่มีสิทธิ์กล้อง — ใช้พื้นหลังเข้ม */
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [useCamera, arPhase]);

  // นับถอยหลังคลิปวิดีโอ 15 วิ แล้วเข้าสู่คำถาม
  useEffect(() => {
    if (stage !== 'video') return;
    if (secondsLeft <= 0) {
      setStage('question');
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, secondsLeft]);

  const stopCam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const bail = () => {
    stopCam();
    onDone(false); // ออกก่อนตอบ = ไม่ได้เหรียญ (ลองใหม่รอบหน้า)
  };

  const claim = () => {
    stopCam();
    onDone(true);
  };

  const shortName = king.name.split('(')[0].trim();

  // ── โหมดส่องการ์ดจริง (image-target AR) — วิดีโอบทเรียนเล่นทับการ์ดทอง ──
  // ดูจบ → เข้าคำถาม (โหมดกล้องหน้าเดิม) · AR ไม่ไหว/ไม่มีวิดีโอ → fallback วิดีโอปกติ
  if (arPhase === 'card') {
    return (
      <ARCardStage
        lessonUrl={lessonUrl}
        kingName={shortName}
        onProceed={() => {
          setArPhase('done');
          setStage('question');
        }}
        onFallback={() => setArPhase('done')}
        onExit={bail}
      />
    );
  }

  return (
    <div style={shell}>
      <video ref={videoRef} playsInline muted style={videoStyle(camReady)} />
      <div style={shade} />

      <button onClick={bail} style={backBtn}>
        ← ออก (ยังไม่รับเหรียญ)
      </button>

      <div style={badge}>🪙 ช่องทอง · เหรียญกษัตริย์</div>

      {stage === 'video' && (
        <VideoStage
          king={king}
          quiz={quiz}
          shortName={shortName}
          secondsLeft={secondsLeft}
          onSkip={() => setStage('question')}
        />
      )}

      {stage === 'question' && (
        <DragQuestion
          quiz={quiz}
          onCorrect={() => setStage('done')}
          onWrong={() => setStage('fail')}
          videoRef={videoRef}
          handEnabled={useCamera && camReady}
        />
      )}

      {stage === 'done' && (
        <div style={centerCard}>
          <img
            src={getKingCoinImage(king.id)}
            alt=""
            draggable={false}
            style={{
              width: 128,
              height: 128,
              objectFit: 'contain',
              margin: '0 auto 4px',
              display: 'block',
              filter: 'drop-shadow(0 0 16px rgba(255,193,7,.9))',
              animation: 'coinPopSpin 1.4s ease-out',
            }}
          />
          <h2 style={{ margin: '6px 0', fontSize: 28, color: color.primary }}>
            ได้เหรียญ {shortName}!
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 18, color: color.textMuted }}>
            เก่งมาก! เรียนรู้ผ่าน AR สำเร็จ
          </p>
          <button onClick={claim} style={primaryBtn}>
            รับเหรียญกษัตริย์ →
          </button>
          <style>{`@keyframes coinPopSpin{0%{transform:scale(.3) rotateY(0);opacity:0}45%{opacity:1}100%{transform:scale(1) rotateY(540deg);opacity:1}}`}</style>
        </div>
      )}

      {stage === 'fail' && (
        <div style={centerCard}>
          <div style={{ fontSize: 68, lineHeight: 1, margin: '2px 0 4px' }}>💔</div>
          <h2 style={{ margin: '6px 0', fontSize: 26, color: color.danger }}>
            ตอบผิด · เสีย ❤️ 1 ดวง
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 18, color: color.textMuted }}>
            ยังไม่ได้เหรียญ {shortName} — ลองใหม่รอบหน้านะ
          </p>
          <button onClick={bail} style={primaryBtn}>
            รับผล →
          </button>
        </div>
      )}
    </div>
  );
}

// ── สเตจวิดีโอ 15 วิ (placeholder — ยังไม่มีไฟล์จริง) ──
function VideoStage({
  king,
  quiz,
  shortName,
  secondsLeft,
  onSkip,
}: {
  king: King;
  quiz: QuizCard;
  shortName: string;
  secondsLeft: number;
  onSkip: () => void;
}) {
  const pct = ((VIDEO_SECONDS - secondsLeft) / VIDEO_SECONDS) * 100;
  const lessonVideo = resolveApiAssetUrl(quiz.videoUrl || king.arVideo || '');
  return (
    <div style={centerCard}>
      <div style={{ fontSize: 15, fontWeight: 800, color: color.info }}>🎬 คลิปวิดีโอ 15 วินาที</div>
      {lessonVideo ? (
        <div style={lessonVideoFrame}>
          <video
            src={lessonVideo}
            controls
            autoPlay
            muted
            playsInline
            style={{ width: '100%', maxHeight: 300, display: 'block', background: '#000' }}
          />
        </div>
      ) : (
        <div style={videoBox(king.themeColor)}>
          <div style={medal(king.themeColor)}>{king.order}</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 10 }}>{shortName}</div>
          <div style={{ fontSize: 16, opacity: 0.85 }}>
            {king.era} · {king.reignPeriod}
          </div>
          <ul style={{ textAlign: 'left', fontSize: 16, lineHeight: 1.6, margin: '10px 0 0', paddingLeft: 20 }}>
            {king.achievements.slice(0, 2).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.6 }}>
            ยังไม่มีวิดีโอสำหรับการ์ดนี้
          </div>
        </div>
      )}
      <div style={{ height: 8, background: '#00000018', borderRadius: 99, marginTop: 12, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color.secondary, transition: 'width 1s linear' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: color.textMuted }}>เหลือ {secondsLeft} วิ</span>
        <button onClick={onSkip} style={skipBtn}>
          ข้ามวิดีโอ →
        </button>
      </div>
    </div>
  );
}

// ── คำถามแบบลากคำตอบไปวางในช่อง (drag-to-slot) ──
// ลากได้ 2 ทาง: (1) ยกมือ+จีบนิ้วผ่านกล้องหน้า (hand tracking) (2) แตะลากบนจอ (fallback)
function DragQuestion({
  quiz,
  onCorrect,
  onWrong,
  videoRef,
  handEnabled,
}: {
  quiz: QuizCard;
  onCorrect: () => void;
  onWrong: () => void; // วางคำตอบผิด = ตอบผิด → เสียหัวใจ (จัดการโดย ARGoldChallenge/onDone(false))
  videoRef: React.RefObject<HTMLVideoElement | null>;
  handEnabled: boolean;
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
  const [wrong, setWrong] = useState(false); // วางคำตอบผิดแล้ว (โชว์ ❌ สั่นสั้น ๆ ก่อนเสียหัวใจ)
  const settledRef = useRef(false); // กันตัดสินซ้ำ (ถูก/ผิด เกิดครั้งเดียว แม้ frame มือ/pointer ยิงซ้อน)
  const [hidden, setHidden] = useState<number[]>([]); // คำตอบผิดที่ถูกคำใบ้ตัดออก
  const [cursorPresent, setCursorPresent] = useState(false); // เจอมือในเฟรมไหม (ใช้ mount จุดนิ้ว)
  const [handStatus, setHandStatus] = useState<HandStatus>('loading');

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
  const coins = useGame((s) => s.players[s.currentPlayerIndex]?.coins ?? 0);
  const buyHint = useGame((s) => s.buyHint);

  // ซื้อคำใบ้ด้วยเหรียญ → ตัดคำตอบผิดออก 2 ข้อ (ใช้ได้ครั้งเดียว/คำถาม)
  const useHint = () => {
    if (hidden.length > 0 || coins < HINT_PRICE) return;
    if (!buyHint()) return;
    const wrong = quiz.choices.map((c, i) => (!c.correct ? i : -1)).filter((i) => i >= 0);
    setHidden(wrong.sort(() => Math.random() - 0.5).slice(0, 2));
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
    if (quiz.choices[idx]?.correct) {
      settledRef.current = true;
      onCorrect();
    } else {
      // ตอบผิด (ไม่มีลองใหม่ฟรีแล้ว) → โชว์ ❌ สั้น ๆ แล้วเสียหัวใจ 1 ดวง
      settledRef.current = true;
      setWrong(true);
      setActiveIndex(null);
      setTimeout(onWrong, 700);
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
    [activeIndex, hidden],
  );

  useHandTracking({ videoRef, enabled: handEnabled, onFrame: handleFrame, onStatus: setHandStatus });

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
  }, [activeIndex]);

  return (
    <div style={{ ...centerCard, maxWidth: 'min(640px, 94vw)' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#B8860B' }}>
        {handEnabled ? '🖐️ ยกมือหน้ากล้อง แล้วจีบนิ้วเพื่อจับ–วางคำตอบ' : '🖐️ ลากคำตอบที่ถูกไปวางในช่อง'}
      </div>
      {handEnabled && (
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: handStatus === 'ready' ? color.success : handStatus === 'error' ? color.danger : color.textMuted }}>
          {handStatus === 'loading' && '⏳ กำลังเปิดระบบตรวจจับมือ…'}
          {handStatus === 'ready' && (cursorPresent ? '✋ เจอมือแล้ว — จีบนิ้วเพื่อจับคำตอบ' : '👋 ยกมือขึ้นให้กล้องเห็น')}
          {handStatus === 'error' && '⚠️ ตรวจจับมือไม่ได้ — ใช้นิ้วแตะลากบนจอแทนได้'}
        </div>
      )}
      {/* ป้ายระดับความยาก — สีเดียวกับ CardModal ให้รู้ว่าคำถามทองระดับไหน */}
      <div style={{ marginTop: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 14,
            fontWeight: 800,
            color: difficultyMeta[quiz.difficulty].color,
            background: difficultyMeta[quiz.difficulty].bg,
            border: `1.5px solid ${difficultyMeta[quiz.difficulty].border}`,
            borderRadius: radius.pill,
            padding: '4px 11px',
          }}
        >
          {difficultyMeta[quiz.difficulty].icon} ระดับ{difficultyMeta[quiz.difficulty].label}
        </span>
      </div>
      <p style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 14px' }}>{quiz.question}</p>

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
        {wrong ? '❌ ตอบผิด! เสีย ❤️' : overSlot ? '✅ ปล่อยนิ้วเพื่อวางที่นี่' : 'วางคำตอบที่นี่'}
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
                if (isHidden) return;
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

      {/* คำใบ้ด้วยเหรียญ — ตัดคำตอบผิด 2 ข้อ (ใช้ได้ครั้งเดียว) */}
      {hidden.length === 0 && (
        <button
          onClick={useHint}
          disabled={coins < HINT_PRICE}
          style={{
            fontFamily: 'inherit',
            marginTop: 12,
            width: '100%',
            fontSize: 16,
            fontWeight: 800,
            color: coins < HINT_PRICE ? '#999' : '#6B4E1E',
            background: coins < HINT_PRICE ? '#eee' : 'linear-gradient(160deg,#FFE9A8,#E9B93C)',
            border: `1.5px solid ${coins < HINT_PRICE ? '#ccc' : '#C9A227'}`,
            borderRadius: radius.pill,
            padding: '10px 0',
            minHeight: 46,
            cursor: coins < HINT_PRICE ? 'not-allowed' : 'pointer',
          }}
        >
          💡 ใช้คำใบ้ · จ่าย 🪙 {HINT_PRICE} (มี 🪙 {coins})
        </button>
      )}

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

// ── styles ──
const shell: React.CSSProperties = {
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

function videoStyle(ready: boolean): React.CSSProperties {
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

const shade: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(180deg, rgba(0,0,0,.5), rgba(0,0,0,.2) 40%, rgba(0,0,0,.65))',
  pointerEvents: 'none',
};

const backBtn: React.CSSProperties = {
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

const badge: React.CSSProperties = {
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

const centerCard: React.CSSProperties = {
  position: 'relative',
  zIndex: 5,
  width: 'min(520px, 94vw)',
  maxHeight: '86vh',
  overflowY: 'auto',
  background: 'rgba(255,253,248,.96)',
  color: color.text,
  borderRadius: radius.lg,
  boxShadow: elevation.modal,
  padding: 22,
  textAlign: 'center',
};

function videoBox(themeColor: string): React.CSSProperties {
  return {
    marginTop: 10,
    borderRadius: radius.lg,
    border: `2px solid ${themeColor}55`,
    background: `linear-gradient(160deg, #fff, ${themeColor}14)`,
    padding: 18,
  };
}

const lessonVideoFrame: React.CSSProperties = {
  marginTop: 10,
  borderRadius: radius.lg,
  overflow: 'hidden',
  border: '2px solid rgba(201,162,39,.55)',
  background: '#000',
};

function medal(themeColor: string): React.CSSProperties {
  return {
    width: 60,
    height: 60,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto',
    background: `radial-gradient(circle at 32% 28%, #ffffffaa, ${themeColor})`,
    color: '#fff',
    fontSize: 24,
    fontWeight: 900,
    border: '3px solid #fff',
  };
}

const skipBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 800,
  color: color.info,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  width: '100%',
  fontSize: 20,
  fontWeight: 800,
  color: '#fff',
  background: color.primary,
  border: 'none',
  borderRadius: radius.pill,
  padding: 16,
  minHeight: 56,
  cursor: 'pointer',
};
