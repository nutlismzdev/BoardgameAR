import { useEffect, useRef, useState } from 'react';
import { AR } from '@/ar/arConfig';
import { createImageTracker, type ImageTracker } from '@/ar/imageTracker';
import { color, radius } from '@/theme/tokens';

// ── สเตจ "ส่องการ์ดจริง" (image-target AR) ──
// เปิดกล้องหลัง (MindAR) → เจอการ์ดทอง → เล่นวิดีโอบทเรียนทับบนการ์ด → ครบ 15 วิ/จบคลิป → onProceed()
// ถ้าไม่มีวิดีโอ / โหลด MindAR ไม่ได้ / หา target ไม่เจอในเวลาที่กำหนด → onFallback() (ไปโหมดวิดีโอปกติ กล้องหน้า)
type Status = 'loading' | 'scanning' | 'playing' | 'error';

export function ARCardStage({
  lessonUrl,
  kingName,
  onProceed,
  onFallback,
  onExit,
}: {
  lessonUrl: string; // URL วิดีโอบทเรียน (ว่าง = ไม่มี → fallback)
  kingName: string;
  onProceed: () => void; // ดูจบ → เข้าคำถาม
  onFallback: () => void; // AR ไม่ไหว → กลับโหมดปกติ
  onExit: () => void; // ออกจากบทเรียน (เท่ากับ bail เดิม)
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lessonVideoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<ImageTracker | null>(null);
  const startedRef = useRef(false); // กันเริ่มซ้ำ (StrictMode double-mount)
  const doneRef = useRef(false); // proceed/fallback ครั้งเดียว
  const playingRef = useRef(false); // เจอการ์ด+เล่นวิดีโอแล้ว (กัน scanTimeout เผลอ fallback ทั้งที่เล่นอยู่)
  const [status, setStatus] = useState<Status>('loading');
  const [secondsLeft, setSecondsLeft] = useState<number>(AR.lessonSeconds);

  const finishOnce = (fn: () => void) => {
    if (doneRef.current) return;
    doneRef.current = true;
    fn();
  };

  // ไม่มีวิดีโอ → ไม่มีอะไรจะทับการ์ด → ใช้โหมดปกติ (จัดการ placeholder ให้)
  useEffect(() => {
    if (!lessonUrl) finishOnce(onFallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonUrl]);

  // เริ่ม MindAR
  useEffect(() => {
    if (!lessonUrl || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    let scanTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const container = containerRef.current;
        const lessonVideo = lessonVideoRef.current;
        if (!container || !lessonVideo) throw new Error('container/วิดีโอไม่พร้อม');

        const tracker = await createImageTracker(container);
        if (cancelled) {
          tracker.stop();
          return;
        }
        trackerRef.current = tracker;
        tracker.setLessonVideo(lessonVideo);

        tracker.onFound(() => {
          playingRef.current = true;
          setStatus('playing');
          lessonVideo.play().catch(() => {});
        });
        tracker.onLost(() => {
          setStatus('scanning');
          lessonVideo.pause();
        });
        // ดูจบคลิป → เข้าคำถาม
        lessonVideo.onended = () => finishOnce(onProceed);

        await tracker.start();
        if (cancelled) {
          tracker.stop();
          return;
        }
        setStatus('scanning');
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonUrl]);

  // นับถอยหลังตอนกำลังเล่น (สำรองกรณีคลิปยาว/ไม่ยิง ended) → ครบเวลาก็เข้าคำถาม
  useEffect(() => {
    if (status !== 'playing') return;
    if (secondsLeft <= 0) {
      finishOnce(onProceed);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, secondsLeft]);

  return (
    <div style={shell}>
      {/* MindAR mount = กล้อง + canvas AR เต็มจอ */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {/* วิดีโอบทเรียน (ซ่อน) — ใช้เป็น texture ทับการ์ด */}
      <video ref={lessonVideoRef} src={lessonUrl} muted playsInline preload="auto" style={{ display: 'none' }} />

      {/* overlay UI */}
      <button onClick={() => finishOnce(onExit)} style={backBtn}>
        ← ออก (ยังไม่รับเหรียญ)
      </button>
      <div style={badge}>🪙 ส่องการ์ดทอง · {kingName}</div>

      {/* กรอบเล็ง + คำแนะนำ ระหว่างยังไม่เจอการ์ด */}
      {status !== 'playing' && (
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
          <span style={{ fontSize: 16, fontWeight: 800 }}>🎬 วิดีโอบทเรียน · เหลือ {secondsLeft} วิ</span>
          <button onClick={() => finishOnce(onProceed)} style={skipBtn}>
            ข้ามไปตอบคำถาม →
          </button>
        </div>
      )}
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
