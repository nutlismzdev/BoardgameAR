import { useEffect, useRef, useState } from 'react';
import { useGame, clampTargetCoins } from '@/core/store';
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
import { useViewportSize } from '@/hooks/useViewportSize';
import { color, radius } from '@/theme/tokens';

const RATIO = 1489 / 1046; // สัดส่วนภาพกระดาน

// ── จอเล่นหลัก (แนวนอน) — ภาพกระดานเป็นพระเอก + การ์ด 3D สะสมมหาราชด้านขวา ──
export function GameBoardLandscape() {
  const players = useGame((s) => s.players);
  const currentIdx = useGame((s) => s.currentPlayerIndex);
  const player = players[currentIdx];
  const requestExit = useGame((s) => s.requestExit);
  const fx = useGame((s) => s.fx);
  const streak = useGame((s) => s.streak);
  const phase = useGame((s) => s.phase);
  const pendingFork = useGame((s) => s.pendingFork);
  const chooseBranch = useGame((s) => s.chooseBranch);
  const pendingEvent = useGame((s) => s.pendingEvent);
  const closeEvent = useGame((s) => s.closeEvent);
  // เป้าหมายเหรียญที่ครูตั้งไว้ — HUD ต้องบอกเป้าจริง ไม่ใช่ 7 ตายตัว ไม่งั้นเด็กไม่รู้ว่าใกล้ชนะแค่ไหน
  const target = useGame((s) => clampTargetCoins(s.settings.targetCoins));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const playerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const previousPlayerRef = useRef(currentIdx);
  const [turnNotice, setTurnNotice] = useState<string | null>(null);

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

  useEffect(() => {
    playerRefs.current[currentIdx]?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });

    if (players.length > 1 && previousPlayerRef.current !== currentIdx) {
      setTurnNotice(`ถึงตา ${players[currentIdx]?.name ?? 'ผู้เล่น'} แล้ว`);
      const t = setTimeout(() => setTurnNotice(null), 1800);
      previousPlayerRef.current = currentIdx;
      return () => clearTimeout(t);
    }
    previousPlayerRef.current = currentIdx;
  }, [currentIdx, players]);

  // ความกว้างแถบขวา (กินพื้นที่ที่ว่างเดิม — กระดานแทบไม่เล็กลงเพราะถูกจำกัดด้วยความสูงอยู่แล้ว)
  // อ่านผ่าน hook เพื่อให้ขนาดกระดานอัปเดตเมื่อ resize จริง (ไม่ค้างค่าเก่า)
  const { w: vw, h: vh } = useViewportSize();
  const sidebar = Math.max(280, Math.min(340, vw * 0.26));
  const boardArea = vw - sidebar - 24;
  const boardSize = Math.min(boardArea, vh * RATIO);
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
      <div style={motionFrame} />

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
          <span>{renderHearts(player?.hearts ?? 3)}</span>
          <span style={{ opacity: 0.35 }}>|</span>
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
            👑 {player?.kingCoins.length ?? 0}/{target}
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
          <button onClick={requestExit} style={iconBtn} aria-label="กลับหน้าแรก">
            🏠
          </button>
        </div>

        {/* แถบผู้เล่น (หลายคน) — แยกสถานะให้ครูเห็นชัด ไม่เบียดการ์ดเหรียญกษัตริย์ */}
        {players.length > 1 && (
          <section style={playerPanel}>
            <div style={playerPanelHeader}>
              <span>ผู้เล่น</span>
              <strong style={currentTurnText}>ถึงตา {player?.name ?? 'ผู้เล่น'}</strong>
            </div>
            <div style={playerStrip}>
              {players.map((p, i) => {
                const active = i === currentIdx;
                return (
                  <div
                    key={p.id}
                    ref={(el) => {
                      playerRefs.current[i] = el;
                    }}
                    style={active ? activePlayerCard : playerCard}
                  >
                    <img
                      src={getKingPawnImage(p.kingTokenId)}
                      alt=""
                      draggable={false}
                      style={{ width: 22, height: 28, objectFit: 'contain', display: 'block', flexShrink: 0 }}
                    />
                    <div style={playerMain}>
                      <div style={playerName}>{p.name}</div>
                      <div style={active ? activeTurnLabel : turnLabel}>
                        {active ? 'กำลังเล่น' : p.skipNext > 0 ? 'พักฟื้น' : 'รอเล่น'}
                      </div>
                    </div>
                    <div style={playerStats}>
                      <span style={active ? activePlayerBadge : playerBadge} title="หัวใจ">
                        ❤️ {p.hearts}
                      </span>
                      <span style={active ? activePlayerBadge : playerBadge} title="เหรียญ">
                        🪙 {p.coins}
                      </span>
                      <span style={active ? activePlayerBadge : playerBadge} title="เหรียญกษัตริย์">
                        👑 {p.kingCoins.length}/{target}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* การ์ดสะสมมหาราช (ยืดเต็มความสูงที่เหลือ) */}
        <div style={collectionSlot}>
          <KingCollection />
        </div>

        <div style={bottomControls}>
          {/* แถบไอเทมที่มี — ซื้อไอเทมได้เฉพาะเมื่อหยุดที่ "ช่องร้านค้า" 🛒 บนกระดาน */}
          <ItemBar />

          {/* ปุ่มทอยลูกเต๋า (การ์ด 3D) */}
          <div style={diceCard}>
            <DiceButton size={52} />
          </div>
        </div>
      </aside>

      <CardModal orientation="landscape" />
      {phase === 'forking' && pendingFork && (
        <ForkOverlay options={pendingFork.options} onChoose={(d) => chooseBranch(d)} />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {/* ร้านค้าเปิดเฉพาะตอนหยุดที่ช่องร้านค้า — ปิดร้าน = จบเทิร์น */}
      {pendingEvent?.kind === 'shop' && <ShopModal onClose={closeEvent} />}

      {turnNotice && (
        <div style={turnToast}>
          <span style={{ fontSize: 26 }}>🎲</span>
          <span>{turnNotice}</span>
        </div>
      )}

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
        @keyframes turnToastIn{0%{transform:translate(-50%,-14px) scale(.96);opacity:0}12%,82%{transform:translate(-50%,0) scale(1);opacity:1}100%{transform:translate(-50%,-8px) scale(.98);opacity:0}}
        @keyframes frameShimmer{0%,100%{opacity:.36}50%{opacity:.7}}
        @keyframes panelFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes softGlow{0%,100%{box-shadow:0 8px 20px rgba(90,60,20,.2),inset 0 1px 0 #fff}50%{box-shadow:0 12px 26px rgba(139,0,0,.22),0 0 16px rgba(255,218,120,.32),inset 0 1px 0 #fff}}
        @keyframes forkBackdropIn{0%{opacity:0}100%{opacity:1}}
        @keyframes forkTitleIn{0%{transform:translateY(-12px) scale(.9);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
        @keyframes forkCardIn{0%{transform:translateY(26px) scale(.9);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
        @keyframes forkIconSpin{0%{transform:rotate(-8deg) scale(1)}50%{transform:rotate(8deg) scale(1.08)}100%{transform:rotate(-8deg) scale(1)}}
        .fork-card{transition:transform .16s ease, box-shadow .16s ease;}
        .fork-card:hover{transform:translateY(-7px) scale(1.035);}
        .fork-card:active{transform:translateY(-2px) scale(1.01);}
      `}</style>
    </div>
  );
}

// ── ป้ายบอกรายละเอียดของแต่ละเส้นทางแยก (key = ช่องปลายทาง) ──
type ForkInfo = {
  icon: string;
  title: string;
  desc: string;
  tint: string;
  tintDark: string; // สีเข้มสำหรับไล่เฉดหัวการ์ด
  badge: string; // ป้ายมุมบน (สั้น/ยาว)
  pace: string; // เมตาบรรทัดล่าง
};
const MAIN_PATH: Omit<ForkInfo, 'title' | 'desc'> = {
  icon: '🛣️',
  tint: '#1565C0',
  tintDark: '#0D3C82',
  badge: '⚡ ทางสั้น',
  pace: 'ปลอดภัย ถึงไว',
};
const SECRET_PATH: Omit<ForkInfo, 'title' | 'desc'> = {
  icon: '🗺️',
  tint: '#C9A227',
  tintDark: '#9A7A15',
  badge: '🎲 ทางอ้อม',
  pace: 'เสี่ยงลุ้น เจอช่องพิเศษ',
};
const mainInfo = (): ForkInfo => ({ ...MAIN_PATH, title: 'เส้นหลัก', desc: 'เดินวงนอกตามปกติ' });
const secretInfo = (): ForkInfo => ({ ...SECRET_PATH, title: 'ทางลับวงใน', desc: 'ตัดลัดเข้าด้านในกระดาน' });
const FORK_INFO: Record<number, ForkInfo> = {
  // เส้นหลัก (เดินตามวงนอกตามปกติ — สั้นกว่า)
  33: mainInfo(),
  37: mainInfo(),
  7: mainInfo(),
  13: mainInfo(),
  // ทางอ้อมลับวงใน (ยาวกว่า — ตัดเข้าด้านในกระดาน)
  46: secretInfo(),
  55: secretInfo(),
  61: secretInfo(),
  70: secretInfo(),
};

function renderHearts(hearts: number): string {
  return `${'❤️'.repeat(Math.max(0, hearts))}${'♡'.repeat(Math.max(0, 3 - hearts))}`;
}

// จอเลือกทางแยก — เด้งขึ้นเมื่อหมากถึงช่องแยก ให้ผู้เล่นเลือกซ้าย/ขวา
function ForkOverlay({ options, onChoose }: { options: number[]; onChoose: (dest: number) => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(circle at 50% 38%, rgba(30,18,6,.55), rgba(0,0,0,.72))',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        zIndex: 120,
        padding: 24,
        animation: 'forkBackdropIn .25s ease',
      }}
    >
      {/* หัวเรื่อง */}
      <div style={{ textAlign: 'center', animation: 'forkTitleIn .32s cubic-bezier(.2,.8,.3,1.2)' }}>
        <h2
          style={{
            color: '#FFE9A8',
            fontSize: 30,
            margin: 0,
            fontWeight: 800,
            letterSpacing: '.5px',
            textShadow: '0 2px 10px rgba(0,0,0,.6)',
          }}
        >
          🔀 เลือกเส้นทาง
        </h2>
        <p style={{ color: 'rgba(255,255,255,.82)', fontSize: 15, margin: '6px 0 0', fontWeight: 600 }}>
          หมากถึงทางแยกแล้ว — แตะการ์ดเพื่อเลือกทางเดินต่อ
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {options.map((dest, i) => {
          const info: ForkInfo =
            FORK_INFO[dest] ?? {
              icon: '➡️',
              title: `เส้นทาง ${dest}`,
              desc: 'ไปช่องนี้',
              tint: color.primary,
              tintDark: color.primary,
              badge: 'เส้นทาง',
              pace: `ช่อง ${dest}`,
            };
          return (
            <button
              key={dest}
              className="fork-card"
              onClick={() => onChoose(dest)}
              style={{
                position: 'relative',
                fontFamily: 'inherit',
                width: 250,
                maxWidth: '44vw',
                background: '#fff',
                border: `2.5px solid ${info.tint}`,
                borderRadius: radius.lg,
                padding: 0,
                cursor: 'pointer',
                overflow: 'hidden',
                boxShadow: `0 14px 34px rgba(0,0,0,.4), 0 0 0 4px ${info.tint}22`,
                display: 'flex',
                flexDirection: 'column',
                animation: `forkCardIn .4s cubic-bezier(.2,.8,.3,1.2) ${0.08 + i * 0.09}s both`,
              }}
            >
              {/* ป้ายมุมบนขวา (สั้น/อ้อม) */}
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#fff',
                  background: 'rgba(0,0,0,.28)',
                  borderRadius: radius.pill,
                  padding: '3px 10px',
                  zIndex: 2,
                }}
              >
                {info.badge}
              </span>

              {/* หัวการ์ดไล่เฉดสี + ไอคอน */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${info.tint}, ${info.tintDark})`,
                  padding: '22px 16px 18px',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 50,
                    filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.35))',
                    animation: 'forkIconSpin 3s ease-in-out infinite',
                  }}
                >
                  {info.icon}
                </span>
              </div>

              {/* เนื้อหา */}
              <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <strong style={{ fontSize: 21, color: info.tint }}>{info.title}</strong>
                <span style={{ fontSize: 14.5, color: color.textMuted, lineHeight: 1.4 }}>{info.desc}</span>
                <span
                  style={{
                    marginTop: 8,
                    alignSelf: 'flex-start',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: info.tint,
                    background: `${info.tint}14`,
                    borderRadius: radius.pill,
                    padding: '5px 12px',
                  }}
                >
                  {info.pace}
                </span>
              </div>
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

const motionFrame: React.CSSProperties = {
  position: 'absolute',
  inset: 6,
  borderRadius: 18,
  border: '2px solid rgba(255,232,150,.18)',
  boxShadow: 'inset 0 0 22px rgba(255,232,150,.28), 0 0 24px rgba(120,190,170,.18)',
  pointerEvents: 'none',
  zIndex: 1,
  animation: 'frameShimmer 3.8s ease-in-out infinite',
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
  animation: 'panelFloat 4s ease-in-out infinite',
};

const collectionSlot: React.CSSProperties = {
  flex: '1 1 0',
  minHeight: 0,
  overflow: 'hidden',
};

const bottomControls: React.CSSProperties = {
  flex: '0 0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const diceCard: React.CSSProperties = {
  background: 'linear-gradient(160deg, #FFFDF8, #F3E7CF)',
  borderRadius: radius.lg,
  border: `1.5px solid ${color.secondary}55`,
  boxShadow: '0 8px 20px rgba(90,60,20,.2), inset 0 1px 0 #fff',
  padding: '8px 8px',
  minHeight: 80,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  animation: 'softGlow 2.8s ease-in-out infinite',
};

const playerPanel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 8,
  borderRadius: radius.md,
  background: 'linear-gradient(160deg, rgba(255,255,255,.9), rgba(255,248,232,.9))',
  border: '1.5px solid rgba(201,162,39,.38)',
  boxShadow: '0 5px 14px rgba(90,60,20,.18)',
  flex: '0 0 auto',
  animation: 'panelFloat 5s ease-in-out infinite',
};

const playerPanelHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 12,
  fontWeight: 900,
  color: color.primary,
  lineHeight: 1.1,
};

const currentTurnText: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'right',
};

const playerStrip: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 5,
  overflowY: 'auto',
  maxHeight: 'min(152px, 21vh)',
  paddingRight: 1,
};

const playerCard: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr)',
  alignItems: 'center',
  gap: '3px 5px',
  padding: '6px 6px',
  minHeight: 66,
  maxWidth: '100%',
  boxSizing: 'border-box',
  borderRadius: radius.sm,
  background: 'rgba(255,255,255,.86)',
  border: '1.5px solid rgba(201,162,39,.25)',
  boxShadow: '0 2px 8px rgba(90,60,20,.14)',
  color: color.text,
};

const activePlayerCard: React.CSSProperties = {
  ...playerCard,
  background: 'linear-gradient(160deg, rgba(139,0,0,.96), rgba(117,31,17,.96))',
  border: '1.5px solid rgba(255,233,168,.75)',
  boxShadow: '0 4px 14px rgba(139,0,0,.36)',
  color: '#fff',
};

const playerName: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1.12,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const turnLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  color: color.textMuted,
  marginTop: 1,
};

const activeTurnLabel: React.CSSProperties = {
  ...turnLabel,
  color: '#FFE9A8',
};

const playerStats: React.CSSProperties = {
  gridColumn: '1 / -1',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  alignItems: 'center',
  gap: 3,
  fontSize: 10,
  fontWeight: 900,
  whiteSpace: 'nowrap',
  minWidth: 0,
};

const playerMain: React.CSSProperties = {
  minWidth: 0,
};

const playerBadge: React.CSSProperties = {
  minWidth: 0,
  textAlign: 'center',
  padding: '3px 2px',
  borderRadius: radius.pill,
  background: 'rgba(255,255,255,.78)',
  border: '1px solid rgba(201,162,39,.25)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.85)',
  overflow: 'hidden',
  textOverflow: 'clip',
};

const activePlayerBadge: React.CSSProperties = {
  ...playerBadge,
  background: 'rgba(255,255,255,.16)',
  border: '1px solid rgba(255,233,168,.48)',
  color: '#fff',
};

const turnToast: React.CSSProperties = {
  position: 'fixed',
  top: 18,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 260,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 20px',
  borderRadius: radius.pill,
  background: 'linear-gradient(160deg, rgba(139,0,0,.96), rgba(117,31,17,.96))',
  color: '#fff',
  border: '1.5px solid rgba(255,233,168,.8)',
  boxShadow: '0 8px 24px rgba(0,0,0,.32)',
  fontSize: 22,
  fontWeight: 900,
  pointerEvents: 'none',
  animation: 'turnToastIn 1.8s ease forwards',
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
