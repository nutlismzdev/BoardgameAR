import { useEffect } from 'react';
import { useGame } from '@/core/store';
import { startBackgroundMusic, stopBackgroundMusic } from '@/core/sfx';
import { Home } from '@/screens/Home/Home';
import { GameBoard } from '@/screens/GameBoard';
import { GameOver } from '@/screens/GameOver/GameOver';

export default function App() {
  const phase = useGame((s) => s.phase);
  const soundEnabled = useGame((s) => s.settings.soundEnabled);
  const isPlaying = phase !== 'setup' && phase !== 'gameover';

  useEffect(() => {
    if (isPlaying && soundEnabled) {
      startBackgroundMusic();
    } else {
      stopBackgroundMusic();
    }

    return stopBackgroundMusic;
  }, [isPlaying, soundEnabled]);

  if (phase === 'setup') return <Home />;
  if (phase === 'gameover') return <GameOver />;
  return <GameBoard />;
}
