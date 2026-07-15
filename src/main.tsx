import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { hydrateFromCache } from '@/core/content';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { preloadAllCardArt } from '@/core/cardAssets';
import { lockViewport } from '@/core/viewportLock';

hydrateFromCache();
lockViewport();

// PWA: ลงทะเบียน service worker (Chrome/Android ต้องมี SW ถึงจะขึ้นปุ่ม "ติดตั้ง")
// ทำหลังโหลดเสร็จ ไม่ให้แย่งแบนด์วิดท์กับภาพกระดาน/การ์ดตอนเปิดเกม
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const scheduleCardPreload = () => void preloadAllCardArt().catch(() => {});
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(scheduleCardPreload, { timeout: 2500 });
} else {
  globalThis.setTimeout(scheduleCardPreload, 1200);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
