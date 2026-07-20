// Service worker ของเกม "7 มหาราช"
// เป้าหมาย: (1) ทำให้ติดตั้งเป็น PWA ได้ (Chrome/Android ต้องมี SW ที่ดัก fetch)
//           (2) เปิดเกมได้แม้เน็ตในโรงเรียนหลุด — เนื้อหาการ์ดยัง fallback จาก cache/seed อยู่แล้ว
//
// กลยุทธ์แคช (จงใจไม่ precache ทุกไฟล์ เพราะ mind-ar/three/mediapipe ใหญ่มาก):
//   - navigate (index/answer/ar) → network-first, ออฟไลน์ค่อย fallback แคช
//   - static asset same-origin  → stale-while-revalidate (ภาพกระดาน/การ์ดไม่มี hash ในชื่อ
//     จึงต้องอัปเดตพื้นหลังเสมอ ไม่ใช้ cache-first)
//   - อย่างอื่น (API/POST/ข้ามโดเมน) → ปล่อยผ่าน ไม่แตะ
const VERSION = 'bg7-v2'; // v2: เลิกแคชวิดีโอ (206 Partial Content ใส่ Cache.put ไม่ได้)
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

// วิดีโอต้อง "ปล่อยผ่าน" ห้ามให้ SW แตะ:
// <video> ขอไฟล์ด้วย Range request → เซิร์ฟเวอร์ตอบ 206 Partial Content ซึ่ง res.ok เป็น true
// แต่ Cache.put() **โยน TypeError กับ response 206 ตามสเปก** → แคชไม่เคยติด ได้แต่ error รัว ๆ
// ใน SW ทุกครั้งที่เล่นวิดีโอ · อีกอย่างคลิปบทเรียนก้อนละ ~2.4MB ไม่ควรกินโควตา Cache Storage
// ของแท็บเล็ตโรงเรียนอยู่แล้ว · เน็ตหลุด = <video> onError → ถอยไปโหมด AR การ์ดทองเอง
const isVideo = (p) => p.startsWith('/video/') || /\.(mp4|webm|mov)$/i.test(p);

const isStatic = (p) =>
  p.startsWith('/assets/') ||
  p.startsWith('/icons/') ||
  p.startsWith('/mediapipe/') ||
  p.startsWith('/ar/') ||
  /\.(png|jpe?g|svg|webp|woff2?|json|wasm)$/.test(p);

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

  if (isVideo(url.pathname)) return; // ปล่อยให้เบราว์เซอร์คุย Range กับเซิร์ฟเวอร์ตรง ๆ
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
