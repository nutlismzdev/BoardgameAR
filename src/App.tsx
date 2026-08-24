import { useEffect } from 'react';
import { useGame } from '@/core/store';
import { syncContent } from '@/core/content';
import { useRoomHeartbeat } from '@/core/useRoomHeartbeat';
import { useTest } from '@/core/testStore';
import { startBackgroundMusic, stopAllAudio, setSoundEnabled } from '@/core/sfx';
import { Home } from '@/screens/Home/Home';
import { GameBoard } from '@/screens/GameBoard';
import { GameOver } from '@/screens/GameOver/GameOver';

export default function App() {
  const phase = useGame((s) => s.phase);
  const soundEnabled = useGame((s) => s.settings.soundEnabled);
  // เล่นเพลงตั้งแต่หน้าแรก (setup) จนถึงตอนเล่น — หยุดที่หน้าจบเกม
  const wantMusic = soundEnabled && phase !== 'gameover';

  useEffect(() => {
    void syncContent();
  }, []);

  // ผลแบบทดสอบที่ส่งขึ้นส่วนกลางไม่สำเร็จ (เน็ตโรงเรียนหลุดกลางคาบ) — ลองส่งซ้ำตอนเปิดแอป
  // ทำที่นี่ที่เดียว เพราะเป็นจุดเดียวที่รันแน่นอนไม่ว่าเด็กจะเข้าหน้าไหนต่อ
  useEffect(() => {
    void useTest.getState().flushQueue();
  }, []);

  // ห้องแข่งออนไลน์: ส่งแต้มทีมเรา + รับอันดับทั้งห้อง (ไม่ทำอะไรเลยถ้าไม่ได้อยู่ในห้อง)
  useRoomHeartbeat();

  // sync ค่าเสียงเข้ากับโมดูล sfx — จำเป็นเพราะ settings ถูก persist แล้ว (เช่น รีโหลด/resume)
  // ไม่งั้น flag ภายใน sfx (enabled=true) จะไม่ตรงกับ settings.soundEnabled ที่กู้คืนมา
  useEffect(() => {
    setSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  // เรียกได้ตรง ๆ ไม่ต้องรอ gesture เอง — sfx จำเจตนาไว้แล้วลงมือตอนปลดล็อกได้
  // (นโยบาย autoplay เป็นเรื่องของชั้นเสียง ไม่ใช่ของคอมโพเนนต์ ดู initAudioUnlock)
  useEffect(() => {
    if (wantMusic) {
      startBackgroundMusic();
    } else {
      // เข้าหน้าจบเกม/ปิดเสียง: หยุดทุกชั้น ไม่งั้นเพลงฉลองใบสุดท้ายจะคาบมาทับเสียง sfx.win
      stopAllAudio();
    }
  }, [wantMusic]);

  useEffect(() => stopAllAudio, []);

  // ดักปุ่ม back ของเบราว์เซอร์/แท็บเล็ตระหว่างเล่น → ถามยืนยันแทนออกจากแอปทันที
  // (SPA นี้ไม่มี router: วางหมุด history 1 อันตอนเข้าเกม แล้วดักซ้ำทุกครั้งที่กด back)
  const inGame = phase !== 'setup' && phase !== 'gameover';
  useEffect(() => {
    if (!inGame) return;
    history.pushState({ bg7: true }, '');
    const onPop = () => {
      history.pushState({ bg7: true }, ''); // ดักซ้ำ กัน back หลุดออกจากแอป
      useGame.getState().requestExit();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [inGame]);

  if (phase === 'setup') return <Home />;
  if (phase === 'gameover') return <GameOver />;
  return <GameBoard />;
}
