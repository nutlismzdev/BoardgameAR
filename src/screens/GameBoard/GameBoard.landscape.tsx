import { useEffect, useState } from 'react';
import { useGame } from '@/core/store';
import type { FxKind } from '@/core/store';
import { BoardImage } from '@/components/BoardImage';
import { DiceButton } from '@/components/DiceButton';
import { CardModal } from '@/components/CardModal';
import { KingCollection } from '@/components/KingCollection';
import { TableBackdrop } from '@/components/TableBackdrop';
import { Confetti } from '@/components/Confetti';
import { Mascot } from '@/components/Mascot';
import { ItemBar } from '@/components/ItemBar';
import { ShopModal } from '@/components/ShopModal';
import { SettingsPanel } from '@/screens/Settings/Settings';
import { getKingPawnImage, getKingCoinImage } from '@/core/kingAssets';
import { KingCoinRow } from '@/components/KingCoinRow';
import { KINGS } from '@/core/content';
import { color, radius } from '@/theme/tokens';

const RATIO = 1489 / 1046; // สัดส่วนภาพกระดาน

// ── จอเล่นหลัก (แนวนอน) — ภาพกระดานเป็นพระเอก + การ์ด 3D สะสมมหาราชด้านขวา ──
export function GameBoardLandscape() {
  const players = useGame((s) => s.players);
  const currentIdx = useGame((s) => s.currentPlayerIndex);
  const player = players[currentIdx];
  const backToHome = useGame((s) => s.backToHome);
  const fx = useGame((s) => s.fx);
  const streak = useGame((s) => s.streak);
  const phase = useGame((s) => s.phase);
  const pendingFork = useGame((s) => s.pendingFork);
  const chooseBranch = useGame((s) => s.chooseBranch);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  // เอฟเฟกต์ฉลอง: คอนเฟตติ + เหรียญเด้ง + จอสั่นตอนปลดล็อก
  const [bursts, setBursts] = useState<{ id: number; kind: FxKind }[]>([]);
  const [coinPops, setCoinPops] = useState<{ id: number; n: number }[]>([]);
  const [shake, setShake] = useState(false);
  const [wonCoin, setWonCoin] = useState<{ id: number; kingId: string } | null>(null);
  useEffect(() => {
    if (!fx) return;
    if (fx.kind !== 'wrong') setBursts((b) => [...b, { id: fx.id, kind: fx.kind }]);
    if (fx.coins > 0) setCoinPops((c) => [...c, { id: fx.id, n: fx.coins }]);
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (fx.kind === 'unlock') {
      setShake(true);
      timers.push(setTimeout(() => setShake(false), 500));
    }
    // ชนะเหรียญกษัตริย์ → เด้งเหรียญพระองค์นั้นฉลองกลางจอ
    if (fx.kingId) {
      setWonCoin({ id: fx.id, kingId: fx.kingId });
      timers.push(setTimeout(() => setWonCoin(null), 2200));
    }
    return () => timers.forEach(clearTimeout);
  }, [fx?.id]);

  // ความกว้างแถบขวา (กินพื้นที่ที่ว่างเดิม — กระดานแทบไม่เล็กลงเพราะถูกจำกัดด้วยความสูงอยู่แล้ว)
  const sidebar = Math.max(210, Math.min(300, window.innerWidth * 0.24));
  const boardArea = window.innerWidth - sidebar - 24;
  const boardSize = Math.min(boardArea, window.innerHeight * RATIO);
  // ขนาดเหรียญใน HUD ปรับตามขนาดกระดาน (responsive บนแท็บเล็ตทุกขนาด)
  const hudCoin = Math.round(Math.max(16, Math.min(24, boardSize * 0.03)));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // ผืนแผ่นดินอุดมสมบูรณ์: ทุ่งเขียวไล่สู่สายน้ำ (มุมมองบน)
        background: 'linear-gradient(155deg, #AEC983 0%, #93C089 38%, #7BB8A0 68%, #6BA8C0 100%)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        overflow: 'hidden',
        animation: shake ? 'screenShake .5s ease-in-out' : undefined,
      }}
    >
      {/* ชั้นตกแต่งพื้นหลัง (หลังทุกอย่าง) */}
      <TableBackdrop />

      {/* พื้นที่กระดาน (พระเอก) */}
      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <BoardImage size={boardSize} />

        {/* HUD เหรียญ ลอยซ้ายบนของกระดาน */}
        <div style={{ ...pill, top: 10, left: 10 }}>
          🪙 <b style={{ color: color.secondary }}>{player?.coins ?? 0}</b>
          {/* +N เหรียญเด้งลอยขึ้น */}
          {coinPops.map((c) => (
            <span
              key={c.id}
              onAnimationEnd={() => setCoinPops((arr) => arr.filter((x) => x.id !== c.id))}
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                color: '#E0A400',
                fontWeight: 800,
                fontSize: 20,
                textShadow: '0 1px 2px #fff',
                pointerEvents: 'none',
                animation: 'coinPop 1.1s ease-out forwards',
              }}
            >
              +{c.n}
            </span>
          ))}
        </div>

        {/* HUD เหรียญกษัตริย์ (เงื่อนไขชนะ) ขวาบนของกระดาน — แถวช่องเก็บเหรียญ 7 พระองค์ */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px 5px 10px',
            borderRadius: radius.pill,
            background: 'linear-gradient(160deg, rgba(255,255,255,.96), rgba(255,246,222,.96))',
            border: '1.5px solid rgba(201,162,39,.55)',
            boxShadow: '0 4px 14px rgba(90,60,20,.28)',
            backdropFilter: 'blur(4px)',
            maxWidth: 'calc(100% - 20px)',
          }}
        >
          <KingCoinRow
            collected={player?.kingCoins ?? []}
            size={hudCoin}
            gap={Math.round(hudCoin * 0.22)}
          />
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              paddingLeft: 8,
              borderLeft: '1.5px solid rgba(201,162,39,.4)',
              fontSize: Math.max(15, Math.round(hudCoin * 0.82)),
              fontWeight: 900,
              color: color.primary,
              whiteSpace: 'nowrap',
            }}
          >
            👑 {player?.kingCoins.length ?? 0}/7
          </span>
        </div>

        {/* คอมโบ (ตอบถูกติดกัน) */}
        {streak >= 2 && (
          <div
            style={{
              ...pill,
              top: 54,
              left: 10,
              background: color.primary,
              color: '#fff',
              animation: 'comboPulse .5s ease',
            }}
          >
            🔥 คอมโบ ×{streak} ({streak >= 4 ? '×3' : streak === 3 ? '×2' : '×1.5'} เหรียญ)
          </div>
        )}

        {/* มาสคอตนำทาง */}
        <Mascot />
      </div>

      {/* แถบขวา — การ์ด 3D สะสมมหาราช + ควบคุม */}
      <aside
        style={{
          width: sidebar,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingTop: 4,
          paddingBottom: 4,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* แถวบน: ตั้งค่า + ออก (เอาตัวนับเทิร์นออกแล้ว) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => setSettingsOpen(true)} style={iconBtn} aria-label="ตั้งค่า">
            ⚙️
          </button>
          <button onClick={backToHome} style={iconBtn} aria-label="กลับหน้าแรก">
            🏠
          </button>
        </div>

        {/* แถบผู้เล่น (หลายคน) — ไฮไลต์คนที่ถึงตา */}
        {players.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {players.map((p, i) => (
              <div
                key={p.id}
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: radius.pill,
                  fontWeight: 700,
                  fontSize: 14,
                  background: i === currentIdx ? color.primary : 'rgba(255,255,255,.75)',
                  color: i === currentIdx ? '#fff' : color.text,
                  boxShadow: i === currentIdx ? '0 2px 8px rgba(139,0,0,.35)' : 'none',
                }}
              >
                <img
                  src={getKingPawnImage(p.kingTokenId)}
                  alt=""
                  draggable={false}
                  style={{ width: 24, height: 30, objectFit: 'contain', display: 'block' }}
                />
                <span>👑{p.kingCoins.length}</span>
                <span style={{ opacity: 0.85 }}>🪙{p.coins}</span>
              </div>
            ))}
          </div>
        )}

        {/* การ์ดสะสมมหาราช (ยืดเต็มความสูงที่เหลือ) */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <KingCollection />
        </div>

        {/* ร้านค้าไอเทม (ใช้เหรียญซื้อ) + แถบไอเทมที่มี */}
        <button onClick={() => setShopOpen(true)} style={shopBtn}>
          🛒 ร้านค้าไอเทม
        </button>
        <ItemBar />

        {/* ปุ่มทอยลูกเต๋า (การ์ด 3D) */}
        <div
          style={{
            background: 'linear-gradient(160deg, #FFFDF8, #F3E7CF)',
            borderRadius: radius.lg,
            border: `1.5px solid ${color.secondary}55`,
            boxShadow: '0 8px 20px rgba(90,60,20,.2), inset 0 1px 0 #fff',
            padding: '10px 8px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <DiceButton size={56} />
        </div>
      </aside>

      <CardModal orientation="landscape" />
      {phase === 'forking' && pendingFork && (
        <ForkOverlay options={pendingFork.options} onChoose={(d) => chooseBranch(d)} />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {shopOpen && <ShopModal onClose={() => setShopOpen(false)} />}

      {/* คอนเฟตติฉลอง */}
      {bursts.map((b) => (
        <Confetti
          key={b.id}
          kind={b.kind}
          onDone={() => setBursts((arr) => arr.filter((x) => x.id !== b.id))}
        />
      ))}

      {/* โมเมนต์ชนะเหรียญกษัตริย์ — เหรียญพระองค์นั้นหมุนเด้งใหญ่กลางจอ */}
      {wonCoin && (
        <div style={winOverlay} onClick={() => setWonCoin(null)}>
          <img
            src={getKingCoinImage(wonCoin.kingId)}
            alt=""
            draggable={false}
            style={{
              width: 'min(220px, 42vw)',
              height: 'min(220px, 42vw)',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 22px rgba(255,193,7,.95))',
              animation: 'coinWin 2.2s ease-out',
            }}
          />
          <div style={{ color: '#FFE9A8', fontSize: 26, fontWeight: 900, textShadow: '0 2px 8px rgba(0,0,0,.6)' }}>
            🎉 ได้เหรียญกษัตริย์!
          </div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, textShadow: '0 2px 6px rgba(0,0,0,.6)' }}>
            {KINGS.find((k) => k.id === wonCoin.kingId)?.name.split('(')[0].trim()}
          </div>
        </div>
      )}

      <style>{`
        @keyframes screenShake{0%,100%{transform:translate(0,0)}20%{transform:translate(-6px,3px)}40%{transform:translate(6px,-3px)}60%{transform:translate(-4px,-2px)}80%{transform:translate(4px,2px)}}
        @keyframes coinPop{0%{transform:translate(-50%,0);opacity:0}20%{opacity:1}100%{transform:translate(-50%,-38px);opacity:0}}
        @keyframes comboPulse{0%{transform:scale(1.25)}100%{transform:scale(1)}}
        @keyframes coinWin{0%{transform:scale(.2) rotateY(0);opacity:0}22%{opacity:1}62%{transform:scale(1.18) rotateY(720deg)}100%{transform:scale(1) rotateY(720deg);opacity:1}}
      `}</style>
    </div>
  );
}

// ── ป้ายบอกรายละเอียดของแต่ละเส้นทางแยก (key = ช่องปลายทาง) ──
const FORK_INFO: Record<number, { icon: string; title: string; desc: string; tint: string }> = {
  // เส้นหลัก (เดินตามวงนอกตามปกติ — สั้นกว่า)
  33: { icon: '🛣️', title: 'เส้นหลัก', desc: 'เดินวงนอกตามปกติ — ทางสั้น', tint: '#1565C0' },
  37: { icon: '🛣️', title: 'เส้นหลัก', desc: 'เดินวงนอกตามปกติ — ทางสั้น', tint: '#1565C0' },
  7: { icon: '🛣️', title: 'เส้นหลัก', desc: 'เดินวงนอกตามปกติ — ทางสั้น', tint: '#1565C0' },
  13: { icon: '🛣️', title: 'เส้นหลัก', desc: 'เดินวงนอกตามปกติ — ทางสั้น', tint: '#1565C0' },
  // ทางอ้อมลับวงใน (ยาวกว่า — ตัดเข้าด้านในกระดาน)
  46: { icon: '🗺️', title: 'ทางลับ', desc: 'ตัดเข้าวงใน — ทางอ้อม เสี่ยงลุ้น', tint: '#C9A227' },
  55: { icon: '🗺️', title: 'ทางลับ', desc: 'ตัดเข้าวงใน — ทางอ้อม เสี่ยงลุ้น', tint: '#C9A227' },
  61: { icon: '🗺️', title: 'ทางลับ', desc: 'ตัดเข้าวงใน — ทางอ้อม เสี่ยงลุ้น', tint: '#C9A227' },
  70: { icon: '🗺️', title: 'ทางลับ', desc: 'ตัดเข้าวงใน — ทางอ้อม เสี่ยงลุ้น', tint: '#C9A227' },
};

// จอเลือกทางแยก — เด้งขึ้นเมื่อหมากถึงช่องแยก ให้ผู้เล่นเลือกซ้าย/ขวา
function ForkOverlay({ options, onChoose }: { options: number[]; onChoose: (dest: number) => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        zIndex: 120,
        padding: 24,
      }}
    >
      <h2 style={{ color: '#fff', fontSize: 26, margin: 0, textShadow: '0 2px 6px rgba(0,0,0,.5)' }}>
        🔀 เลือกเส้นทาง!
      </h2>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
        {options.map((dest) => {
          const info = FORK_INFO[dest] ?? {
            icon: '➡️',
            title: `เส้นทาง ${dest}`,
            desc: 'ไปช่องนี้',
            tint: color.primary,
          };
          return (
            <button
              key={dest}
              onClick={() => onChoose(dest)}
              style={{
                fontFamily: 'inherit',
                width: 220,
                maxWidth: '42vw',
                background: '#fff',
                border: `3px solid ${info.tint}`,
                borderRadius: radius.lg,
                padding: '20px 16px',
                cursor: 'pointer',
                boxShadow: '0 10px 28px rgba(0,0,0,.35)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 44 }}>{info.icon}</span>
              <strong style={{ fontSize: 20, color: info.tint }}>{info.title}</strong>
              <span style={{ fontSize: 15, color: color.textMuted, textAlign: 'center' }}>
                {info.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const pill: React.CSSProperties = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(255,255,255,.9)',
  borderRadius: radius.pill,
  boxShadow: '0 3px 10px rgba(0,0,0,.18)',
  padding: '8px 16px',
  fontWeight: 700,
  fontSize: 18,
  color: color.text,
  backdropFilter: 'blur(4px)',
};

const iconBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 17,
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(255,255,255,.9)',
  boxShadow: '0 3px 10px rgba(0,0,0,.18)',
  cursor: 'pointer',
};

const shopBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 800,
  color: '#6B4E1E',
  background: 'linear-gradient(160deg, #FFE9A8, #E9B93C)',
  border: '1.5px solid #C9A227',
  borderRadius: radius.pill,
  padding: '9px 0',
  minHeight: 42,
  cursor: 'pointer',
  boxShadow: '0 3px 10px rgba(160,110,20,.25)',
};

// ฉากมืดฉลองตอนชนะเหรียญกษัตริย์ (แตะเพื่อปิด · หายเองใน 2.2 วิ)
const winOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  background: 'radial-gradient(circle at center, rgba(60,40,5,.55), rgba(0,0,0,.75))',
};
