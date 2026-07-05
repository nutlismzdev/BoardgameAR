import { useEffect, useRef } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';

// ── Hand tracking สำหรับช่องทอง AR ──
// ตรวจจับปลายนิ้วชี้ผ่านกล้องหน้า → แปลงเป็นพิกัดบนจอ (mirror เพราะกล้องหน้า)
// จีบนิ้ว (นิ้วโป้ง+นิ้วชี้ชิดกัน) = "จับ/วาง" คำตอบ
// ไฟล์โมเดล/wasm ถูก bundle ไว้ที่ public/mediapipe (เล่นออฟไลน์ได้)

export interface HandFrame {
  x: number; // พิกัดจอ (px) — mirror แล้ว
  y: number; // พิกัดจอ (px)
  present: boolean; // เจอมือในเฟรมนี้ไหม
  pinching: boolean; // กำลังจีบนิ้วอยู่ไหม
}

export type HandStatus = 'loading' | 'ready' | 'error';

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/hand_landmarker.task';

// landmark index (MediaPipe Hands)
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const WRIST = 0;
const MIDDLE_MCP = 9;

// hysteresis: จีบเมื่อสัดส่วน < PINCH_ON, ปล่อยเมื่อ > PINCH_OFF (กันสั่น)
const PINCH_ON = 0.4;
const PINCH_OFF = 0.6;
const SMOOTH = 0.45; // exponential smoothing ของพิกัดปลายนิ้ว

export function useHandTracking(opts: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onFrame: (f: HandFrame) => void;
  onStatus?: (s: HandStatus) => void;
}) {
  // เก็บ callback ใน ref เพื่อไม่ต้อง re-init loop ทุกครั้งที่ parent re-render
  const onFrameRef = useRef(opts.onFrame);
  const onStatusRef = useRef(opts.onStatus);
  onFrameRef.current = opts.onFrame;
  onStatusRef.current = opts.onStatus;

  const { videoRef, enabled } = opts;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let raf = 0;
    let landmarker: HandLandmarker | null = null;
    let lastVideoTime = -1;
    let pinching = false;
    const smooth = { x: 0, y: 0, init: false };

    onStatusRef.current?.('loading');

    (async () => {
      // lazy-load MediaPipe เฉพาะตอนเข้าช่องทอง (ไม่ถ่วง initial bundle ของ PWA)
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 1,
        });
      } catch {
        // GPU ไม่ได้ → ลอง CPU
        try {
          const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
          landmarker = await HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        } catch {
          if (!cancelled) onStatusRef.current?.('error');
          return;
        }
      }
      if (cancelled) {
        landmarker?.close();
        return;
      }
      onStatusRef.current?.('ready');

      const loop = () => {
        raf = requestAnimationFrame(loop);
        const video = videoRef.current;
        if (!video || !landmarker || video.readyState < 2) return;
        if (video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;

        let result;
        try {
          result = landmarker.detectForVideo(video, performance.now());
        } catch {
          return;
        }
        const lm = result?.landmarks?.[0];
        if (!lm) {
          pinching = false;
          smooth.init = false;
          onFrameRef.current({ x: 0, y: 0, present: false, pinching: false });
          return;
        }

        // อ้างอิงขนาดฝ่ามือเพื่อ normalize ระยะจีบนิ้ว (กันเรื่องมือใกล้/ไกลกล้อง)
        const palm = dist(lm[WRIST], lm[MIDDLE_MCP]) || 0.0001;
        const pinchRatio = dist(lm[THUMB_TIP], lm[INDEX_TIP]) / palm;
        if (pinching) {
          if (pinchRatio > PINCH_OFF) pinching = false;
        } else if (pinchRatio < PINCH_ON) {
          pinching = true;
        }

        // ปลายนิ้วชี้ → พิกัดจอ (mirror x เพราะกล้องหน้า)
        const tip = lm[INDEX_TIP];
        const targetX = (1 - tip.x) * window.innerWidth;
        const targetY = tip.y * window.innerHeight;
        if (!smooth.init) {
          smooth.x = targetX;
          smooth.y = targetY;
          smooth.init = true;
        } else {
          smooth.x += (targetX - smooth.x) * SMOOTH;
          smooth.y += (targetY - smooth.y) * SMOOTH;
        }

        onFrameRef.current({ x: smooth.x, y: smooth.y, present: true, pinching });
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      landmarker?.close();
    };
  }, [enabled, videoRef]);
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
