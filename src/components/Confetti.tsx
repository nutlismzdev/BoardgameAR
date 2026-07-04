import { useEffect, useMemo } from 'react';
import type { FxKind } from '@/core/store';

// คอนเฟตติ — ระเบิดอนุภาคสีจากกลางจอ แล้วร่วงจางหายเอง (SVG/CSS ล้วน)
const PALETTE: Record<FxKind, string[]> = {
  correct: ['#E23B2E', '#2E6FE2', '#00A36C', '#F9A825', '#8E44AD'],
  unlock: ['#C9A227', '#FFD700', '#E23B2E', '#FFF3C4', '#E0B84A'],
  coin: ['#F9A825', '#FFD700', '#E0B84A'],
  wrong: [],
};

export function Confetti({ kind, onDone }: { kind: FxKind; onDone: () => void }) {
  const count = kind === 'unlock' ? 46 : 26;
  const colors = PALETTE[kind];

  const parts = useMemo(
    () =>
      Array.from({ length: count }).map(() => ({
        dx: (Math.random() - 0.5) * 2 * (kind === 'unlock' ? 340 : 240),
        dy: 80 + Math.random() * (kind === 'unlock' ? 380 : 260),
        rot: (Math.random() - 0.5) * 720,
        size: 7 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.12,
        round: Math.random() > 0.5,
      })),
    [kind]
  );

  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, []);

  if (!colors.length) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 120, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '50%', top: '38%' }}>
        {parts.map((p, i) => (
          <span
            key={i}
            style={
              {
                position: 'absolute',
                width: p.size,
                height: p.size * (p.round ? 1 : 1.6),
                background: p.color,
                borderRadius: p.round ? '50%' : 2,
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                '--rot': `${p.rot}deg`,
                animation: `confettiFall 1.3s cubic-bezier(.15,.6,.4,1) ${p.delay}s forwards`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <style>{`
        @keyframes confettiFall{
          0%{transform:translate(0,0) rotate(0);opacity:1}
          100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0}
        }
      `}</style>
    </div>
  );
}
