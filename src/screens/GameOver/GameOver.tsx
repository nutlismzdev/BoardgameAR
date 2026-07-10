import { useGame } from '@/core/store';
import { KINGS } from '@/core/content';
import { KingCoinRow } from '@/components/KingCoinRow';
import { getKingPawnImage } from '@/core/kingAssets';
import type { Player } from '@/core/types';

// สีประจำผู้เล่น 1–4 (ตรงกับหน้าตั้งค่าเกม) — index ตาม player.id (ลำดับที่นั่ง)
const PC = ['#C0912E', '#B23A2E', '#2C5AA0', '#2E7D50'];
const TH = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
const toThai = (s: string | number) => String(s).replace(/[0-9]/g, (d) => TH[+d]);

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

const kingName = (id: string) => KINGS.find((k) => k.id === id)?.name ?? '';

const STYLE = `
@keyframes go-fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes go-popIn { 0% { opacity: 0; transform: scale(.86); } 60% { transform: scale(1.03); } 100% { opacity: 1; transform: scale(1); } }
@keyframes go-rise { from { opacity: 0; transform: translateY(22px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes go-spin { to { transform: rotate(360deg); } }
@keyframes go-floatDust { from { background-position: 0 0, 0 0; } to { background-position: 60px -80px, -40px 60px; } }
@keyframes go-shine { 0%,100% { filter: drop-shadow(0 0 8px rgba(233,206,126,.55)); } 50% { filter: drop-shadow(0 0 18px rgba(233,206,126,.95)); } }
@keyframes go-fall { 0% { transform: translateY(-40px) rotate(0); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(360px) rotate(320deg); opacity: 0; } }
.go-ranklist { width: min(600px, 94vw); display: flex; flex-direction: column; gap: 10px; }
.go-actions { display: flex; gap: 12px; margin-top: 18px; flex-wrap: wrap; justify-content: center; }
`;

// พื้นหลังธีมราชวัง (แถบหลังคาวัด + ฝุ่นทอง) — ใช้ร่วมกับหน้าตั้งค่าเกม
function RoyalBackdrop() {
  return (
    <>
      <style>{STYLE}</style>
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 12, zIndex: 5, opacity: 0.9,
          background: 'repeating-linear-gradient(135deg,#8A1414 0 14px,#A83322 14px 28px)',
        }}
      />
      <div
        style={{
          position: 'fixed', top: 12, left: 0, right: 0, height: 3, zIndex: 5,
          background: 'linear-gradient(90deg,#C79A3A,#E9CE7E,#C79A3A)',
        }}
      />
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(rgba(180,140,70,.10) 1px,transparent 1.5px),radial-gradient(rgba(180,140,70,.06) 1px,transparent 1.5px)',
          backgroundSize: '44px 44px,28px 28px', backgroundPosition: '0 0,14px 14px',
          animation: 'go-floatDust 26s linear infinite',
        }}
      />
    </>
  );
}

const ROYAL_BG = 'radial-gradient(125% 95% at 50% -12%, #FBF4E1 0%, #F3E7C9 52%, #ECDCB8 100%)';

function screenStyle(): React.CSSProperties {
  return {
    minHeight: '100dvh',
    width: '100%',
    overflowY: 'auto',
    position: 'relative',
    fontFamily: "'Sarabun', sans-serif",
    color: '#3A2A18',
    background: ROYAL_BG,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 22px 32px',
  };
}

// หน้าสรุปผล — โหมดเดี่ยวแสดงคะแนน+ดาว, โหมดหลายคนจัดอันดับ + เชิดชูผู้ชนะ
export function GameOver() {
  const players = useGame((s) => s.players);
  const setupGame = useGame((s) => s.setupGame);
  const backToHome = useGame((s) => s.backToHome);

  const badgeFor = (p: Player, rank: number) => {
    if (p.kingCoins.length >= 7) return 'ผู้พิชิต ๗ มหาราช';
    if (rank === 0) return 'ยอดนักประวัติศาสตร์';
    if (p.kingCoins.length >= 4) return 'นักสะสมเหรียญกษัตริย์';
    if (p.coins >= 300) return 'เศรษฐีเหรียญ';
    return 'นักเรียนรู้';
  };

  if (players.length === 1) {
    return (
      <SoloSummary
        player={players[0]}
        badge={badgeFor(players[0], 0)}
        onReplay={() => setupGame(1, [players[0].kingTokenId])}
        onHome={backToHome}
      />
    );
  }

  // จัดอันดับ: เหรียญกษัตริย์ก่อน (เงื่อนไขชนะ) แล้วค่อยเหรียญราชภักดิ์
  const ranked = [...players].sort(
    (a, b) => b.kingCoins.length - a.kingCoins.length || b.coins - a.coins
  );
  const champ = ranked[0];
  const champColor = PC[champ.id] ?? '#C0912E';
  const medals = ['🥇', '🥈', '🥉', '🎖️'];

  return (
    <div style={screenStyle()}>
      <RoyalBackdrop />

      {/* HEADER */}
      <header style={{ textAlign: 'center', animation: 'go-fadeUp .5s .02s both', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <span style={{ width: 90, maxWidth: '16vw', height: 2, background: 'linear-gradient(90deg,transparent,#C79A3A)' }} />
          <span style={{ fontSize: 30 }}>🏆</span>
          <h1 style={{ fontFamily: "'Chonburi',serif", fontSize: 'clamp(30px,5.5vw,46px)', lineHeight: 1, margin: 0, color: '#8A1414', textShadow: '0 2px 0 rgba(201,154,58,.35)' }}>
            ปิดตำนานศึก
          </h1>
          <span style={{ fontSize: 30 }}>🏆</span>
          <span style={{ width: 90, maxWidth: '16vw', height: 2, background: 'linear-gradient(270deg,transparent,#C79A3A)' }} />
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 15, color: '#7A5B33', fontWeight: 500 }}>
          บอร์ดเกมเรียนรู้ประวัติศาสตร์ไทย · อุทยานราชภักดิ์
        </p>
      </header>

      {/* WINNER SPOTLIGHT */}
      <div
        style={{
          position: 'relative',
          width: 'min(600px, 94vw)',
          marginTop: 20,
          zIndex: 1,
          background: 'linear-gradient(180deg,#FFFDF6,#FBF3DF)',
          border: `2px solid ${champColor}`,
          borderRadius: 24,
          padding: '22px 24px 24px',
          textAlign: 'center',
          boxShadow: `0 14px 34px ${hexA(champColor, 0.3)}`,
          animation: 'go-popIn .45s .1s both',
          overflow: 'hidden',
        }}
      >
        {/* คอนเฟตตี */}
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: `${(i * 7 + 4) % 100}%`,
              width: 8,
              height: 8,
              borderRadius: i % 3 === 0 ? '50%' : 2,
              background: [champColor, '#E9CE7E', '#8A1414', '#2E7D50'][i % 4],
              animation: `go-fall ${2.6 + (i % 5) * 0.4}s ${(i % 7) * 0.25}s ease-in infinite`,
              opacity: 0,
            }}
          />
        ))}

        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* รัศมีหมุนหลังหมาก */}
          <div
            style={{
              position: 'absolute', inset: -14, borderRadius: '50%', zIndex: 0,
              background: `conic-gradient(from 0deg, ${hexA(champColor, 0.28)}, transparent 25%, ${hexA(champColor, 0.28)} 50%, transparent 75%, ${hexA(champColor, 0.28)})`,
              animation: 'go-spin 9s linear infinite',
            }}
          />
          <div
            style={{
              position: 'relative', zIndex: 1, width: 128, height: 128, borderRadius: '50%',
              background: 'radial-gradient(115% 78% at 50% 20%, #FCF6E6 0%, #F1E5C5 60%, #E8D9B4 100%)',
              border: '3px solid #E9CE7E', display: 'grid', placeItems: 'center', overflow: 'hidden',
              boxShadow: 'inset 0 2px 8px rgba(120,80,30,.25)',
            }}
          >
            <img
              src={getKingPawnImage(champ.kingTokenId)}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: '50% 100%', animation: 'go-shine 2.6s ease-in-out infinite' }}
            />
          </div>
          <div style={{ position: 'absolute', top: -10, right: -6, fontSize: 34, zIndex: 2, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' }}>👑</div>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, letterSpacing: '.5px', color: champColor }}>
          🎉 ผู้ชนะ · ผู้เล่น {TH[champ.id + 1]}
        </div>
        <div style={{ fontFamily: "'Chonburi',serif", fontSize: 24, color: '#8A1414', margin: '2px 0 2px' }}>
          {champ.name}
        </div>
        <div style={{ fontFamily: "'Trirong',serif", fontSize: 15, fontWeight: 600, color: '#7A5B33' }}>
          {kingName(champ.kingTokenId)}
        </div>
        <div
          style={{
            display: 'inline-block', marginTop: 8, padding: '5px 16px', borderRadius: 999,
            background: hexA(champColor, 0.14), color: champColor, fontWeight: 700, fontSize: 13.5,
          }}
        >
          🏅 {badgeFor(champ, 0)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 26, marginTop: 14 }}>
          <Stat value={`🪙 ${toThai(champ.coins)}`} label="เหรียญราชภักดิ์" />
          <Stat value={`👑 ${TH[champ.kingCoins.length]}/๗`} label="เหรียญกษัตริย์" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <KingCoinRow collected={champ.kingCoins} size={30} gap={6} />
        </div>
      </div>

      {/* RANKING (อันดับ 2 เป็นต้นไป) */}
      {ranked.length > 1 && (
        <div className="go-ranklist" style={{ marginTop: 16, zIndex: 1 }}>
          {ranked.slice(1).map((p, idx) => {
            const rank = idx + 1;
            const pc = PC[p.id] ?? '#8A6A3A';
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderRadius: 16, background: '#FFFEFA', border: `2px solid ${hexA(pc, 0.4)}`,
                  boxShadow: '0 5px 14px rgba(90,50,20,.10)',
                  animation: `go-rise .45s ${0.14 + idx * 0.07}s both`,
                }}
              >
                <span style={{ fontSize: 26, width: 32, textAlign: 'center', flexShrink: 0 }}>{medals[rank] ?? '🎖️'}</span>
                <div
                  style={{
                    width: 46, height: 46, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                    background: 'radial-gradient(115% 78% at 50% 20%, #FCF6E6, #E8D9B4)',
                    border: `2px solid ${pc}`, display: 'grid', placeItems: 'center',
                  }}
                >
                  <img src={getKingPawnImage(p.kingTokenId)} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: '50% 100%' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4, minWidth: 0 }}>
                  <strong style={{ fontSize: 16, color: '#5A3A1C' }}>{p.name}</strong>
                  <span style={{ fontSize: 12.5, color: pc, fontWeight: 600 }}>🏅 {badgeFor(p, rank)}</span>
                  <KingCoinRow collected={p.kingCoins} size={18} gap={3} />
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Trirong',serif", fontSize: 18, fontWeight: 700, color: '#B8860B' }}>🪙 {toThai(p.coins)}</div>
                  <div style={{ fontSize: 13, color: '#7A5B33' }}>👑 {TH[p.kingCoins.length]}/๗</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="go-actions" style={{ zIndex: 1 }}>
        <button onClick={() => setupGame(players.length, players.map((p) => p.kingTokenId))} style={primaryBtn()}>
          🔁 เล่นอีกครั้ง
        </button>
        <button onClick={backToHome} style={ghostBtn()}>
          🏠 หน้าแรก
        </button>
      </div>
    </div>
  );
}

// สรุปผลโหมดเดี่ยว — ดาว + สถิติ
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
  const pc = PC[player.id] ?? '#C0912E';

  return (
    <div style={{ ...screenStyle(), justifyContent: 'center' }}>
      <RoyalBackdrop />

      <header style={{ textAlign: 'center', animation: 'go-fadeUp .5s .02s both', zIndex: 1 }}>
        <div style={{ fontFamily: "'Chonburi',serif", fontSize: 'clamp(30px,6vw,46px)', color: '#8A1414', textShadow: '0 2px 0 rgba(201,154,58,.35)' }}>
          จบการเดินทาง
        </div>
        <div style={{ fontSize: 44, letterSpacing: 8, marginTop: 6 }}>
          {'⭐'.repeat(stars)}
          <span style={{ opacity: 0.22 }}>{'⭐'.repeat(3 - stars)}</span>
        </div>
      </header>

      <div
        style={{
          position: 'relative',
          width: 'min(460px, 94vw)',
          marginTop: 16,
          zIndex: 1,
          background: 'linear-gradient(180deg,#FFFDF6,#FBF3DF)',
          border: `2px solid ${pc}`,
          borderRadius: 24,
          padding: '24px 26px 26px',
          textAlign: 'center',
          boxShadow: `0 14px 34px ${hexA(pc, 0.3)}`,
          animation: 'go-popIn .45s .1s both',
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div
            style={{
              position: 'relative', width: 118, height: 118, borderRadius: '50%',
              background: 'radial-gradient(115% 78% at 50% 20%, #FCF6E6 0%, #F1E5C5 60%, #E8D9B4 100%)',
              border: '3px solid #E9CE7E', display: 'grid', placeItems: 'center', overflow: 'hidden',
              boxShadow: 'inset 0 2px 8px rgba(120,80,30,.25)',
            }}
          >
            <img
              src={getKingPawnImage(player.kingTokenId)}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: '50% 100%', animation: 'go-shine 2.6s ease-in-out infinite' }}
            />
          </div>
        </div>
        <div style={{ fontFamily: "'Chonburi',serif", fontSize: 22, color: '#8A1414', marginTop: 10 }}>{player.name}</div>
        <div style={{ fontFamily: "'Trirong',serif", fontSize: 14.5, fontWeight: 600, color: '#7A5B33' }}>
          {kingName(player.kingTokenId)}
        </div>
        <div
          style={{
            display: 'inline-block', marginTop: 8, padding: '5px 16px', borderRadius: 999,
            background: hexA(pc, 0.14), color: pc, fontWeight: 700, fontSize: 13.5,
          }}
        >
          🏅 {badge}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16 }}>
          <Stat value={`🪙 ${toThai(player.coins)}`} label="เหรียญราชภักดิ์" />
          <Stat value={`👑 ${TH[kings]}/๗`} label="เหรียญกษัตริย์" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <KingCoinRow collected={player.kingCoins} size={30} gap={6} />
        </div>
      </div>

      <div className="go-actions" style={{ zIndex: 1 }}>
        <button onClick={onReplay} style={primaryBtn()}>
          🔁 เล่นอีกครั้ง
        </button>
        <button onClick={onHome} style={ghostBtn()}>
          🏠 หน้าแรก
        </button>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'Trirong',serif", fontSize: 22, fontWeight: 700, color: '#B8860B' }}>{value}</div>
      <div style={{ fontSize: 12.5, color: '#7A5B33' }}>{label}</div>
    </div>
  );
}

function primaryBtn(): React.CSSProperties {
  return {
    fontFamily: "'Trirong',serif",
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '.5px',
    color: '#FBEECB',
    background: 'linear-gradient(180deg,#A81E1E,#7E0F0F)',
    border: 'none',
    borderRadius: 16,
    padding: '14px 30px',
    minHeight: 56,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(138,20,20,.35)',
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    fontFamily: "'Sarabun',sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#7A5B1E',
    background: '#FFFDF6',
    border: '1.5px solid #C79A3A',
    borderRadius: 16,
    padding: '14px 28px',
    minHeight: 56,
    cursor: 'pointer',
  };
}
