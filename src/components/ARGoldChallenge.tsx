import { useEffect, useRef, useState } from 'react';
import type { King, QuizCard } from '@/core/types';
import { resolveApiAssetUrl } from '@/core/api';
import { lessonVideoFor } from '@/core/videoPool';
import { getKingCoinImage } from '@/core/kingAssets';
import { color, radius, elevation } from '@/theme/tokens';
import { ARCardStage } from './ARCardStage';
import { DragAnswer, useFrontCamera } from './DragAnswer';

// ── ช่องทอง = บทเรียน AR ── ส่องกล้อง → คลิปวิดีโอ 15 วิ (placeholder) →
// ลากคำตอบที่ถูกไปวางในช่อง (drag-to-slot) ในหน้ากล้อง AR → ถูก = ได้เหรียญกษัตริย์
//
// ⚠️ ไฟล์นี้ต้อง "ไม่ import store" — มันถูกใช้บนมือถือ (ar.html) ที่ไม่มีผู้เล่นในเครื่อง
// เดิมอ่าน coins/buyHint จาก useGame ตรง ๆ ทำให้ปุ่มคำใบ้บนมือถือขึ้นว่า "มี 🪙 0" กดไม่ได้ตลอด
// ตอนนี้คำใบ้เข้ามาทาง prop `hint` — แท็บเล็ตส่งมา, มือถือไม่ส่ง (ปุ่มไม่ขึ้นเลย)
const VIDEO_SECONDS = 15;

export interface HintOption {
  coins: number; // เหรียญคงเหลือของผู้เล่นปัจจุบัน
  price: number;
  onBuy: () => boolean; // หักเหรียญจริง — คืน false ถ้าเหรียญไม่พอ
}

export function ARGoldChallenge({
  king,
  quiz,
  onDone,
  onCancel,
  useCamera = true,
  cardMode = true,
  startAtQuestion = false,
  hint,
}: {
  king: King;
  quiz: QuizCard;
  onDone: (correct: boolean) => void;
  onCancel: () => void; // ออก/ยกเลิกก่อนตอบ — ไม่ได้เหรียญ + ไม่เสียหัวใจ (แค่จบเทิร์น)
  useCamera?: boolean; // ปิดได้ในโหมดครู — เล่นบทเรียนบนพื้นหลังเข้มแทน (ยังชนะได้)
  cardMode?: boolean; // โหมดส่องการ์ดจริง (MindAR) — เปิดเมื่อมี gold-card.mind + ทดสอบแล้ว
  startAtQuestion?: boolean; // ใช้เมื่อ mobile QR stage เล่นวิดีโอจบแล้ว
  hint?: HintOption; // ซื้อคำใบ้ด้วยเหรียญ — มีเฉพาะฝั่งที่ถือ store จริง (แท็บเล็ต)
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stage, setStage] = useState<'video' | 'question' | 'done' | 'fail'>(startAtQuestion ? 'question' : 'video');
  const [secondsLeft, setSecondsLeft] = useState(VIDEO_SECONDS);
  // arPhase 'card' = โหมดส่องการ์ดจริง (MindAR, กล้องหลัง) · 'done' = เข้าสู่โหมดปกติ (กล้องหน้า)
  const [arPhase, setArPhase] = useState<'card' | 'done'>(useCamera && cardMode && !startAtQuestion ? 'card' : 'done');
  const lessonUrl = resolveApiAssetUrl(lessonVideoFor(quiz.id, quiz.videoUrl, king.arVideo));

  // เปิดกล้องหน้าแบบ best-effort — ข้ามตอน arPhase 'card' (MindAR ใช้กล้องหลัง)
  // และข้ามหน้าจอผล (done/fail) เพราะไม่ต้องใช้กล้อง (กันเปิดกล้องหน้าเปล่า ๆ หลังตอบใน AR)
  // hook คืนกล้องเองทั้งตอน enabled=false และตอน unmount → ไม่ต้องมี stopCam() แล้ว
  const camReady = useFrontCamera(videoRef, useCamera && arPhase !== 'card' && stage !== 'done' && stage !== 'fail');

  // นับถอยหลังคลิปวิดีโอ 15 วิ แล้วเข้าสู่คำถาม
  useEffect(() => {
    if (stage !== 'video' || lessonUrl) return;
    if (secondsLeft <= 0) {
      setStage('question');
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lessonUrl, stage, secondsLeft]);

  // ออก/ยกเลิกก่อนตอบ = ไม่ได้เหรียญ + ไม่เสียหัวใจ (จบเทิร์นผ่าน onCancel → closeEvent)
  // ตรงกับป้ายปุ่ม "ยังไม่รับเหรียญ" — การถอนตัวคือเสียโอกาสได้เหรียญ ไม่ใช่ถูกลงโทษ
  // (กล้องถูกคืนโดย cleanup ของ useFrontCamera ตอน component ถูก unmount)
  const cancel = onCancel;

  // ตอบผิด (จอ fail) = เสียหัวใจ 1 ดวง
  const loseHeartAndClose = () => onDone(false);
  const claim = () => onDone(true);

  const shortName = king.name.split('(')[0].trim();

  // ── คำใบ้ด้วยเหรียญ: ตัดคำตอบผิดออก 2 ข้อ (ครั้งเดียว/คำถาม) ──
  // state อยู่ที่นี่ ส่วน DragAnswer รับ `hidden` แบบ controlled — คนละฝั่งชัดเจน
  const [hidden, setHidden] = useState<number[]>([]);
  const useHint = () => {
    if (!hint || hidden.length > 0 || hint.coins < hint.price) return;
    if (!hint.onBuy()) return;
    const wrongIdx = quiz.choices.map((c, i) => (!c.correct ? i : -1)).filter((i) => i >= 0);
    setHidden(wrongIdx.sort(() => Math.random() - 0.5).slice(0, 2));
  };
  const hintButton =
    hint && hidden.length === 0 ? (
      <button
        onClick={useHint}
        disabled={hint.coins < hint.price}
        style={{
          fontFamily: 'inherit',
          marginTop: 12,
          width: '100%',
          fontSize: 16,
          fontWeight: 800,
          color: hint.coins < hint.price ? '#999' : '#6B4E1E',
          background: hint.coins < hint.price ? '#eee' : 'linear-gradient(160deg,#FFE9A8,#E9B93C)',
          border: `1.5px solid ${hint.coins < hint.price ? '#ccc' : '#C9A227'}`,
          borderRadius: radius.pill,
          padding: '10px 0',
          minHeight: 46,
          cursor: hint.coins < hint.price ? 'not-allowed' : 'pointer',
        }}
      >
        💡 ใช้คำใบ้ · จ่าย 🪙 {hint.price} (มี 🪙 {hint.coins})
      </button>
    ) : null;

  // ── โหมดส่องการ์ดจริง (image-target AR) — วิดีโอบทเรียนเล่นทับการ์ดทอง ──
  // ดูจบ → เข้าคำถาม (โหมดกล้องหน้าเดิม) · AR ไม่ไหว → fallback วิดีโอปกติ
  if (arPhase === 'card') {
    return (
      <ARCardStage
        lessonUrl={lessonUrl}
        kingName={shortName}
        renderQuestion={(arVideoRef, handEnabled) => (
          <DragAnswer
            quiz={quiz}
            hidden={hidden}
            footer={hintButton}
            onCorrect={() => {
              setArPhase('done');
              setStage('done');
            }}
            onWrong={() => {
              setArPhase('done');
              setStage('fail');
            }}
            videoRef={arVideoRef}
            handEnabled={useCamera && handEnabled}
            mirror={false}
          />
        )}
        onProceed={() => {
          setArPhase('done');
          setStage('question');
        }}
        onFallback={() => setArPhase('done')}
        onExit={cancel}
      />
    );
  }

  return (
    <div style={shell}>
      <video ref={videoRef} playsInline muted style={videoStyle(camReady)} />
      <div style={shade} />

      <button onClick={cancel} style={backBtn}>
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
          onEnded={() => setStage('question')}
        />
      )}

      {stage === 'question' && (
        <DragAnswer
          quiz={quiz}
          hidden={hidden}
          footer={hintButton}
          onCorrect={() => setStage('done')}
          onWrong={() => setStage('fail')}
          videoRef={videoRef}
          handEnabled={useCamera && camReady}
          mirror
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
          <button onClick={loseHeartAndClose} style={primaryBtn}>
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
  onEnded,
}: {
  king: King;
  quiz: QuizCard;
  shortName: string;
  secondsLeft: number;
  onSkip: () => void;
  onEnded: () => void;
}) {
  const pct = ((VIDEO_SECONDS - secondsLeft) / VIDEO_SECONDS) * 100;
  const lessonVideo = resolveApiAssetUrl(lessonVideoFor(quiz.id, quiz.videoUrl, king.arVideo));
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
            onEnded={onEnded}
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
      {!lessonVideo && (
        <div style={{ height: 8, background: '#00000018', borderRadius: 99, marginTop: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color.secondary, transition: 'width 1s linear' }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: color.textMuted }}>
          {lessonVideo ? 'วิดีโอจบแล้วเข้าสู่คำถาม' : `เหลือ ${secondsLeft} วิ`}
        </span>
        <button onClick={onSkip} style={skipBtn}>
          ข้ามวิดีโอ →
        </button>
      </div>
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
