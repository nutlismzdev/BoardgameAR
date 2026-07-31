import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GoldArPage } from './GoldArPage';
import { registerServiceWorker } from '@/core/registerSW';
import '@/styles.css';

// หน้านี้โหลด MediaPipe (wasm 11 MB + โมเดล 7.8 MB) → ต้องมี SW ไม่งั้นแคชไม่ทน reload
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('ar-root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <GoldArPage />
    </ErrorBoundary>
  </React.StrictMode>
);
