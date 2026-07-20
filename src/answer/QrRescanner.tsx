import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import jsQR from 'jsqr';

// ── กล้องรอสแกน "การ์ดใบต่อไป" บนมือถือ ──
// ตอบเสร็จแล้วเปิดกล้องค้างไว้เลย ผู้เล่นคนต่อไปเล็งที่ QR บนจอกลางได้ทันที
// ไม่ต้องออกไปเปิดแอปกล้องเองใหม่ทุกตา (จังหวะเกมสะดุด)
//
// สแกนได้ทุกชนิดการ์ดต่อเนื่อง: ฟ้า/สาระ (answer.html) → ทอง (ar.html) → ฟ้าต่อ ได้เลย
// ไม่ต้องออกไปเปิดแอปกล้องเองตอนสลับชนิด (ดู APP_PAGES ท้ายไฟล์)
//
// **ความปลอดภัย: รับเฉพาะ QR ที่ชี้มาหน้าการ์ดของแอปนี้เอง (same-origin + โฟลเดอร์เดียวกัน + หน้าใน allowlist)**
// QR เป็นข้อมูลจากภายนอก ถ้าเด็กเล็งไปโดน QR อื่นในห้อง (โปสเตอร์/ขวดน้ำ) แล้วเราพาไปตาม
// นั้นเลย = พาไปเว็บมั่วได้ จึงกรองก่อนเสมอ

type Status = 'opening' | 'scanning' | 'found' | 'denied' | 'error';

export function QrRescanner({ onFound }: { onFound: (url: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastScanRef = useRef(0);
  const doneRef = useRef(false); // กันยิง onFound ซ้ำระหว่างเฟรมที่ยังไม่ทันหยุด
  const [status, setStatus] = useState<Status>('opening');

  // ตาข่ายกันเหนียว: ปกติหน้าตอบตัดคำถามทิ้งหลังตอบแล้ว ทุกอย่างจึงพอดี 1 จอ ไม่ต้องเลื่อน
  // (วัดจริงบน 390x844: กล้องอยู่ที่ 350–560 ของจอ 692 · scrollHeight ไม่เกินจอ)
  // แต่ถ้าคำอธิบายเฉลยยาวผิดปกติ/จอเตี้ยกว่านี้ กล้องอาจถูกดันตกใต้จอได้อีก → เลื่อนเข้ามาให้เอง
  // ถ้าไม่มีอะไรให้เลื่อน scrollIntoView จะไม่ขยับอะไรอยู่แล้ว
  useEffect(() => {
    if (status !== 'scanning') return;
    const t = window.setTimeout(() => {
      wrapRef.current?.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'end',
      });
    }, 1000);
    return () => window.clearTimeout(t);
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    const stop = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      stream?.getTracks().forEach((t) => t.stop()); // ต้องปิดกล้อง ไม่งั้นไฟกล้องค้าง+กินแบต
    };

    const scan = (now: number) => {
      if (cancelled || doneRef.current) return;
      frameRef.current = requestAnimationFrame(scan);
      if (now - lastScanRef.current < 120) return; // ~8 ครั้ง/วิ พอจับได้ ไม่กินซีพียู
      lastScanRef.current = now;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const sw = video.videoWidth;
      const sh = video.videoHeight;
      if (!sw || !sh) return;

      const w = Math.min(480, sw);
      const h = Math.max(1, Math.round((sh / sw) * w));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const hit = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
      if (!hit?.data) return;

      const url = sameAppUrl(hit.data);
      if (!url) return; // QR อื่นในห้อง — เมินไป ไม่พาไปไหน
      if (url === window.location.href) return; // ใบเดิมที่เพิ่งตอบไป ยังไม่เปลี่ยน

      doneRef.current = true;
      setStatus('found');
      stop();
      onFound(url);
    };

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stop();
          return;
        }
        const video = videoRef.current;
        if (!video) throw new Error('no video element');
        video.srcObject = stream;
        await video.play();
        setStatus('scanning');
        frameRef.current = requestAnimationFrame(scan);
      } catch (e) {
        if (cancelled) return;
        // ผู้ใช้กดปฏิเสธสิทธิ์กล้อง ≠ กล้องพัง — ข้อความต้องต่างกัน ไม่งั้นครูงงว่าจะแก้ยังไง
        const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
        setStatus(denied ? 'denied' : 'error');
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [onFound]);

  return (
    <div ref={wrapRef} style={wrap}>
      <div style={head}>
        <span style={{ fontSize: 18 }}>📷</span>
        <strong style={{ fontSize: 15 }}>
          {status === 'opening'
            ? 'กำลังเปิดกล้อง…'
            : status === 'found'
            ? 'เจอการ์ดใบใหม่แล้ว!'
            : status === 'denied'
            ? 'ยังไม่ได้อนุญาตให้ใช้กล้อง'
            : status === 'error'
            ? 'เปิดกล้องไม่ได้'
            : 'พร้อมสแกนใบต่อไป'}
        </strong>
      </div>

      {status === 'denied' || status === 'error' ? (
        <p style={hintText}>
          {status === 'denied'
            ? 'กดอนุญาตกล้องในแถบที่อยู่ของเบราว์เซอร์ แล้วโหลดหน้านี้ใหม่ · หรือใช้แอปกล้องสแกน QR บนจอกลางเหมือนเดิมก็ได้'
            : 'ใช้แอปกล้องของเครื่องสแกน QR บนจอกลางแทนได้เลย'}
        </p>
      ) : (
        <>
          <div style={viewport}>
            <video ref={videoRef} muted playsInline style={videoStyle} />
            <div style={{ ...reticle, borderColor: status === 'found' ? '#4CC96A' : '#E6C35C' }} />
          </div>
          <p style={hintText}>เล็งกล้องไปที่ QR บนจอกลางเมื่อถึงตาถัดไป</p>
        </>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

// หน้าการ์ดบนมือถือทั้งหมด — การ์ดฟ้า/สาระไป answer.html · การ์ดทองไป ar.html
// เพิ่มหน้าใหม่เมื่อไหร่ต้องเติมที่นี่ ไม่งั้นสแกนแล้วจะโดนเมินเงียบ ๆ (ดีบักยาก)
const APP_PAGES = ['answer.html', 'ar.html'];

const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);
const pageOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/**
 * รับเฉพาะ URL ที่ชี้มาหน้าการ์ดของแอปนี้เอง — กัน QR แปลกปลอมพาผู้เล่นออกนอกเกม
 *
 * เดิมบังคับ `pathname` ต้องตรงกันเป๊ะ ซึ่งแน่นเกินไป: การ์ดทองอยู่คนละหน้า (ar.html)
 * กับการ์ดฟ้า/สาระ (answer.html) → สแกนข้ามชนิดไม่ได้ ต้องออกไปเปิดแอปกล้องเองทุกครั้ง
 * ที่สลับชนิดการ์ด ด่านความปลอดภัยจริงคือ **same-origin** ส่วนหน้าไหนใช้ allowlist พอ
 * (ยังบังคับ "โฟลเดอร์เดียวกัน" ไว้ด้วย เผื่อ deploy ใต้ subpath จะได้ไม่หลุดข้ามแอป)
 */
function sameAppUrl(raw: string): string | null {
  try {
    const u = new URL(raw, window.location.href);
    if (u.origin !== window.location.origin) return null;
    if (dirOf(u.pathname) !== dirOf(window.location.pathname)) return null;
    if (!APP_PAGES.includes(pageOf(u.pathname))) return null;
    if (!u.hash && !u.searchParams.get('id')) return null; // ไม่มี payload = ไม่ใช่การ์ด
    return u.href;
  } catch {
    return null;
  }
}

const wrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '14px 12px',
  borderRadius: 16,
  background: 'rgba(42,33,24,.06)',
  border: '1px dashed #C8B48A',
};

const head: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, color: '#6B4E1E' };

const viewport: CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '4 / 3',
  maxHeight: 210,
  borderRadius: 12,
  overflow: 'hidden',
  background: '#000',
};

const videoStyle: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };

const reticle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%,-50%)',
  // อิง "ความสูง" ไม่ใช่ความกว้าง — กล่องกล้องโดน maxHeight บีบจนเตี้ยกว่า 4:3
  // ถ้าใช้ width:58% + aspectRatio:1 กรอบจะสูงเกินกล่องแล้วขอบบน/ล่างโดน overflow:hidden ตัด
  // เหลือเห็นแค่เส้นตั้งสองข้าง (เจอตอนดูภาพจริง)
  height: '76%',
  aspectRatio: '1',
  border: '3px solid #E6C35C',
  borderRadius: 8,
  transition: 'border-color .2s',
};

const hintText: CSSProperties = {
  margin: 0,
  fontSize: 13.5,
  color: '#6B5E4E',
  textAlign: 'center',
  lineHeight: 1.45,
};
