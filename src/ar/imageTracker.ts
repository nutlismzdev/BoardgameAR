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
  });
  const { renderer, scene, camera } = mindar;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anchor: any = mindar.addAnchor(AR.targetIndex);

  let foundCb: (() => void) | null = null;
  let lostCb: (() => void) | null = null;
  anchor.onTargetFound = () => foundCb?.();
  anchor.onTargetLost = () => lostCb?.();

  let videoMesh: THREE.Mesh | null = null;

  return {
    getVideo: () => (mindar.video as HTMLVideoElement) ?? null,

    async start() {
      await mindar.start(); // ขอกล้อง (MindAR default = กล้องหลัง environment) + เริ่ม tracking
      renderer.setAnimationLoop(() => renderer.render(scene, camera));
    },

    stop() {
      renderer.setAnimationLoop(null);
      try {
        mindar.stop();
      } catch {
        /* no-op */
      }
      if (videoMesh) {
        const mat = videoMesh.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.dispose();
        videoMesh.geometry.dispose();
        videoMesh = null;
      }
    },

    setLessonVideo(video: HTMLVideoElement) {
      // ระนาบขนาดตามการ์ด (กว้าง 1 หน่วยใน anchor space, สูง = สัดส่วนการ์ด) × scale
      const w = AR.videoPlaneScale;
      const h = AR.videoPlaneScale * AR.cardAspectHeight;
      const texture = new THREE.VideoTexture(video);
      const geometry = new THREE.PlaneGeometry(w, h);
      const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
      videoMesh = new THREE.Mesh(geometry, material);
      anchor.group.add(videoMesh);
    },

    onFound(cb) {
      foundCb = cb;
    },
    onLost(cb) {
      lostCb = cb;
    },
  };
}
