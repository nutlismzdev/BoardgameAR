import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AR } from '@/ar/arConfig';
import { createImageTracker, type ImageTracker } from '@/ar/imageTracker';
import { color, radius } from '@/theme/tokens';

// ── สเตจ "ส่องการ์ดจริง" (image-target AR) ──
// เปิดกล้องหลัง (MindAR) → เจอการ์ดทอง → เล่นวิดีโอบทเรียนทับบนการ์ด → เข้าคำถามบนกล้องหลังสตรีมเดียวกัน
// ถ้าไม่มีวิดีโอจะยังสแกนการ์ดและแสดง placeholder บน target เพื่อพิสูจน์ว่า AR ติดจริง
// โหลด MindAR ไม่ได้ / หา target ไม่เจอในเวลาที่กำหนด → onFallback() (ไปโหมดวิดีโอปกติ กล้องหน้า)
type Status = 'loading' | 'scanning' | 'playing' | 'question' | 'error';

export function ARCardStage({
  lessonUrl,
  kingName,
  renderQuestion,
  onProceed,
  onFallback,
  onExit,
}: {
  lessonUrl: string; // URL วิดีโอบทเรียน (ว่าง = ไม่มี → fallback)
  kingName: string;
  renderQuestion?: (videoRef: React.RefObject<HTMLVideoElement | null>, handEnabled: boolean) => ReactNode;
  onProceed: () => void; // fallback กรณีไม่มี renderer คำถาม
  onFallback: () => void; // AR ไม่ไหว → กลับโหมดปกติ
  onExit: () => void; // ออกจากบทเรียน (เท่ากับ bail เดิม)
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lessonVideoRef = useRef<HTMLVideoElement | null>(null);
  const mindVideoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<ImageTracker | null>(null);
  const startedRef = useRef(false); // กันเริ่มซ้ำ (StrictMode double-mount)
  const doneRef = useRef(false); // proceed/fallback ครั้งเดียว
  const playingRef = useRef(false); // เจอการ์ด+เล่นวิดีโอแล้ว (กัน scanTimeout เผลอ fallback ทั้งที่เล่นอยู่)
  const statusRef = useRef<Status>('loading');
  const [status, setStatus] = useState<Status>('loading');
  const [secondsLeft, setSecondsLeft] = useState<number>(AR.lessonSeconds);
  const [mindVideoReady, setMindVideoReady] = useState(false);
  const hasLessonVideo = Boolean(lessonUrl);

  const setStageStatus = (next: Status) => {
    statusRef.current = next;
    setStatus(next);
  };

  const finishOnce = (fn: () => void) => {
    if (doneRef.current) return;
    doneRef.current = true;
    fn();
  };

  const proceedToQuestion = () => {
    if (renderQuestion) {
      // การ์ดถูกจอคำถามบังแล้ว → หยุด render/tracking ของ MindAR ลดโหลด GPU (กล้องยังเล่นให้ MediaPipe)
      trackerRef.current?.pauseTracking();
      setStageStatus('question');
      return;
    }
    finishOnce(onProceed);
  };

  // เริ่ม MindAR
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    let scanTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const container = containerRef.current;
        const lessonVideo = lessonVideoRef.current;
        if (!container || (hasLessonVideo && !lessonVideo)) throw new Error('container/วิดีโอไม่พร้อม');

        const tracker = await createImageTracker(container);
        if (cancelled) {
          tracker.stop();
          return;
        }
        trackerRef.current = tracker;
        if (hasLessonVideo && lessonVideo) {
          tracker.setLessonVideo(lessonVideo);
        } else {
          tracker.setPlaceholderPanel(kingName);
        }

        tracker.onFound(() => {
          playingRef.current = true;
          setStageStatus('playing');
          lessonVideo?.play().catch(() => {});
        });
        tracker.onLost(() => {
          if (statusRef.current === 'question') return;
          setStageStatus('scanning');
          lessonVideo?.pause();
        });
        // ดูจบคลิป → เข้าคำถามบนสตรีมกล้องหลังเดียวกับ MindAR
        if (lessonVideo) lessonVideo.onended = proceedToQuestion;

        await tracker.start();
        if (cancelled) {
          tracker.stop();
          return;
        }
        mindVideoRef.current = tracker.getVideo();
        setMindVideoReady(Boolean(mindVideoRef.current));
        if (!mindVideoRef.current) {
          setTimeout(() => {
            if (cancelled || !trackerRef.current) return;
            mindVideoRef.current = trackerRef.current.getVideo();
            setMindVideoReady(Boolean(mindVideoRef.current));
          }, 250);
        }
        setStageStatus('scanning');
        // หา target ไม่เจอในเวลาที่กำหนด → fallback
        scanTimer = setTimeout(() => {
          if (!playingRef.current) finishOnce(onFallback);
        }, AR.scanTimeoutMs);
      } catch {
        finishOnce(onFallback); // โหลด/กล้องพัง → ไม่ทำให้ค้าง ไปโหมดปกติ
      }
    })();

    return () => {
      cancelled = true;
      if (scanTimer) clearTimeout(scanTimer);
      trackerRef.current?.stop();
      trackerRef.current = null;
      mindVideoRef.current = null;
      setMindVideoReady(false);
      startedRef.current = false; // ให้ init รอบใหม่ทำงานได้ (สำคัญกับ React.StrictMode dev ที่ mount ซ้ำ)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLessonVideo, kingName]);

  // ไม่มีวิดีโอจึงใช้เวลาสำรองกับ placeholder; วิดีโอจริงรอ event ended เพื่อไม่ตัดคลิปกลางทาง
  useEffect(() => {
    if (status !== 'playing' || hasLessonVideo) return;
    if (secondsLeft <= 0) {
      proceedToQuestion();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLessonVideo, status, secondsLeft]);

  return (
    <div style={shell}>
      {/* MindAR mount = กล้อง + canvas AR เต็มจอ */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {/* วิดีโอบทเรียน (ซ่อน) — ใช้เป็น texture ทับการ์ด ถ้ายังไม่มีวิดีโอจะใช้ placeholder plane แทน */}
      {hasLessonVideo && (
        // ซ่อนแบบ "ยังเรนเดอร์อยู่" (ไม่ใช่ display:none) — บางเบราว์เซอร์หยุด decode วิดีโอที่ display:none
        // ทำให้ VideoTexture ว่าง/ดำ · off-screen เล็ก ๆ + opacity 0 จะยัง decode เฟรมให้ texture
        <video
          ref={lessonVideoRef}
          src={lessonUrl}
          muted
          playsInline
          preload="auto"
          style={{ position: 'absolute', width: 2, height: 2, top: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
        />
      )}

      {/* overlay UI */}
      <button onClick={() => finishOnce(onExit)} style={backBtn}>
        ← ออก (ยังไม่รับเหรียญ)
      </button>
      <div style={badge}>🪙 ส่องการ์ดทอง · {kingName}</div>

      {/* กรอบเล็ง + คำแนะนำ ระหว่างยังไม่เจอการ์ด */}
      {status !== 'playing' && status !== 'question' && (
        <div style={centerHint}>
          <div style={reticle} />
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 16 }}>
            {status === 'loading' ? '⏳ กำลังเปิดกล้อง AR…' : '📸 เล็ง “การ์ดทอง” ให้เต็มกรอบ'}
          </div>
          <div style={{ fontSize: 14, opacity: 0.85, marginTop: 6 }}>
            หาที่แสงสว่าง · ถือให้นิ่ง · วางการ์ดบนพื้นเรียบ
          </div>
          <button onClick={() => finishOnce(onFallback)} style={skipBtn}>
            ข้ามไปดูวิดีโอปกติ →
          </button>
        </div>
      )}

      {/* แถบเวลาระหว่างเล่นวิดีโอบนการ์ด */}
      {status === 'playing' && (
        <div style={playingBar}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>
            {hasLessonVideo ? '🎬 กำลังเล่นวิดีโอบทเรียน' : `🃏 พบการ์ด AR · เหลือ ${secondsLeft} วิ`}
          </span>
          <button onClick={proceedToQuestion} style={skipBtn}>
            ข้ามไปตอบคำถาม →
          </button>
        </div>
      )}

      {status === 'question' && renderQuestion?.(mindVideoRef, mindVideoReady)}
    </div>
  );
}

// ── styles ──
const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 300,
  background: '#000',
  color: '#fff',
  overflow: 'hidden',
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
  background: 'rgba(0,0,0,.5)',
  border: '1px solid rgba(255,255,255,.28)',
  borderRadius: radius.pill,
  padding: '10px 16px',
  cursor: 'pointer',
};

const badge: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  zIndex: 10,
  fontSize: 15,
  fontWeight: 800,
  color: '#fff',
  background: 'rgba(184,134,11,.92)',
  borderRadius: radius.pill,
  padding: '8px 14px',
};

const centerHint: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 8,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 24,
  background: 'rgba(0,0,0,.28)',
  pointerEvents: 'none',
};

const reticle: React.CSSProperties = {
  width: 'min(56vw, 260px)',
  height: 'min(78vw, 360px)',
  border: '3px dashed rgba(255,214,102,.9)',
  borderRadius: 18,
  boxShadow: '0 0 0 9999px rgba(0,0,0,.18)',
};

const playingBar: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 18px',
  background: 'linear-gradient(0deg, rgba(0,0,0,.65), transparent)',
};

const skipBtn: React.CSSProperties = {
  pointerEvents: 'auto',
  fontFamily: 'inherit',
  fontSize: 15,
  fontWeight: 800,
  color: color.text,
  background: 'rgba(255,255,255,.92)',
  border: 'none',
  borderRadius: radius.pill,
  padding: '10px 16px',
  marginTop: 18,
  cursor: 'pointer',
};
