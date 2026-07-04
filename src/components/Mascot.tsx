import { useEffect, useState } from 'react';
import { useGame } from '@/core/store';
import type { FxKind } from '@/core/store';
import { color, radius } from '@/theme/tokens';

// มาสคอตช้างน้อยนำทาง — คอยเชียร์/ให้กำลังใจ ตอบสนองเหตุการณ์ในเกม
const MOODS: Record<FxKind | 'idle', { face: string; msg: string; anim: string }> = {
  idle: { face: '🐘', msg: 'ทอยลูกเต๋าได้เลย!', anim: 'mascotIdle 3s ease-in-out infinite' },
  correct: { face: '🐘', msg: 'เก่งมาก! 🎉', anim: 'mascotJump .5s ease' },
  unlock: { face: '🐘', msg: 'ปลดล็อกมหาราชแล้ว! 👑', anim: 'mascotJump .6s ease' },
  coin: { face: '🐘', msg: 'ได้เหรียญเพิ่ม! 🪙', anim: 'mascotJump .5s ease' },
  wrong: { face: '🐘', msg: 'ไม่เป็นไร ลองใหม่นะ 💪', anim: 'mascotShakeM .4s ease' },
};

export function Mascot() {
  const fx = useGame((s) => s.fx);
  const [mood, setMood] = useState<FxKind | 'idle'>('idle');

  useEffect(() => {
    if (!fx) return;
    setMood(fx.kind);
    const t = setTimeout(() => setMood('idle'), 2600);
    return () => clearTimeout(t);
  }, [fx?.id]);

  const m = MOODS[mood];

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        zIndex: 5,
        pointerEvents: 'none',
      }}
    >
      <div
        key={mood + (fx?.id ?? 0)}
        style={{ fontSize: 52, animation: m.anim, filter: 'drop-shadow(0 4px 5px rgba(0,0,0,.35))' }}
      >
        {m.face}
      </div>
      <div
        style={{
          background: 'rgba(255,255,255,.94)',
          borderRadius: radius.lg,
          borderBottomLeftRadius: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,.2)',
          padding: '8px 14px',
          fontSize: 17,
          fontWeight: 600,
          color: color.text,
          maxWidth: 200,
          marginBottom: 8,
        }}
      >
        {m.msg}
      </div>

      <style>{`
        @keyframes mascotIdle{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-4px) rotate(-3deg)}}
        @keyframes mascotJump{0%{transform:translateY(0) scale(1)}30%{transform:translateY(-18px) scale(1.15)}60%{transform:translateY(0) scale(.95)}100%{transform:translateY(0) scale(1)}}
        @keyframes mascotShakeM{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}
      `}</style>
    </div>
  );
}
