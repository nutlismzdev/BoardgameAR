// Service worker ของเกม "7 มหาราช"
// เป้าหมาย: (1) ทำให้ติดตั้งเป็น PWA ได้ (Chrome/Android ต้องมี SW ที่ดัก fetch)
//           (2) เปิดเกมได้แม้เน็ตในโรงเรียนหลุด — เนื้อหาการ์ดยัง fallback จาก cache/seed อยู่แล้ว
//
// กลยุทธ์แคช (จงใจไม่ precache ทุกไฟล์ เพราะ mind-ar/three/mediapipe ใหญ่มาก):
//   - navigate (index/answer/ar) → network-first, ออฟไลน์ค่อย fallback แคช
//   - static asset same-origin  → stale-while-revalidate (ภาพกระดาน/การ์ดไม่มี hash ในชื่อ
//     จึงต้องอัปเดตพื้นหลังเสมอ ไม่ใช้ cache-first)
//   - อย่างอื่น (API/POST/ข้ามโดเมน) → ปล่อยผ่าน ไม่แตะ
const VERSION = 'bg7-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_URLS))
      .catch(() => {}) // ติดตั้งต่อได้แม้บางไฟล์โหลดไม่ขึ้น
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// หน้าเว็บสั่งอัปเดตทันทีได้ (ใช้ตอนกด "โหลดเวอร์ชันใหม่")
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

const isStatic = (p) =>
  p.startsWith('/assets/') ||
  p.startsWith('/icons/') ||
  p.startsWith('/mediapipe/') ||
  p.startsWith('/ar/') ||
  /\.(png|jpe?g|svg|webp|mp4|webm|woff2?|json|wasm)$/.test(p);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API ข้ามโดเมน (VITE_API_BASE) ปล่อยผ่าน
  if (url.pathname.startsWith('/api/')) return; // proxy dev + CMS content ต้องสดเสมอ

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
    );
    return;
  }

  if (!isStatic(url.pathname)) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    })
  );
});
