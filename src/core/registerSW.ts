// ลงทะเบียน service worker — ใช้ร่วมกันทั้ง 3 entry (index / answer.html / ar.html)
//
// ⚠️ เดิมเรียกเฉพาะใน src/main.tsx (index.html) เท่านั้น แต่ **มือถือเด็กไม่เคยเปิด index.html**
// มันเปิดแต่ answer.html / ar.html จากการสแกน QR → เครื่องนั้นจึงไม่มี SW คุมเลย
// ผลคือ MediaPipe (wasm 11 MB + โมเดล 7.8 MB) ต้องพึ่ง HTTP cache ล้วน ๆ ทั้งที่ sw.js
// มีกฎแคช /mediapipe/ รออยู่แล้ว · ซ้ำร้าย AnswerPage สั่ง reload() ทุกครั้งที่สแกนใบใหม่
// ทำหลัง load เสร็จ ไม่ให้แย่งแบนด์วิดท์กับคำถาม/ภาพที่กำลังโหลดอยู่
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
