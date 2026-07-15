import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/core/store';
import { KINGS } from '@/core/content';
import { getKingPawnImage } from '@/core/kingAssets';
import { sfx } from '@/core/sfx';
import { enterFullscreen } from '@/core/viewportLock';
import { SettingsPanel } from '@/screens/Settings/Settings';
import { MuseumShowcase } from '@/components/MuseumShowcase';

// สีประจำผู้เล่น 1–4 (ตามดีไซน์ "ตั้งค่าเกม")
const PC = ['#C0912E', '#B23A2E', '#2C5AA0', '#2E7D50'];
// สีป้ายยุคสมัย
const ERA_COLOR: Record<string, string> = {
  สุโขทัย: '#B5651D',
  อยุธยา: '#9A7B24',
  ธนบุรี: '#2E6E6E',
  รัตนโกสินทร์: '#2C5AA0',
};

const TH = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
const toThai = (s: string | number) => String(s).replace(/[0-9]/g, (d) => TH[+d]);

// แยกพระนามยาว: ดึงส่วนในวงเล็บ (เช่น "รัชกาลที่ ๕") ออกมาโชว์เป็นบรรทัดเล็ก
// ชื่อหลักจะสั้นลง อ่านง่าย ไม่ต้องตัดคำแบบเสียความสมพระเกียรติ
function splitKingName(name: string): { main: string; rank: string | null } {
  const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return m ? { main: m[1].trim(), rank: m[2].trim() } : { main: name, rank: null };
}

// แปลง rgba จาก hex + alpha
function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// keyframes + responsive rules (ฝังในหน้าเดียว)
const STYLE = `
@keyframes home-fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes home-popIn { 0% { opacity: 0; transform: scale(.9); } 60% { transform: scale(1.02); } 100% { opacity: 1; transform: scale(1); } }
@keyframes home-shakeX { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
@keyframes home-spin { to { transform: rotate(360deg); } }
@keyframes home-glowPulse { 0%,100% { box-shadow: 0 0 0 3px rgba(138,20,20,.16), 0 8px 22px rgba(120,30,20,.20); } 50% { box-shadow: 0 0 0 6px rgba(138,20,20,.10), 0 10px 26px rgba(120,30,20,.28); } }
@keyframes home-floatDust { from { background-position: 0 0, 0 0; } to { background-position: 60px -80px, -40px 60px; } }
.home-main { display: flex; gap: 22px; }
.home-gallery { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.home-aside { width: 372px; flex-shrink: 0; }
@media (max-width: 1024px) {
  .home-gallery { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 860px) {
  .home-main { flex-direction: column; }
  .home-aside { width: 100%; }
}
@media (max-width: 560px) {
  .home-gallery { grid-template-columns: repeat(2, 1fr); }
}
.home-name-input { width: 100%; border: none; border-bottom: 1.5px solid #D9C79A; background: transparent; font-family: 'Sarabun', sans-serif; font-weight: 700; font-size: 14px; color: #5A3A1C; padding: 1px 0 3px; outline: none; }
.home-name-input::placeholder { color: #B7A47A; font-weight: 600; }
.home-name-input:focus { border-bottom-width: 2px; }
`;

export function Home() {
  const setupGame = useGame((s) => s.setupGame);
  const [showSettings, setShowSettings] = useState(false);
  const [showMuseum, setShowMuseum] = useState(false);

  const [playerCount, setPlayerCount] = useState(1);
  const [activePlayer, setActivePlayer] = useState(0);
  const [picks, setPicks] = useState<(string | null)[]>([null, null, null, null]);
  const [names, setNames] = useState<string[]>(['', '', '', '']); // ชื่อที่ผู้เล่นกรอกเอง (ว่าง = ใช้ชื่อเริ่มต้น)
  const [shakeKing, setShakeKing] = useState<string | null>(null);
  const [showStart, setShowStart] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout>>();

  const allPicked = picks.slice(0, playerCount).every(Boolean);
  const activeColor = PC[activePlayer];

  const shake = (id: string) => {
    setShakeKing(id);
    clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShakeKing(null), 420);
  };

  const setCount = (n: number) => {
    setPicks((prev) => {
      const next = prev.slice();
      for (let i = n; i < 4; i++) next[i] = null;
      return next;
    });
    setActivePlayer((prev) => {
      const cleared = picks.slice();
      for (let i = n; i < 4; i++) cleared[i] = null;
      let active = prev >= n ? 0 : prev;
      for (let s = 0; s < n; s++) {
        const c = (active + s) % n;
        if (!cleared[c]) {
          active = c;
          break;
        }
      }
      return active;
    });
    sfx.step();
    setPlayerCount(n);
  };

  const selectKing = (kingId: string) => {
    const owner = picks.findIndex((k, i) => i < playerCount && k === kingId);
    if (owner !== -1 && owner !== activePlayer) {
      sfx.wrong();
      shake(kingId);
      return;
    }
    const next = picks.slice();
    if (next[activePlayer] === kingId) {
      next[activePlayer] = null;
      sfx.step();
      setPicks(next);
      return;
    }
    next[activePlayer] = kingId;
    sfx.coin();
    let na = activePlayer;
    for (let step = 1; step <= playerCount; step++) {
      const cand = (activePlayer + step) % playerCount;
      if (!next[cand]) {
        na = cand;
        break;
      }
    }
    setPicks(next);
    setActivePlayer(na);
  };

  const start = () => {
    if (!allPicked) {
      sfx.wrong();
      const empty = picks.slice(0, playerCount).indexOf(null);
      if (empty !== -1) setActivePlayer(empty);
      return;
    }
    sfx.unlock();
    // เข้าเต็มจอ + ล็อกแนวนอนตรงนี้ เพราะเบราว์เซอร์ยอมให้ขอเต็มจอเฉพาะใน user gesture
    // (เรียกทีหลังตอน setupGame จะโดนปฏิเสธ) — ล้มเหลวก็เล่นต่อได้ปกติ
    void enterFullscreen();
    setShowStart(true);
  };

  // เมื่อโชว์ overlay "พร้อมออกศึก" → เข้าสู่กระดานจริง
  useEffect(() => {
    if (!showStart) return;
    const id = setTimeout(() => {
      setupGame(playerCount, picks.slice(0, playerCount) as string[], names.slice(0, playerCount));
    }, 950);
    return () => clearTimeout(id);
  }, [showStart, playerCount, picks, names, setupGame]);

  return (
    <div
      style={{
        // ต้องเป็น height (ไม่ใช่ minHeight) เพื่อให้ overflowY:auto สกรอลล์ในกล่องนี้เอง —
        // body ถูกล็อกเป็น position:fixed กันซูม/ยางยืด แล้ว จึงสกรอลล์ระดับหน้าไม่ได้อีก
        height: '100dvh',
        width: '100%',
        overflowY: 'auto',
        position: 'relative',
        fontFamily: "'Sarabun', sans-serif",
        color: '#3A2A18',
        background:
          'radial-gradient(125% 95% at 50% -12%, #FBF4E1 0%, #F3E7C9 52%, #ECDCB8 100%)',
      }}
    >
      <style>{STYLE}</style>

      {/* แถบหลังคาวัดด้านบน */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 12,
          background: 'repeating-linear-gradient(135deg,#8A1414 0 14px,#A83322 14px 28px)',
          opacity: 0.9,
          zIndex: 5,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg,#C79A3A,#E9CE7E,#C79A3A)',
          zIndex: 5,
        }}
      />
      {/* บรรยากาศฝุ่นทองจาง ๆ */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(rgba(180,140,70,.10) 1px,transparent 1.5px),radial-gradient(rgba(180,140,70,.06) 1px,transparent 1.5px)',
          backgroundSize: '44px 44px,28px 28px',
          backgroundPosition: '0 0,14px 14px',
          animation: 'home-floatDust 26s linear infinite',
        }}
      />

      <div
        style={{
          position: 'relative',
          minHeight: '100dvh',
          maxWidth: 1280,
          margin: '0 auto',
          padding: '30px 30px 26px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* HEADER */}
        <header style={{ textAlign: 'center', animation: 'home-fadeUp .5s .02s both', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
            <span style={{ width: 120, maxWidth: '18vw', height: 2, background: 'linear-gradient(90deg,transparent,#C79A3A)' }} />
            <span style={{ fontFamily: "'Trirong',serif", color: '#C79A3A', fontSize: 20 }}>๚</span>
            <h1
              style={{
                fontFamily: "'Chonburi',serif",
                fontSize: 'clamp(34px, 6vw, 52px)',
                lineHeight: 1,
                margin: 0,
                color: '#8A1414',
                letterSpacing: '.5px',
                textShadow: '0 2px 0 rgba(201,154,58,.35)',
              }}
            >
              ๗ มหาราช
            </h1>
            <span style={{ fontFamily: "'Trirong',serif", color: '#C79A3A', fontSize: 20 }}>๛</span>
            <span style={{ width: 120, maxWidth: '18vw', height: 2, background: 'linear-gradient(270deg,transparent,#C79A3A)' }} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 15, color: '#7A5B33', fontWeight: 500, letterSpacing: '.3px' }}>
            บอร์ดเกมเรียนรู้ประวัติศาสตร์ไทย · อุทยานราชภักดิ์
          </p>
        </header>

        {/* MAIN */}
        <div className="home-main" style={{ flex: 1, marginTop: 18, minHeight: 0 }}>
          {/* LEFT: แกลเลอรีกษัตริย์ */}
          <section
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              animation: 'home-fadeUp .5s .12s both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
              <h2 style={{ fontFamily: "'Trirong',serif", fontWeight: 700, fontSize: 19, margin: 0, color: '#5A3A1C' }}>
                เลือกกษัตริย์ประจำตัว
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: allPicked ? '#2E7D50' : activeColor,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: allPicked ? '#2E7D50' : activeColor,
                    display: 'inline-block',
                  }}
                />
                {allPicked ? 'ทุกคนพร้อมแล้ว!' : `ตาผู้เล่น ${TH[activePlayer + 1]}`}
              </div>
            </div>

            <div className="home-gallery">
              {KINGS.map((king) => {
                const owner = picks.findIndex((p, i) => i < playerCount && p === king.id);
                const claimed = owner !== -1;
                const mine = owner === activePlayer;
                const ownerColor = claimed ? PC[owner] : null;
                const { main, rank } = splitKingName(king.name);
                return (
                  <div
                    key={king.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectKing(king.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectKing(king.id);
                      }
                    }}
                    aria-label={`ผู้เล่น ${activePlayer + 1} เลือก ${king.name}`}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#FFFDF6',
                      border: `2px solid ${claimed ? ownerColor : '#E7D6AC'}`,
                      borderRadius: 16,
                      overflow: 'hidden',
                      boxShadow: claimed
                        ? `0 8px 20px ${hexA(ownerColor!, 0.28)}`
                        : '0 5px 14px rgba(90,50,20,.10)',
                      transform: mine ? 'translateY(-3px) scale(1.015)' : 'none',
                      transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
                      animation: shakeKing === king.id ? 'home-shakeX .4s' : 'none',
                    }}
                  >
                    {/* ภาพหมาก */}
                    <div
                      style={{
                        position: 'relative',
                        height: 180,
                        background:
                          'radial-gradient(115% 78% at 50% 20%, #FCF6E6 0%, #F1E5C5 60%, #E8D9B4 100%)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          bottom: 10,
                          width: 78,
                          height: 12,
                          transform: 'translateX(-50%)',
                          borderRadius: '50%',
                          background:
                            'radial-gradient(50% 50% at 50% 50%,rgba(80,45,15,.26),transparent 72%)',
                        }}
                      />
                      <img
                        src={getKingPawnImage(king.id)}
                        alt=""
                        draggable={false}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          objectPosition: '50% 100%',
                          display: 'block',
                        }}
                      />
                      {/* ทับสีเจ้าของ */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          pointerEvents: 'none',
                          background: claimed ? hexA(ownerColor!, 0.16) : 'transparent',
                          boxShadow: claimed ? `inset 0 0 0 3px ${hexA(ownerColor!, 0.5)}` : 'none',
                          transition: 'background .2s',
                        }}
                      />
                      {/* ริบบิ้นเจ้าของ */}
                      {claimed && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            padding: '4px 9px',
                            borderRadius: 999,
                            background: ownerColor!,
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            boxShadow: '0 2px 6px rgba(0,0,0,.25)',
                          }}
                        >
                          ผู้เล่น {TH[owner + 1]}
                        </div>
                      )}
                      {/* ป้ายยุคสมัย */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 8,
                          bottom: 8,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: ERA_COLOR[king.era] || '#9A7B24',
                          color: '#fff',
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: '.2px',
                          boxShadow: '0 2px 6px rgba(0,0,0,.2)',
                        }}
                      >
                        {king.era}
                      </div>
                    </div>

                    {/* โซนข้อมูล (คลิกเลือกได้จากทั้งการ์ด — handler อยู่ที่ div นอก) */}
                    <div
                      style={{
                        padding: '10px 12px 12px',
                        background: mine ? hexA(ownerColor!, 0.1) : 'transparent',
                        transition: 'background .18s',
                        userSelect: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        title={king.name}
                        style={{
                          fontFamily: "'Trirong',serif",
                          fontWeight: 600,
                          fontSize: 'clamp(12px, 1.35vw, 13.5px)',
                          lineHeight: 1.22,
                          color: '#3A2A18',
                          minHeight: 34, // 2 บรรทัด — การ์ดสูงเท่ากันทุกใบไม่ว่าชื่อสั้น/ยาว
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                        }}
                      >
                        {main}
                      </div>
                      <div style={{ fontSize: 11, color: '#9A7B4A', marginTop: 3, lineHeight: 1.3 }}>
                        {rank ? `${rank} · ${toThai(king.reignPeriod)}` : toThai(king.reignPeriod)}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          textAlign: 'center',
                          padding: 7,
                          borderRadius: 10,
                          fontWeight: 700,
                          fontSize: 12.5,
                          background: mine ? ownerColor! : claimed ? hexA(ownerColor!, 0.14) : '#F1E7CC',
                          color: mine ? '#fff' : claimed ? ownerColor! : '#8A6A2E',
                          transition: 'all .18s',
                        }}
                      >
                        {mine
                          ? '✓ เลือกแล้ว'
                          : claimed
                            ? `ผู้เล่น ${TH[owner + 1]} ถือครอง`
                            : '＋ แตะเพื่อเลือก'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* RIGHT: แผงตั้งค่า */}
          <aside
            className="home-aside"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              animation: 'home-fadeUp .5s .2s both',
              background: 'linear-gradient(180deg,#FFFDF6,#FBF3DF)',
              border: '2px solid #E7D6AC',
              borderRadius: 22,
              padding: 20,
              boxShadow: '0 10px 28px rgba(90,50,20,.12)',
              alignSelf: 'flex-start',
            }}
          >
            {/* จำนวนผู้เล่น */}
            <div>
              <div style={{ fontFamily: "'Trirong',serif", fontWeight: 600, fontSize: 15, color: '#5A3A1C', marginBottom: 10 }}>
                จำนวนผู้เล่น
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[1, 2, 3, 4].map((n) => {
                  const on = playerCount === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      aria-pressed={on}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 1,
                        padding: '10px 0',
                        borderRadius: 14,
                        cursor: 'pointer',
                        fontFamily: "'Sarabun',sans-serif",
                        border: `2px solid ${on ? '#8A1414' : '#E0CFA4'}`,
                        background: on ? 'linear-gradient(180deg,#A11C1C,#7E0F0F)' : '#FFFDF6',
                        color: on ? '#FBEECB' : '#8A6A3A',
                        transition: 'all .18s',
                        boxShadow: on ? '0 6px 16px rgba(138,20,20,.28)' : 'none',
                        transform: on ? 'translateY(-1px)' : 'none',
                      }}
                    >
                      <span style={{ fontFamily: "'Trirong',serif", fontWeight: 700, fontSize: 22, lineHeight: 1 }}>{TH[n]}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>คน</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#E0CFA4,transparent)' }} />

            {/* ผู้เล่น */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
              {Array.from({ length: playerCount }, (_, i) => {
                const on = activePlayer === i;
                const king = picks[i] ? KINGS.find((k) => k.id === picks[i]) : null;
                return (
                  <div
                    key={i}
                    onClick={() => {
                      sfx.step();
                      setActivePlayer(i);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: '9px 12px',
                      borderRadius: 14,
                      fontFamily: "'Sarabun',sans-serif",
                      border: `2px solid ${on ? PC[i] : '#EAD9AF'}`,
                      background: on ? hexA(PC[i], 0.1) : '#FFFEFA',
                      animation: on ? 'home-glowPulse 2.4s ease-in-out infinite' : 'none',
                      transition: 'border-color .18s, background .18s',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: PC[i],
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Trirong',serif",
                        fontWeight: 700,
                        fontSize: 17,
                        boxShadow: `0 2px 6px ${hexA(PC[i], 0.5)}`,
                      }}
                    >
                      {TH[i + 1]}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        textAlign: 'left',
                        lineHeight: 1.15,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {/* ช่องกรอกชื่อผู้เล่น — ว่างไว้ = ใช้ชื่อเริ่มต้น (placeholder) */}
                      <input
                        className="home-name-input"
                        value={names[i]}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNames((prev) => {
                            const n = prev.slice();
                            n[i] = v;
                            return n;
                          });
                        }}
                        onFocus={() => setActivePlayer(i)}
                        onClick={(e) => e.stopPropagation()}
                        maxLength={16}
                        placeholder={`ผู้เล่น ${TH[i + 1]}`}
                        aria-label={`ชื่อผู้เล่น ${TH[i + 1]}`}
                        style={{ borderBottomColor: hexA(PC[i], 0.5) }}
                      />
                      <span
                        style={{
                          fontFamily: "'Trirong',serif",
                          fontWeight: 600,
                          fontSize: 12.5,
                          color: king ? PC[i] : '#B7A47A',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                          marginTop: 3,
                        }}
                      >
                        {king ? splitKingName(king.name).main : 'ยังไม่เลือกกษัตริย์'}
                      </span>
                    </span>
                    <span style={{ flexShrink: 0, fontWeight: 700, fontSize: king ? 16 : 11, color: PC[i] }}>
                      {king ? '✓' : on ? 'ตาคุณ' : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* เริ่มเล่น */}
            <button
              onClick={start}
              disabled={!allPicked}
              style={{
                padding: 16,
                borderRadius: 16,
                border: 'none',
                cursor: allPicked ? 'pointer' : 'not-allowed',
                fontFamily: "'Trirong',serif",
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: '.5px',
                color: allPicked ? '#FBEECB' : '#B49A78',
                background: allPicked ? 'linear-gradient(180deg,#A81E1E,#7E0F0F)' : '#EDE2C6',
                boxShadow: allPicked ? '0 10px 24px rgba(138,20,20,.35)' : 'none',
                transition: 'all .2s',
              }}
            >
              {allPicked ? `▶ เริ่มเล่น (${TH[playerCount]} คน)` : 'เลือกกษัตริย์ให้ครบก่อน'}
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => {
                  sfx.step();
                  setShowMuseum(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: 11,
                  borderRadius: 12,
                  border: '1.5px solid #C79A3A',
                  background: '#FFFDF6',
                  color: '#7A5B1E',
                  fontFamily: "'Sarabun',sans-serif",
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                🏛 พิพิธภัณฑ์
              </button>
              <button
                onClick={() => {
                  sfx.step();
                  setShowSettings(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: 11,
                  borderRadius: 12,
                  border: '1.5px solid #CDBB94',
                  background: '#FFFDF6',
                  color: '#7A6A48',
                  fontFamily: "'Sarabun',sans-serif",
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                ⚙ การตั้งค่า
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* START overlay — "พร้อมออกศึก" ก่อนเข้าสู่กระดาน */}
      {showStart && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20,
            background: 'rgba(48,24,12,.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'home-fadeUp .25s both',
            padding: 20,
          }}
        >
          <div
            style={{
              width: 520,
              maxWidth: '100%',
              background: 'linear-gradient(180deg,#FFFDF6,#FBF3DF)',
              border: '2px solid #C79A3A',
              borderRadius: 24,
              padding: '30px 34px',
              textAlign: 'center',
              boxShadow: '0 24px 60px rgba(30,15,8,.4)',
              animation: 'home-popIn .3s both',
            }}
          >
            <div style={{ fontFamily: "'Chonburi',serif", fontSize: 30, color: '#8A1414' }}>พร้อมออกศึก!</div>
            <div style={{ fontSize: 14, color: '#7A5B33', marginTop: 4 }}>
              ทัพทั้ง {TH[playerCount]} คน เตรียมเดินหน้าสู่กระดานอุทยานราชภักดิ์
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '18px 0' }}>
              {Array.from({ length: playerCount }, (_, i) => {
                const king = picks[i] ? KINGS.find((k) => k.id === picks[i]) : null;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: '#FFFEFA',
                      border: '1.5px solid #EAD9AF',
                      borderRadius: 12,
                      padding: '9px 12px',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: PC[i],
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Trirong',serif",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {TH[i + 1]}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#5A3A1C' }}>
                      {names[i]?.trim() || `ผู้เล่น ${TH[i + 1]}`}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontFamily: "'Trirong',serif",
                        fontWeight: 600,
                        fontSize: 14,
                        color: '#8A1414',
                        textAlign: 'right',
                      }}
                    >
                      {king ? king.name : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                color: '#7A5B33',
                fontSize: 13.5,
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  border: '3px solid #E0CFA4',
                  borderTopColor: '#8A1414',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'home-spin .8s linear infinite',
                }}
              />
              กำลังเข้าสู่กระดาน…
            </div>
            <button
              onClick={() => {
                sfx.step();
                setShowStart(false);
              }}
              style={{
                padding: '11px 26px',
                borderRadius: 14,
                border: '1.5px solid #C79A3A',
                background: '#FFFDF6',
                color: '#7A5B1E',
                fontFamily: "'Sarabun',sans-serif",
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              ◀ กลับไปแก้ไข
            </button>
          </div>
        </div>
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showMuseum && <MuseumShowcase onClose={() => setShowMuseum(false)} />}
    </div>
  );
}
