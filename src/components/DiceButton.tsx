import { useEffect, useState } from 'react';
import { useGame } from '@/core/store';
import { color, radius } from '@/theme/tokens';
import { PawnToken } from './PawnToken';

// ปุ่มทอยลูกเต๋า — ลูกเต๋า 3D หมุนสลับเลขแบบลุ้น แล้วเผยเลขที่ทอยได้
export function DiceButton({ size = 72 }: { size?: number }) {
  const phase = useGame((s) => s.phase);
  const lastRoll = useGame((s) => s.lastRoll);
  const roll = useGame((s) => s.roll);

  const rolling = phase === 'rolling';
  const busy = phase !== 'idle';
  const [face, setFace] = useState(1);

  // ระหว่างทอย: สลับเลขลูกเต๋าเร็ว ๆ ให้ลุ้น
  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(() => setFace(Math.floor(Math.random() * 6) + 1), 80);
    return () => clearInterval(id);
  }, [rolling]);

  const shown = rolling ? face : lastRoll ?? 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div
        key={rolling ? 'roll' : `res-${lastRoll}`}
        style={{
          animation: rolling
            ? 'diceTumble .45s linear infinite'
            : lastRoll
            ? 'dicePop .45s cubic-bezier(.2,1.4,.5,1)'
            : 'none',
        }}
      >
        <PawnToken size={size} color={color.primary} value={shown} />
      </div>

      {/* ตัวเลขผลทอย — บอกจำนวนที่ได้ให้ชัด (จุดบนลูกเต๋าอ่านยากสำหรับเด็ก) */}
      <div style={{ minHeight: 26, display: 'flex', alignItems: 'center' }}>
        {rolling ? (
          <span style={{ fontSize: 16, color: color.textMuted, fontWeight: 700 }}>กำลังทอย…</span>
        ) : lastRoll != null ? (
          <span style={{ fontSize: 20, fontWeight: 800, color: color.primary }}>
            🎲 ทอยได้ {lastRoll}
          </span>
        ) : null}
      </div>

      <button
        onClick={() => roll()}
        disabled={busy}
        style={{
          fontFamily: 'inherit',
          fontSize: 20,
          fontWeight: 700,
          color: '#fff',
          background: busy ? '#B0A697' : color.primary,
          border: 'none',
          borderRadius: radius.pill,
          padding: '12px 32px',
          minHeight: 52,
          cursor: busy ? 'default' : 'pointer',
          boxShadow: '0 4px 12px rgba(139,0,0,.35)',
        }}
      >
        {rolling ? 'กำลังทอย…' : phase === 'moving' || phase === 'resolving' ? 'กำลังเดิน…' : '🎲 ทอยลูกเต๋า'}
      </button>

      <style>{`
        @keyframes diceTumble{
          0%{transform:rotate(0deg) scale(1)}
          25%{transform:rotate(160deg) scale(1.12)}
          50%{transform:rotate(300deg) scale(.96)}
          75%{transform:rotate(430deg) scale(1.12)}
          100%{transform:rotate(540deg) scale(1)}
        }
        @keyframes dicePop{
          0%{transform:scale(1.5) rotate(-12deg)}
          60%{transform:scale(.92) rotate(4deg)}
          100%{transform:scale(1) rotate(0)}
        }
      `}</style>
    </div>
  );
}
