import { useState } from 'react';
import { useGame } from '@/core/store';
import { KINGS } from '@/core/content';
import { getKingPawnImage } from '@/core/kingAssets';
import { color, radius, elevation } from '@/theme/tokens';
import { KingDetailModal } from './KingDetailModal';
import type { LessonProgress } from '@/core/types';

function stars(progress?: LessonProgress): number {
  if (!progress) return 0;
  return [progress.knowledge, progress.quiz, progress.mission].filter(Boolean).length;
}

export function CollectionMuseumModal({ onClose }: { onClose: () => void }) {
  const player = useGame((s) => s.players[s.currentPlayerIndex]);
  const unlocked = player?.unlockedKings ?? [];
  const progress = player?.lessonProgress ?? {};
  const stickers = player?.arStickers ?? {};
  const posters = player?.arPosters ?? [];
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
              แตะการ์ดที่ปลดล็อกแล้วเพื่อทบทวน พระองค์ละ 3 ดาว: รู้ · ถาม · ทำ
            </p>
          </div>
          <button onClick={onClose} style={closeBtn}>
            ปิด
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 14,
          }}
        >
          {KINGS.map((king) => {
            const isUnlocked = unlocked.includes(king.id);
            const count = stars(progress[king.id]);
            return (
              <button
                key={king.id}
                disabled={!isUnlocked}
                onClick={() => isUnlocked && setDetail(king.id)}
                style={{
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  border: `2px solid ${isUnlocked ? king.themeColor : '#D8CDBD'}`,
                  borderRadius: radius.md,
                  background: isUnlocked ? '#ffffffdd' : '#ffffff88',
                  padding: 14,
                  minHeight: 150,
                  boxShadow: isUnlocked ? '0 6px 14px rgba(0,0,0,.14)' : 'none',
                  opacity: isUnlocked ? 1 : 0.72,
                  cursor: isUnlocked ? 'pointer' : 'default',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 48,
                      height: 54,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 20,
                      fontWeight: 900,
                      background: isUnlocked
                        ? `radial-gradient(circle at 32% 28%, #ffffffaa, ${king.themeColor})`
                        : 'radial-gradient(circle at 32% 28%, #ddd, #888)',
                      overflow: 'hidden',
                    }}
                  >
                    {isUnlocked ? (
                      <img
                        src={getKingPawnImage(king.id)}
                        alt=""
                        draggable={false}
                        style={{ width: '86%', height: '100%', objectFit: 'contain', display: 'block' }}
                      />
                    ) : (
                      '🔒'
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isUnlocked ? color.text : color.textMuted }}>
                      {isUnlocked ? king.name.split('(')[0].trim() : 'ยังไม่ปลดล็อก'}
                    </div>
                    <div style={{ fontSize: 16, color: color.textMuted }}>{king.era}</div>
                  </div>
                </div>
                <div style={{ fontSize: 25, letterSpacing: 2 }}>
                  {'★'.repeat(count)}
                  <span style={{ opacity: 0.25 }}>{'★'.repeat(3 - count)}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 16, color: color.textMuted }}>
                  {isUnlocked ? 'แตะเพื่อดูข้อมูล' : `เรียนรู้แล้ว ${count}/3 ขั้น`}
                </div>
                {(stickers[king.id]?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
                    {stickers[king.id].slice(0, 3).map((sticker) => (
                      <span key={sticker} style={stickerChip}>
                        {sticker}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <section style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 24, color: color.primary }}>
            🧩 สติกเกอร์ AR ที่สะสม
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(stickers).flatMap(([kingId, list]) => {
              const king = KINGS.find((k) => k.id === kingId);
              return list.map((sticker) => (
                <span key={`${kingId}-${sticker}`} style={{ ...stickerChip, fontSize: 16 }}>
                  {king?.order ?? '•'} · {sticker}
                </span>
              ));
            })}
            {Object.values(stickers).flat().length === 0 && (
              <p style={{ margin: 0, fontSize: 18, color: color.textMuted }}>
                ยังไม่มีสติกเกอร์ ลองเปิด AR แล้วแตะเก็บคำสำคัญ
              </p>
            )}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 24, color: color.primary }}>
            🖼️ โปสเตอร์ AR ของฉัน
          </h3>
          {posters.length === 0 ? (
            <p style={{ margin: 0, fontSize: 18, color: color.textMuted }}>
              ยังไม่มีโปสเตอร์ เปิด AR แล้วกด “ทำโปสเตอร์ AR”
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              {posters.map((poster) => {
                const king = KINGS.find((k) => k.id === poster.kingId);
                return (
                  <a
                    key={poster.id}
                    href={poster.imageDataUrl}
                    download={`ar-poster-${poster.kingId}.png`}
                    style={{
                      color: color.text,
                      textDecoration: 'none',
                      background: '#ffffffdd',
                      borderRadius: radius.md,
                      padding: 10,
                      border: `2px solid ${king?.themeColor ?? color.secondary}`,
                      boxShadow: '0 4px 12px rgba(0,0,0,.12)',
                    }}
                  >
                    <img
                      src={poster.imageDataUrl}
                      alt={`โปสเตอร์ AR ${king?.name ?? ''}`}
                      style={{ width: '100%', display: 'block', borderRadius: radius.sm }}
                    />
                    <div style={{ fontSize: 17, fontWeight: 800, marginTop: 8 }}>
                      {king?.name.split('(')[0].trim() ?? 'โปสเตอร์ AR'}
                    </div>
                    <div style={{ fontSize: 15, color: color.textMuted }}>แตะเพื่อดาวน์โหลด</div>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {detail && <KingDetailModal kingId={detail} onSelect={setDetail} onClose={() => setDetail(null)} />}
    </div>
  );
}

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

const stickerChip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  borderRadius: radius.pill,
  background: '#FFF9E6',
  border: `1.5px solid ${color.secondary}`,
  color: color.text,
  padding: '5px 10px',
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.2,
};
