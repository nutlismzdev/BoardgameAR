import { useGame } from '@/core/store';
import { color, radius, elevation } from '@/theme/tokens';
import type { Player } from '@/core/types';

// หน้าสรุปผล — โหมดเดี่ยวแสดงคะแนน+ดาว, โหมดหลายคนจัดอันดับ
export function GameOver() {
  const players = useGame((s) => s.players);
  const setupGame = useGame((s) => s.setupGame);
  const backToHome = useGame((s) => s.backToHome);

  const badgeFor = (p: Player, rank: number) => {
    if (p.kingCoins.length >= 7) return 'ผู้พิชิต 7 มหาราช';
    if (rank === 0) return 'ยอดนักประวัติศาสตร์';
    if (p.kingCoins.length >= 4) return 'นักสะสมเหรียญกษัตริย์';
    if (p.coins >= 300) return 'เศรษฐีเหรียญ';
    return 'นักเรียนรู้';
  };

  // โหมดผู้เล่นคนเดียว — สรุปคะแนน + ดาว
  if (players.length === 1) {
    return <SoloSummary player={players[0]} badge={badgeFor(players[0], 0)} onReplay={() => setupGame(1)} onHome={backToHome} />;
  }

  // จัดอันดับ: เหรียญกษัตริย์ก่อน (เงื่อนไขชนะ) แล้วค่อยเหรียญราชภักดิ์
  const ranked = [...players].sort(
    (a, b) => b.kingCoins.length - a.kingCoins.length || b.coins - a.coins
  );
  const medals = ['🥇', '🥈', '🥉', '🎖️'];

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: color.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 24,
        gap: 12,
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: 64, marginTop: 8 }}>🏆</div>
      <h1 style={{ fontSize: 32, color: color.primary, margin: 0 }}>จบเกม!</h1>
      <p style={{ color: color.textMuted, marginTop: 0 }}>
        ผู้ชนะคือ {ranked[0]?.token} {ranked[0]?.name}
      </p>

      <div style={{ width: 'min(560px, 94vw)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ranked.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 18px',
              borderRadius: radius.md,
              background: color.surface,
              boxShadow: i === 0 ? `0 0 0 3px ${color.secondary}` : elevation.card,
            }}
          >
            <span style={{ fontSize: 30 }}>{medals[i] ?? '🎖️'}</span>
            <span style={{ fontSize: 30 }}>{p.token}</span>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <strong style={{ fontSize: 18 }}>{p.name}</strong>
              <span style={{ fontSize: 16, color: color.info }}>🏅 {badgeFor(p, i)}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: color.secondary }}>
                🪙 {p.coins}
              </div>
              <div style={{ fontSize: 16, color: color.textMuted }}>
                👑 {p.kingCoins.length}/7
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button onClick={() => setupGame(players.length)} style={btn(color.primary)}>
          🔁 เล่นอีกครั้ง
        </button>
        <button onClick={backToHome} style={btn('#607D8B')}>
          🏠 หน้าแรก
        </button>
      </div>
    </div>
  );
}

// สรุปผลโหมดเดี่ยว
function SoloSummary({
  player,
  badge,
  onReplay,
  onHome,
}: {
  player: Player;
  badge: string;
  onReplay: () => void;
  onHome: () => void;
}) {
  const kings = player.kingCoins.length;
  const stars = kings >= 7 || player.coins >= 400 ? 3 : kings >= 4 || player.coins >= 200 ? 2 : 1;

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: color.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 10,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 64 }}>🎉</div>
      <h1 style={{ fontSize: 32, color: color.primary, margin: 0 }}>จบเกม!</h1>
      <div style={{ fontSize: 44, letterSpacing: 6 }}>
        {'⭐'.repeat(stars)}
        <span style={{ opacity: 0.25 }}>{'⭐'.repeat(3 - stars)}</span>
      </div>

      <div
        style={{
          width: 'min(440px, 92vw)',
          background: color.surface,
          borderRadius: radius.lg,
          boxShadow: elevation.card,
          padding: 24,
          margin: '8px 0',
        }}
      >
        <div style={{ fontSize: 48 }}>{player.token}</div>
        <div style={{ fontSize: 16, color: color.info, fontWeight: 600, marginBottom: 12 }}>
          🏅 {badge}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <Stat label="เหรียญ" value={`🪙 ${player.coins}`} />
          <Stat label="เหรียญกษัตริย์" value={`👑 ${kings}/7`} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <button onClick={onReplay} style={btn(color.primary)}>
          🔁 เล่นอีกครั้ง
        </button>
        <button onClick={onHome} style={btn('#607D8B')}>
          🏠 หน้าแรก
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color.secondary }}>{value}</div>
      <div style={{ fontSize: 16, color: color.textMuted }}>{label}</div>
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    fontFamily: 'inherit',
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
    background: bg,
    border: 'none',
    borderRadius: radius.pill,
    padding: '14px 28px',
    minHeight: 56,
    cursor: 'pointer',
  };
}
