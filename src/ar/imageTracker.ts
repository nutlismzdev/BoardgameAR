// ── Wrapper ครอบ MindAR (image-target AR) ──
// โหลด three + MindAR แบบ dynamic import (Vite lazy-chunk — โหลดเฉพาะตอนเข้าโหมด AR การ์ด)
// หน้าที่: track การ์ดทอง → วาง THREE.VideoTexture (วิดีโอบทเรียน) ทับบนการ์ด + แชร์เฟรมกล้องให้ MediaPipe
// NOTE: build ผ่าน แต่ต้องพิสูจน์การทำงานจริงบนอุปกรณ์ (กล้อง/tracking/autoplay) — ดู AR-PLAN.md เฟส 2/4
import type * as THREE from 'three'; // type-only (ถูก erase ตอน build) — ตัวจริงมาจาก dynamic import
import { AR } from './arConfig';

export interface ImageTracker {
  /** เฟรมกล้อง (แชร์ให้ MediaPipe hand-tracking) — พร้อมหลัง start() */
  getVideo(): HTMLVideoElement | null;
  /** เริ่มกล้อง + tracking */
  start(): Promise<void>;
  /** หยุด + ปิดกล้อง + คืน resource */
  stop(): void;
  /** วางระนาบวิดีโอบทเรียนทับการ์ด (เล่นเมื่อ target ถูกพบ) */
  setLessonVideo(video: HTMLVideoElement): void;
  /** วางป้าย placeholder ทับการ์ด เมื่อยังไม่มีวิดีโอบทเรียน */
  setPlaceholderPanel(title: string): void;
  /** หยุด render + การประมวลผล tracking (ลดโหลด GPU) แต่คงกล้องไว้ให้ MediaPipe ตอนสเตจคำถาม */
  pauseTracking(): void;
  onFound(cb: () => void): void;
  onLost(cb: () => void): void;
}

// สร้าง tracker ผูกกับ container (element เต็มจอสำหรับ canvas AR)
export async function createImageTracker(container: HTMLElement): Promise<ImageTracker> {
  const THREE = await import('three');
  const { MindARThree } = await import('mind-ar/dist/mindar-image-three.prod.js');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mindar: any = new MindARThree({
    container,
    imageTargetSrc: AR.mindTargetUrl,
    // ปิด UI overlay ของ MindAR (เรามี overlay/กรอบเล็งเอง จะได้ไม่ทับกัน)
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
  });
  const { renderer, scene, camera } = mindar;
  // multi-target: ผูก anchor ทุก index ที่ตั้งไว้ (หน้า=0, หลัง=1) → ส่องด้านไหนก็เจอ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anchors: any[] = AR.targetIndices.map((i) => mindar.addAnchor(i));

  let foundCb: (() => void) | null = null;
  let lostCb: (() => void) | null = null;
  anchors.forEach((a) => {
    a.onTargetFound = () => foundCb?.();
    a.onTargetLost = () => lostCb?.();
  });

  // ระนาบปัจจุบัน (วิดีโอ/placeholder) วางซ้ำบนทุก anchor เพื่อให้ส่องด้านไหนก็เห็นภาพเดียวกัน
  let disposePlane: (() => void) | null = null;

  // สร้างระนาบขนาดตามการ์ดแล้ววางลงทุก anchor (แชร์ texture/geometry/material ชุดเดียว)
  const mountPlane = (texture: THREE.Texture) => {
    disposePlane?.();
    const geometry = new THREE.PlaneGeometry(AR.videoPlaneScale, AR.videoPlaneScale * AR.cardAspectHeight);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
    const meshes = anchors.map((a) => {
      const m = new THREE.Mesh(geometry, material);
      a.group.add(m);
      return m;
    });
    disposePlane = () => {
      meshes.forEach((m) => m.parent?.remove(m));
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  };

  const renderLoop = () => renderer.render(scene, camera);

  return {
    getVideo: () => (mindar.video as HTMLVideoElement) ?? null,

    async start() {
      await mindar.start(); // ขอกล้อง (MindAR default = กล้องหลัง environment) + เริ่ม tracking
      renderer.setAnimationLoop(renderLoop);
    },

    pauseTracking() {
      // หยุดวาดภาพ AR (การ์ดถูกจอคำถามบังอยู่แล้ว) + หยุด TF.js detection loop ถ้ามี API
      // กล้อง (mindar.video) ยังเล่นอยู่ → MediaPipe ยังตรวจมือได้ต่อ (แชร์สตรีมเดียว)
      renderer.setAnimationLoop(null);
      try {
        mindar.controller?.stopProcessVideo?.();
      } catch {
        /* API ภายในไม่มี → ปล่อยให้แค่หยุด render (ยังปลอดภัย) */
      }
    },

    stop() {
      renderer.setAnimationLoop(null);
      try {
        mindar.stop();
      } catch {
        /* no-op */
      }
      disposePlane?.();
    },

    setLessonVideo(video: HTMLVideoElement) {
      const texture = new THREE.VideoTexture(video);
      // สีให้ตรง (renderer เป็น sRGB) + เห็นได้ทั้งสองด้าน (กัน back-face culling ทำให้วิดีโอไม่ขึ้น)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (texture as any).encoding = (THREE as any).sRGBEncoding;
      mountPlane(texture);
    },

    setPlaceholderPanel(title: string) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1434;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#fff4c2');
        gradient.addColorStop(0.5, '#d6a634');
        gradient.addColorStop(1, '#7a4d09');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#fff7d1';
        ctx.lineWidth = 26;
        ctx.strokeRect(44, 44, canvas.width - 88, canvas.height - 88);
        ctx.fillStyle = 'rgba(0,0,0,.32)';
        ctx.fillRect(94, 910, canvas.width - 188, 330);
        ctx.fillStyle = '#fff8dc';
        ctx.textAlign = 'center';
        ctx.font = 'bold 92px sans-serif';
        ctx.fillText('AR CARD', canvas.width / 2, 1050);
        ctx.font = 'bold 54px sans-serif';
        ctx.fillText(title, canvas.width / 2, 1140);
        ctx.font = '42px sans-serif';
        ctx.fillText('พร้อมเข้าสู่คำถาม', canvas.width / 2, 1215);
      }
      mountPlane(new THREE.CanvasTexture(canvas));
    },

    onFound(cb) {
      foundCb = cb;
    },
    onLost(cb) {
      lostCb = cb;
    },
  };
}
