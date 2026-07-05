import { useState } from 'react';
import { useGame } from '@/core/store';
import { KINGS } from '@/core/content';
import { getKingCoinImage } from '@/core/kingAssets';
import { color, radius } from '@/theme/tokens';
import { KingDetailModal } from './KingDetailModal';
import { CollectionMuseumModal } from './CollectionMuseumModal';

// การ์ดสะสมเหรียญกษัตริย์ 7 พระองค์ (เป้าหมายหลัก — เก็บครบ 7 = ชนะ)
// แตะพระองค์ที่ได้เหรียญแล้ว → เปิดการ์ดรายละเอียด (Pokédex)
export function KingCollection() {
  const player = useGame((s) => s.players[s.currentPlayerIndex]);
  const coins = player?.kingCoins ?? [];
  const knowledgeCount = player?.knowledgeCards.length ?? 0;
  const [detail, setDetail] = useState<string | null>(null);
  const [museumOpen, setMuseumOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: radius.lg,
        // การ์ด 3D: ไล่เฉดอ่อน + ขอบทอง + เงาซ้อนให้ดูนูน
        background: 'linear-gradient(160deg, #FFFDF8 0%, #F5EAD6 100%)',
        border: `1.5px solid ${color.secondary}55`,
        boxShadow: '0 12px 30px rgba(90,60,20,.22), inset 0 1px 0 #ffffff',
        padding: 14,
        overflow: 'hidden',
      }}
    >
      {/* หัวการ์ด */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: color.primary }}>🪙 เหรียญกษัตริย์</div>
        <div style={{ fontSize: 15, color: color.textMuted, fontWeight: 600 }}>
          เก็บแล้ว {coins.length}/7 · 📖 ความรู้ {knowledgeCount}/10
        </div>
        {/* แถบความคืบหน้าเหรียญกษัตริย์ (เงื่อนไขชนะ) */}
        <div style={{ height: 6, background: '#00000012', borderRadius: 99, marginTop: 6 }}>
          <div
            style={{
              height: '100%',
              width: `${(coins.length / 7) * 100}%`,
              background: `linear-gradient(90deg, ${color.secondary}, #E0B84A)`,
              borderRadius: 99,
              transition: 'width .4s',
            }}
          />
        </div>
      </div>

      <button
        onClick={() => setMuseumOpen(true)}
        style={{
          fontFamily: 'inherit',
          minHeight: 42,
          borderRadius: radius.pill,
          border: `2px solid ${color.primary}`,
          background: '#fff',
          color: color.primary,
          fontSize: 16,
          fontWeight: 800,
          cursor: 'pointer',
          marginBottom: 8,
        }}
      >
        🏛️ เปิดพิพิธภัณฑ์
      </button>

      {/* รายชื่อมหาราช (เลื่อนได้ถ้าจอเตี้ย) — สถานะอิง "ได้เหรียญหรือยัง" */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
        {KINGS.map((k) => {
          const won = coins.includes(k.id);
          return (
            <button
              key={k.id}
              disabled={!won}
              onClick={() => won && setDetail(k.id)}
              style={{
                fontFamily: 'inherit',
                textAlign: 'left',
                width: '100%',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                borderRadius: radius.md,
                background: won ? '#ffffffcc' : 'transparent',
                boxShadow: won ? '0 2px 6px rgba(0,0,0,.08)' : 'none',
                opacity: won ? 1 : 0.6,
                transition: 'all .3s',
                cursor: won ? 'pointer' : 'default',
              }}
            >
              {/* เหรียญมหาราช — ได้แล้ว=ทองเรือง / ยังไม่ได้=จางเส้นประ */}
              <div
                style={{
                  flexShrink: 0,
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                  background: won
                    ? 'radial-gradient(circle at 35% 30%, #FFF4C4, #E9B93C)'
                    : 'rgba(0,0,0,.05)',
                  border: won ? '2px solid #fff' : '2px dashed rgba(90,60,20,.3)',
                  boxShadow: won ? '0 0 6px rgba(255,193,7,.8), inset 0 1px 1px #fff' : 'none',
                }}
              >
                <img
                  src={getKingCoinImage(k.id)}
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
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: color.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {won ? shortName(k.name) : '❓ ยังไม่ได้เหรียญ'}
                </div>
                <div style={{ fontSize: 14, color: color.textMuted }}>{k.era}</div>
              </div>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                {won && <span style={{ fontSize: 15, color: color.info }}>ดู ›</span>}
              </span>
            </button>
          );
        })}
      </div>

      {detail && (
        <KingDetailModal kingId={detail} onSelect={(id) => setDetail(id)} onClose={() => setDetail(null)} />
      )}
      {museumOpen && <CollectionMuseumModal onClose={() => setMuseumOpen(false)} />}
    </div>
  );
}

// ตัดพระนามยาวให้พอดีการ์ด (เอาส่วนก่อนวงเล็บ)
function shortName(name: string): string {
  return name.split('(')[0].trim();
}
