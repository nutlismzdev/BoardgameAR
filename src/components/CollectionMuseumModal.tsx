import { useState } from 'react';
import { useGame } from '@/core/store';
import { KINGS } from '@/core/content';
import { getKingCoinImage } from '@/core/kingAssets';
import { KingCoinRow } from './KingCoinRow';
import { color, radius, elevation } from '@/theme/tokens';
import { KingDetailModal } from './KingDetailModal';

export function CollectionMuseumModal({ onClose }: { onClose: () => void }) {
  const player = useGame((s) => s.players[s.currentPlayerIndex]);
  const coins = player?.kingCoins ?? []; // เหรียญกษัตริย์ที่เก็บได้ — เก็บครบ 7 = ชนะ
  const [detail, setDetail] = useState<string | null>(null);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.58)',
        zIndex: 135,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: 'min(980px, 96vw)',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'linear-gradient(165deg, #FFFDF8 0%, #F3E7CF 100%)',
          borderRadius: radius.lg,
          boxShadow: elevation.modal,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, color: color.primary, fontSize: 30 }}>🏛️ พิพิธภัณฑ์ 7 มหาราช</h2>
            <p style={{ margin: '4px 0 0', color: color.textMuted, fontSize: 18 }}>
              เก็บเหรียญกษัตริย์ให้ครบ 7 พระองค์ · แตะเหรียญที่ได้แล้วเพื่อดูข้อมูล
            </p>
          </div>
          <button onClick={onClose} style={closeBtn}>
            ปิด
          </button>
        </div>

        {/* ชั้นโชว์เหรียญที่สะสม — เหรียญกษัตริย์เป็นพระเอก */}
        <div style={shelf}>
          <div style={{ fontSize: 18, fontWeight: 800, color: color.primary }}>
            🪙 เหรียญกษัตริย์ที่สะสม {coins.length}/7
          </div>
          <div style={{ maxWidth: '100%', overflowX: 'auto', paddingBottom: 2 }}>
            <KingCoinRow collected={coins} size={54} gap={10} />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 14,
          }}
        >
          {KINGS.map((king) => {
            const won = coins.includes(king.id); // ได้เหรียญกษัตริย์แล้ว (ช่องมงกุฎ AR)
            return (
              <button
                key={king.id}
                disabled={!won}
                onClick={() => won && setDetail(king.id)}
                style={{
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  border: `2px solid ${won ? '#E9B93C' : '#D8CDBD'}`,
                  borderRadius: radius.md,
                  background: won ? 'linear-gradient(165deg,#FFFDF4,#FBF0D2)' : '#ffffff88',
                  padding: '18px 12px',
                  minHeight: 168,
                  boxShadow: won ? '0 6px 16px rgba(201,162,39,.3)' : 'none',
                  opacity: won ? 1 : 0.82,
                  cursor: won ? 'pointer' : 'default',
                }}
              >
                {/* เหรียญ — พระเอกของการ์ด */}
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    overflow: 'hidden',
                    background: won
                      ? 'radial-gradient(circle at 35% 30%, #FFF4C4, #E9B93C)'
                      : 'rgba(0,0,0,.05)',
                    border: won ? '3px solid #fff' : '2px dashed rgba(90,60,20,.3)',
                    boxShadow: won
                      ? '0 0 12px rgba(255,193,7,.85), inset 0 1px 2px #fff'
                      : 'inset 0 1px 3px rgba(0,0,0,.12)',
                  }}
                >
                  <img
                    src={getKingCoinImage(king.id)}
                    alt=""
                    draggable={false}
                    style={{
                      width: '86%',
                      height: '86%',
                      objectFit: 'contain',
                      display: 'block',
                      filter: won ? 'none' : 'grayscale(1) opacity(.4)',
                    }}
                  />
                </div>

                {/* พระนาม + ยุค */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: won ? color.text : color.textMuted, lineHeight: 1.2 }}>
                    {won ? king.name.split('(')[0].trim() : '❓ ยังไม่ได้เหรียญ'}
                  </div>
                  <div style={{ fontSize: 15, color: color.textMuted, marginTop: 2 }}>{king.era}</div>
                </div>

                {/* สถานะเหรียญ */}
                <div style={{ fontSize: 14, fontWeight: 800, color: won ? '#8a6d00' : color.textMuted }}>
                  {won ? '🪙 ได้เหรียญแล้ว · แตะดูข้อมูล ›' : 'ยังไม่ได้เหรียญ'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {detail && <KingDetailModal kingId={detail} onSelect={setDetail} onClose={() => setDetail(null)} />}
    </div>
  );
}

const shelf: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  padding: '16px 18px',
  marginBottom: 18,
  borderRadius: radius.lg,
  background: 'linear-gradient(165deg, #FFF9E8, #F3E3B8)',
  border: `2px solid ${color.secondary}66`,
  boxShadow: 'inset 0 1px 0 #fff, 0 4px 14px rgba(90,60,20,.14)',
};

const closeBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  minHeight: 48,
  padding: '10px 20px',
  borderRadius: radius.pill,
  border: 'none',
  background: color.primary,
  color: '#fff',
  fontSize: 18,
  fontWeight: 800,
  cursor: 'pointer',
};
