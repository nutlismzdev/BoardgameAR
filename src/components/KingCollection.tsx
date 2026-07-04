import { useState } from 'react';
import { useGame } from '@/core/store';
import { KINGS } from '@/core/content';
import { getKingPawnImage } from '@/core/kingAssets';
import { color, radius } from '@/theme/tokens';
import { KingDetailModal } from './KingDetailModal';
import { CollectionMuseumModal } from './CollectionMuseumModal';

// การ์ด 3D "สะสม 7 มหาราช" — แสดงความคืบหน้าเป้าหมายหลักของเกม + สอนพระนามทั้ง 7 พระองค์
// แตะมหาราชที่ปลดล็อกแล้ว → เปิดการ์ดรายละเอียด (Pokédex)
export function KingCollection() {
  const player = useGame((s) => s.players[s.currentPlayerIndex]);
  const unlocked = player?.unlockedKings ?? [];
  const coins = player?.kingCoins ?? [];
  const knowledgeCount = player?.knowledgeCards.length ?? 0;
  const progress = player?.lessonProgress ?? {};
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

      {/* รายชื่อมหาราช (เลื่อนได้ถ้าจอเตี้ย) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
        {KINGS.map((k) => {
          const isUnlocked = unlocked.includes(k.id);
          const hasCoin = coins.includes(k.id);
          const p = progress[k.id];
          const done = [p?.knowledge, p?.quiz, p?.mission].filter(Boolean).length;
          return (
            <button
              key={k.id}
              disabled={!isUnlocked}
              onClick={() => isUnlocked && setDetail(k.id)}
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
                background: isUnlocked ? '#ffffffcc' : 'transparent',
                boxShadow: isUnlocked ? '0 2px 6px rgba(0,0,0,.08)' : 'none',
                opacity: isUnlocked ? 1 : 0.55,
                transition: 'all .3s',
                cursor: isUnlocked ? 'pointer' : 'default',
              }}
            >
              {/* เหรียญ/หมากมหาราช (3D) */}
              <div
                style={{
                  flexShrink: 0,
                  width: 44,
                  height: 48,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#fff',
                  background: isUnlocked
                    ? `radial-gradient(circle at 32% 28%, #ffffffaa, ${k.themeColor})`
                    : 'radial-gradient(circle at 32% 28%, #ccc, #8d8d8d)',
                  boxShadow: isUnlocked
                    ? `0 3px 8px ${k.themeColor}88, inset 0 1px 2px #ffffffcc`
                    : 'inset 0 1px 2px #ffffff88',
                  border: `2px solid ${isUnlocked ? '#fff' : '#e6e0d4'}`,
                  overflow: 'hidden',
                }}
              >
                {isUnlocked ? (
                  <img
                    src={getKingPawnImage(k.id)}
                    alt=""
                    draggable={false}
                    style={{ width: '86%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                ) : (
                  '🔒'
                )}
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
                  {isUnlocked ? shortName(k.name) : '❓ ยังไม่ปลดล็อก'}
                </div>
                <div style={{ fontSize: 14, color: color.textMuted, marginBottom: 4 }}>
                  {isUnlocked ? k.era : `เรียนรู้ ${done}/3`}
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  <StepDot label="รู้" active={!!p?.knowledge} />
                  <StepDot label="ถาม" active={!!p?.quiz} />
                  <StepDot label="ทำ" active={!!p?.mission} />
                </div>
              </div>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                {hasCoin && (
                  <span title="ได้เหรียญกษัตริย์แล้ว" style={{ fontSize: 18 }}>
                    🪙
                  </span>
                )}
                {isUnlocked && <span style={{ fontSize: 15, color: color.info }}>ดู ›</span>}
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

function StepDot({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      title={label}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: active ? color.success : '#00000022',
        display: 'inline-block',
      }}
    />
  );
}

// ตัดพระนามยาวให้พอดีการ์ด (เอาส่วนก่อนวงเล็บ)
function shortName(name: string): string {
  return name.split('(')[0].trim();
}
