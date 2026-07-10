import { useEffect } from 'react';
import { useGame } from '@/core/store';
import { syncContent } from '@/core/content';
import { startBackgroundMusic, stopBackgroundMusic } from '@/core/sfx';
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

  if (phase === 'setup') return <Home />;
  if (phase === 'gameover') return <GameOver />;
  return <GameBoard />;
}
