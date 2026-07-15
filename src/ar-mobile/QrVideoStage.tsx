import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import jsQR from 'jsqr';
import { resolveApiAssetUrl } from '@/core/api';

type Point = { x: number; y: number };

export function QrVideoStage({
  challengeId,
  lessonUrl,
  kingName,
  onEnded,
  onFallback,
}: {
  challengeId: string;
  lessonUrl: string;
  kingName: string;
  onEnded: () => void;
  onFallback: () => void;
}) {
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const lessonRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastScanRef = useRef(0);
  const lastFoundRef = useRef(0);
  const cornersRef = useRef<Point[] | null>(null);
  const [status, setStatus] = useState<'opening' | 'scanning' | 'playing' | 'error'>('opening');
  const videoUrl = resolveApiAssetUrl(lessonUrl);

  useEffect(() => {
    if (!videoUrl) {
      onEnded();
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;

    const stop = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      stream?.getTracks().forEach((track) => track.stop());
      lessonRef.current?.pause();
    };

    const scan = (now: number) => {
      if (cancelled) return;
      frameRef.current = requestAnimationFrame(scan);
      if (now - lastScanRef.current < 100) return;
      lastScanRef.current = now;

      const camera = cameraRef.current;
      const canvas = canvasRef.current;
      if (!camera || !canvas || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const sourceWidth = camera.videoWidth;
      const sourceHeight = camera.videoHeight;
      if (!sourceWidth || !sourceHeight) return;

      const scanWidth = Math.min(480, sourceWidth);
      const scanHeight = Math.max(1, Math.round((sourceHeight / sourceWidth) * scanWidth));
      if (canvas.width !== scanWidth || canvas.height !== scanHeight) {
        canvas.width = scanWidth;
        canvas.height = scanHeight;
      }
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(camera, 0, 0, scanWidth, scanHeight);
      const image = context.getImageData(0, 0, scanWidth, scanHeight);
      const result = jsQR(image.data, scanWidth, scanHeight, { inversionAttempts: 'dontInvert' });
      const matchesChallenge =
        result?.data === window.location.href || result?.data.includes(`id=${challengeId}`) || result?.data.includes(challengeId);

      if (result && matchesChallenge) {
        const location = result.location;
        const nextCorners = [
          location.topLeftCorner,
          location.topRightCorner,
          location.bottomRightCorner,
          location.bottomLeftCorner,
        ].map((point) => mapCameraPoint(point, scanWidth, scanHeight, sourceWidth, sourceHeight));
        const smoothCorners = cornersRef.current
          ? nextCorners.map((point, index) => lerpPoint(cornersRef.current![index], point, 0.35))
          : nextCorners;
        cornersRef.current = smoothCorners;
        lastFoundRef.current = now;
        if (lessonRef.current) lessonRef.current.style.transform = homographyMatrix3d(smoothCorners);
        setStatus('playing');
        void lessonRef.current?.play().catch(() => {});
      } else if (now - lastFoundRef.current > 650) {
        cornersRef.current = null;
        setStatus('scanning');
        lessonRef.current?.pause();
      }
    };

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stop();
          return;
        }
        const camera = cameraRef.current;
        if (!camera) throw new Error('camera element unavailable');
        camera.srcObject = stream;
        await camera.play();
        setStatus('scanning');
        frameRef.current = requestAnimationFrame(scan);
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [challengeId, onEnded, videoUrl]);

  return (
    <main style={shell}>
      <video ref={cameraRef} muted playsInline style={cameraStyle} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <video
        ref={lessonRef}
        src={videoUrl}
        muted
        playsInline
        preload="auto"
        onEnded={onEnded}
        style={{ ...lessonStyle, visibility: status === 'playing' ? 'visible' : 'hidden' }}
      />

      <div style={topBadge}>ภารกิจ AR · {kingName}</div>
      {status !== 'playing' ? (
        <div style={hint}>
          <div style={reticle} />
          <strong>{status === 'opening' ? 'กำลังเปิดกล้อง…' : status === 'error' ? 'เปิดกล้องไม่สำเร็จ' : 'เล็ง QR เดิมให้เต็มกรอบ'}</strong>
          <span>วิดีโอจะปรากฏทับบน QR และหยุดเมื่อ QR หลุดจากกล้อง</span>
          <button type="button" style={fallbackButton} onClick={onFallback}>
            ใช้ AR การ์ดทองแทน
          </button>
        </div>
      ) : null}
    </main>
  );
}

function mapCameraPoint(
  point: Point,
  scanWidth: number,
  scanHeight: number,
  sourceWidth: number,
  sourceHeight: number
): Point {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const coverScale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
  const offsetX = (viewportWidth - sourceWidth * coverScale) / 2;
  const offsetY = (viewportHeight - sourceHeight * coverScale) / 2;
  return {
    x: (point.x / scanWidth) * sourceWidth * coverScale + offsetX,
    y: (point.y / scanHeight) * sourceHeight * coverScale + offsetY,
  };
}

function lerpPoint(from: Point, to: Point, amount: number): Point {
  return { x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
}

// Map a 1x1 CSS video element onto the detected QR quadrilateral.
function homographyMatrix3d([p0, p1, p2, p3]: Point[]): string {
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(denominator) < 0.0001 ? 0 : (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = Math.abs(denominator) < 0.0001 ? 0 : (dx1 * dy3 - dx3 * dy1) / denominator;
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  const f = p0.y;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
}

const shell: CSSProperties = { position: 'fixed', inset: 0, overflow: 'hidden', background: '#000', color: '#fff' };
const cameraStyle: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
const lessonStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: 1,
  height: 1,
  objectFit: 'cover',
  transformOrigin: '0 0',
  zIndex: 3,
  background: '#000',
};
const topBadge: CSSProperties = {
  position: 'absolute', top: 16, left: 16, right: 16, zIndex: 8, padding: '9px 14px', textAlign: 'center',
  color: '#fff', background: 'rgba(139,0,0,.82)', border: '1px solid rgba(230,195,92,.8)', borderRadius: 6, fontWeight: 800,
};
const hint: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 7, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 12, padding: 24, textAlign: 'center', background: 'rgba(0,0,0,.28)', pointerEvents: 'none',
};
const reticle: CSSProperties = { width: 'min(64vw, 300px)', aspectRatio: '1', border: '3px solid #E6C35C', borderRadius: 6 };
const fallbackButton: CSSProperties = {
  pointerEvents: 'auto', marginTop: 8, minHeight: 44, padding: '10px 16px', color: '#2A2118', background: '#FFF9E8',
  border: '1px solid #C89B30', borderRadius: 6, fontSize: 15, fontWeight: 800, cursor: 'pointer',
};
