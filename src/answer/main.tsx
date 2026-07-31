import React from 'react';
import ReactDOM from 'react-dom/client';
import { AnswerPage } from './AnswerPage';
import { registerServiceWorker } from '@/core/registerSW';

// Entry แยกสำหรับ "หน้าตอบบนมือถือ" — โหลดเบา ไม่ลาก store/เกม/MindAR มาด้วย
// SW จำเป็นตรงนี้ด้วย: มือถือเปิดแต่หน้านี้ (ไม่เคยเปิด index.html) และ reload ทุกคำถาม
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('answer-root')!).render(
  <React.StrictMode>
    <AnswerPage />
  </React.StrictMode>
);
