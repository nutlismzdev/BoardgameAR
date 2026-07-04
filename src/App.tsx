import { useGame } from '@/core/store';
import { Home } from '@/screens/Home/Home';
import { GameBoard } from '@/screens/GameBoard';
import { GameOver } from '@/screens/GameOver/GameOver';

export default function App() {
  const phase = useGame((s) => s.phase);
  if (phase === 'setup') return <Home />;
  if (phase === 'gameover') return <GameOver />;
  return <GameBoard />;
}
