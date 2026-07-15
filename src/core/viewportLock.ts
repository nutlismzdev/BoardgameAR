// ล็อกหน้าจอเกมไม่ให้ซูม/เลื่อน + ตัวช่วยเข้าโหมดเต็มจอ
//
// ทำไมต้องมี: `user-scalable=no` ใน <meta viewport> ถูกเบราว์เซอร์ยุคใหม่เมิน
// (iOS Safari ตั้งแต่ 10, Chrome Android ตั้งแต่ 61) เพื่อ accessibility — เด็กจึงจิ้ม
// 2 นิ้วซูมกระดานได้ แล้ว layout ที่คำนวณจาก window.innerWidth/innerHeight
// (useViewportSize/useOrientation) เพี้ยนตาม จอเกมเลยเละ
//
// ทางแก้ = กันซูมที่ระดับ event + CSS `touch-action` แทน แล้วให้ PWA (display: fullscreen)
// เป็นตัวเก็บงานสุดท้าย: เปิดจาก home screen จะไม่มีแถบ URL ให้ซูมตั้งแต่แรก

let locked = false;

/** กันซูมทุกทาง (pinch / double-tap / ctrl+wheel / ctrl±) — เรียกครั้งเดียวตอนบูต */
export function lockViewport(): void {
  if (locked) return;
  locked = true;

  // เปิดกฎ CSS ล็อกผืนจอ (ดู `.vp-locked` ใน styles.css) — ต้องมาคู่กับตัวดัก event ด้านล่าง
  // หน้าที่ไม่เรียกฟังก์ชันนี้ (เช่น ar.html บนมือถือ) จะไม่โดนล็อก body ตามไปด้วย
  document.documentElement.classList.add('vp-locked');

  // iOS Safari: pinch มาเป็น gesture* ไม่ใช่ touch* — ต้องดักแยก
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }

  // Android/WebView: นิ้วที่ 2 ขึ้นไป = กำลังจะ pinch
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );

  // double-tap zoom (touch-action ใน CSS กันได้เกือบหมด อันนี้กันส่วนที่เหลือ)
  let lastTouch = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouch < 300) e.preventDefault();
      lastTouch = now;
    },
    { passive: false }
  );

  // เดสก์ท็อป/ทัชแพด: ctrl+wheel = ซูม, ctrl +/-/0 = ซูม (ครูเปิดบนโน้ตบุ๊กด้วย)
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false }
  );
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });
}

/** เปิดจาก home screen แบบ PWA อยู่หรือเปล่า (ไม่มีแถบ URL = ล็อกจออยู่แล้ว) */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari ไม่รองรับ display-mode ใช้ flag เฉพาะของ Apple
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function isFullscreen(): boolean {
  return document.fullscreenElement != null;
}

/** เข้าเต็มจอ + ล็อกแนวนอน — ต้องเรียกจาก user gesture เท่านั้น */
export async function enterFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    // iOS Safari ไม่รองรับ requestFullscreen กับ element ทั่วไป — ต้อง "เพิ่มไปยังหน้าจอโฮม" แทน
  }
  try {
    // ล็อกแนวนอนได้เฉพาะตอนเต็มจอ/standalone (Android) — iOS อาศัย orientation ใน manifest
    await (
      screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    ).lock?.('landscape');
  } catch {
    // จอไม่รองรับ/ผู้ใช้ล็อกหมุนจอไว้เอง — ปล่อยผ่าน หน้า portrait จะขึ้นป้าย "หมุนแท็บเล็ต"
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ไม่ได้อยู่เต็มจอ */
  }
}

/** รองรับเต็มจอไหม — ใช้ซ่อนปุ่มบน iOS ที่กดไปก็ไม่มีอะไรเกิดขึ้น */
export function fullscreenSupported(): boolean {
  return typeof document.documentElement.requestFullscreen === 'function';
}
