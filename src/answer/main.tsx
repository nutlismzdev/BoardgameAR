import React from 'react';
import ReactDOM from 'react-dom/client';
import { AnswerPage } from './AnswerPage';

// Entry แยกสำหรับ "หน้าตอบบนมือถือ" — โหลดเบา ไม่ลาก store/เกม/MindAR มาด้วย
ReactDOM.createRoot(document.getElementById('answer-root')!).render(
  <React.StrictMode>
    <AnswerPage />
  </React.StrictMode>
);
