import { useEffect } from 'react';
import { useGame } from '@/core/store';
import { syncContent } from '@/core/content';
import { startBackgroundMusic, stopBackgroundMusic, setSoundEnabled } from '@/core/sfx';
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

  // sync ค่าเสียงเข้ากับโมดูล sfx — จำเป็นเพราะ settings ถูก persist แล้ว (เช่น รีโหลด/resume)
  // ไม่งั้น flag ภายใน sfx (enabled=true) จะไม่ตรงกับ settings.soundEnabled ที่กู้คืนมา
  useEffect(() => {
    setSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (wantMusic) {
      startBackgroundMusic();
    } else {
      stopBackgroundMusic();
    }
  }, [wantMusic]);

  // เบราว์เซอร์บล็อกเสียงจนกว่าจะมี user gesture — เริ่มเพลงเมื่อแตะครั้งแรก
  useEffect(() => {
    if (!wantMusic) return;
    const kick = () => startBackgroundMusic();
    window.addEventListener('pointerdown', kick);
    return () => window.removeEventListener('pointerdown', kick);
  }, [wantMusic]);

  useEffect(() => stopBackgroundMusic, []);

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
