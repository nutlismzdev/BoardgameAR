import { useState } from 'react';
import { useGame } from '@/core/store';
import { KINGS } from '@/core/content';
import { getKingPawnImage } from '@/core/kingAssets';
import { color, radius } from '@/theme/tokens';
import { SettingsPanel } from '@/screens/Settings/Settings';
import { MuseumShowcase } from '@/components/MuseumShowcase';

const TOKENS = ['🐘', '⛵', '🛕', '🐉'];

// หน้าเริ่ม — เลือกผู้เล่น 1–4 คน
export function Home() {
  const setupGame = useGame((s) => s.setupGame);
  const [showSettings, setShowSettings] = useState(false);
  const [showMuseum, setShowMuseum] = useState(false);
  const [count, setCount] = useState(1);
  const [kingTokens, setKingTokens] = useState(() => KINGS.slice(0, 4).map((king) => king.id));

  const chooseKingToken = (playerIndex: number, kingId: string) => {
    setKingTokens((current) => current.map((id, i) => (i === playerIndex ? kingId : id)));
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: color.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        textAlign: 'center',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: 72 }}>🏛️👑</div>
      <h1 style={{ fontSize: 40, color: color.primary, margin: 0 }}>7 มหาราช</h1>
      <p style={{ fontSize: 18, color: color.textMuted, marginTop: 4 }}>
        บอร์ดเกมเรียนรู้ประวัติศาสตร์ไทย · อุทยานราชภักดิ์
      </p>

      {/* เลือกจำนวนผู้เล่น 1–4 คน */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 16, color: color.textMuted, marginBottom: 8 }}>จำนวนผู้เล่น</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {[1, 2, 3, 4].map((n) => {
            const active = n === count;
            return (
              <button
                key={n}
                onClick={() => setCount(n)}
                aria-pressed={active}
                style={{
                  fontFamily: 'inherit',
                  width: 60,
                  height: 60,
                  borderRadius: radius.lg,
                  fontSize: 22,
                  fontWeight: 800,
                  cursor: 'pointer',
                  color: active ? '#fff' : color.primary,
                  background: active ? color.primary : '#fff',
                  border: `2px solid ${color.primary}`,
                  boxShadow: active ? '0 4px 12px rgba(139,0,0,.3)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 18 }}>{TOKENS[n - 1]}</span>
                <span style={{ fontSize: 14 }}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ width: 'min(920px, 100%)', marginTop: 18 }}>
        <div style={{ fontSize: 18, color: color.primary, fontWeight: 800, marginBottom: 10 }}>
          เลือกหมากกษัตริย์
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 10,
          }}
        >
          {Array.from({ length: count }, (_, playerIndex) => (
            <div
              key={playerIndex}
              style={{
                textAlign: 'left',
                background: '#ffffffcc',
                border: `1.5px solid ${color.secondary}66`,
                borderRadius: radius.md,
                padding: 10,
                boxShadow: '0 4px 12px rgba(70,45,15,.12)',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: color.text, marginBottom: 8 }}>
                {TOKENS[playerIndex]} ผู้เล่น {playerIndex + 1}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {KINGS.map((king) => {
                  const active = kingTokens[playerIndex] === king.id;
                  const takenBy = kingTokens.slice(0, count).findIndex((id) => id === king.id);
                  const disabled = takenBy !== -1 && takenBy !== playerIndex;
                  return (
                    <button
                      key={king.id}
                      onClick={() => chooseKingToken(playerIndex, king.id)}
                      disabled={disabled}
                      aria-label={`ผู้เล่น ${playerIndex + 1} เลือก ${king.name}`}
                      aria-pressed={active}
                      style={{
                        fontFamily: 'inherit',
                        height: 64,
                        borderRadius: radius.sm,
                        border: `2px solid ${active ? king.themeColor : '#E1D6C5'}`,
                        background: active ? '#FFF8E1' : '#fff',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        padding: 3,
                        boxShadow: active ? `0 0 0 2px ${king.themeColor}33` : 'none',
                        opacity: disabled ? 0.35 : 1,
                      }}
                    >
                      <img
                        src={getKingPawnImage(king.id)}
                        alt=""
                        draggable={false}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setupGame(count, kingTokens.slice(0, count))}
        style={{
          fontFamily: 'inherit',
          marginTop: 24,
          fontSize: 26,
          fontWeight: 700,
          color: '#fff',
          background: color.primary,
          border: 'none',
          borderRadius: radius.pill,
          padding: '18px 56px',
          minHeight: 64,
          cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(139,0,0,.3)',
        }}
      >
        ▶ เริ่มเล่น {count > 1 ? `(${count} คน)` : '(คนเดียว)'}
      </button>
      <button
        onClick={() => setShowMuseum(true)}
        style={{
          fontFamily: 'inherit',
          marginTop: 10,
          fontSize: 21,
          fontWeight: 800,
          color: '#2A2118',
          background: '#FFF7E7',
          border: `2px solid ${color.secondary}`,
          borderRadius: radius.pill,
          padding: '14px 34px',
          minHeight: 56,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(70,45,15,.16)',
        }}
      >
        🏛️ โหมดพิพิธภัณฑ์
      </button>
      <button
        onClick={() => setShowSettings(true)}
        style={{
          fontFamily: 'inherit',
          marginTop: 24,
          fontSize: 17,
          fontWeight: 600,
          color: color.primary,
          background: 'transparent',
          border: `2px solid ${color.primary}`,
          borderRadius: radius.pill,
          padding: '12px 24px',
          minHeight: 48,
          cursor: 'pointer',
        }}
      >
        ⚙️ โหมดครู (ตั้งค่า)
      </button>

      <p style={{ marginTop: 16, fontSize: 16, color: color.textMuted }}>
        📱 หมุนแท็บเล็ตได้ทั้งแนวตั้งและแนวนอน
      </p>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showMuseum && <MuseumShowcase onClose={() => setShowMuseum(false)} />}
    </div>
  );
}
