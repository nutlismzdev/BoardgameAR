import { useMemo, useState } from 'react';
import { KINGS } from '@/core/content';
import { getKingCoinImage } from '@/core/kingAssets';
import { color, elevation, radius } from '@/theme/tokens';
import type { King } from '@/core/types';

export function MuseumShowcase({ onClose }: { onClose: () => void }) {
  const [selectedId, setSelectedId] = useState(KINGS[0]?.id ?? '');
  const selected = useMemo(() => KINGS.find((king) => king.id === selectedId) ?? KINGS[0], [selectedId]);

  if (!selected) return null;

  return (
    <div style={screen}>
      <header style={header}>
        <div>
          <div style={eyebrow}>นิทรรศการเหรียญ 7 มหาราช</div>
          <h1 style={title}>7 มหาราชแห่งสยาม</h1>
        </div>
        <button onClick={onClose} style={closeBtn} aria-label="กลับหน้าหลัก">
          กลับ
        </button>
      </header>

      <main style={main}>
        <section style={heroPanel}>
          <div style={{ ...coinHalo, borderColor: selected.themeColor }}>
            <img
              src={getKingCoinImage(selected.id)}
              alt={`เหรียญ ${selected.name}`}
              draggable={false}
              style={heroCoin}
            />
          </div>
          <div style={detailPanel}>
            <div style={{ ...eraBadge, borderColor: selected.themeColor, color: selected.themeColor }}>
              ลำดับที่ {selected.order} · {selected.era}
            </div>
            <h2 style={{ ...kingName, color: selected.themeColor }}>{selected.name}</h2>
            <div style={reign}>{selected.reignPeriod}</div>
            <p style={bio}>{selected.shortBio}</p>
            <div style={factGrid}>
              {selected.achievements.slice(0, 3).map((achievement, index) => (
                <div key={achievement} style={factItem}>
                  <span style={{ ...factNo, background: selected.themeColor }}>{index + 1}</span>
                  <span>{achievement}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={coinRail} aria-label="เลือกเหรียญมหาราช">
          {KINGS.map((king) => {
            const active = king.id === selected.id;
            return (
              <button
                key={king.id}
                onClick={() => setSelectedId(king.id)}
                aria-pressed={active}
                style={{
                  ...coinButton,
                  borderColor: active ? king.themeColor : '#D7C8AE',
                  background: active ? '#FFFDF8' : '#ffffffb8',
                  boxShadow: active ? `0 10px 24px ${king.themeColor}33` : '0 4px 12px rgba(36, 25, 14, .1)',
                }}
              >
                <img src={getKingCoinImage(king.id)} alt="" draggable={false} style={thumbCoin} />
                <span style={{ ...thumbOrder, background: king.themeColor }}>{king.order}</span>
                <span style={thumbText}>{shortName(king)}</span>
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}

function shortName(king: King): string {
  return king.name.replace('พระบาทสมเด็จพระ', '').split('(')[0].trim();
}

const screen: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  background:
    'linear-gradient(180deg, #14100C 0%, #21170F 42%, #F6EBD8 42%, #F6EBD8 100%)',
  color: color.text,
  overflowY: 'auto',
  padding: 'clamp(16px, 3vw, 32px)',
};

const header: React.CSSProperties = {
  width: 'min(1180px, 100%)',
  margin: '0 auto 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
};

const eyebrow: React.CSSProperties = {
  color: '#E7C66A',
  fontSize: 'clamp(15px, 2vw, 20px)',
  fontWeight: 800,
};

const title: React.CSSProperties = {
  margin: 0,
  color: '#FFF7E7',
  fontSize: 'clamp(34px, 7vw, 76px)',
  lineHeight: 1.05,
  letterSpacing: 0,
};

const closeBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  minWidth: 92,
  minHeight: 52,
  border: '2px solid #E7C66A',
  borderRadius: radius.pill,
  background: '#FFF7E7',
  color: '#21170F',
  fontSize: 18,
  fontWeight: 900,
  cursor: 'pointer',
};

const main: React.CSSProperties = {
  width: 'min(1180px, 100%)',
  margin: '0 auto',
  display: 'grid',
  gap: 18,
};

const heroPanel: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, .85fr) minmax(320px, 1.15fr)',
  gap: 22,
  alignItems: 'center',
  background: '#FFFDF8',
  border: '1.5px solid #E1D0AF',
  borderRadius: radius.lg,
  boxShadow: elevation.modal,
  padding: 'clamp(16px, 3vw, 28px)',
};

const coinHalo: React.CSSProperties = {
  width: 'min(440px, 100%)',
  aspectRatio: '1',
  margin: '0 auto',
  borderRadius: '50%',
  border: '4px solid',
  background: 'radial-gradient(circle at 35% 25%, #FFFFFF 0%, #F8E8B7 42%, #A06F2D 100%)',
  boxShadow: 'inset 0 8px 22px rgba(255,255,255,.55), 0 24px 42px rgba(64, 38, 13, .28)',
  display: 'grid',
  placeItems: 'center',
  padding: '8%',
};

const heroCoin: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  filter: 'drop-shadow(0 18px 18px rgba(48, 30, 12, .3))',
};

const detailPanel: React.CSSProperties = {
  minWidth: 0,
};

const eraBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 38,
  padding: '6px 14px',
  border: '2px solid',
  borderRadius: radius.pill,
  background: '#FFF9EA',
  fontSize: 17,
  fontWeight: 900,
};

const kingName: React.CSSProperties = {
  margin: '14px 0 6px',
  fontSize: 'clamp(30px, 5vw, 54px)',
  lineHeight: 1.15,
  letterSpacing: 0,
};

const reign: React.CSSProperties = {
  color: color.textMuted,
  fontSize: 'clamp(18px, 2.5vw, 24px)',
  fontWeight: 800,
};

const bio: React.CSSProperties = {
  margin: '16px 0',
  fontSize: 'clamp(18px, 2.4vw, 25px)',
  lineHeight: 1.6,
};

const factGrid: React.CSSProperties = {
  display: 'grid',
  gap: 10,
};

const factItem: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px 1fr',
  alignItems: 'start',
  gap: 10,
  fontSize: 'clamp(16px, 2vw, 21px)',
  lineHeight: 1.45,
  background: '#FBF4E6',
  border: '1px solid #E9D9B9',
  borderRadius: radius.md,
  padding: 12,
};

const factNo: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  color: '#fff',
  display: 'inline-grid',
  placeItems: 'center',
  fontWeight: 900,
};

const coinRail: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(112px, 1fr))',
  gap: 10,
};

const coinButton: React.CSSProperties = {
  position: 'relative',
  fontFamily: 'inherit',
  minHeight: 170,
  border: '2px solid',
  borderRadius: radius.md,
  padding: '12px 8px 10px',
  cursor: 'pointer',
  display: 'grid',
  justifyItems: 'center',
  alignContent: 'start',
  gap: 8,
};

const thumbCoin: React.CSSProperties = {
  width: 92,
  height: 92,
  objectFit: 'contain',
};

const thumbOrder: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: 8,
  width: 26,
  height: 26,
  borderRadius: '50%',
  color: '#fff',
  fontSize: 15,
  fontWeight: 900,
  display: 'grid',
  placeItems: 'center',
};

const thumbText: React.CSSProperties = {
  color: color.text,
  fontSize: 15,
  fontWeight: 900,
  lineHeight: 1.2,
  textAlign: 'center',
};
