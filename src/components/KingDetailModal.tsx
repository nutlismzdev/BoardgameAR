import { useGame } from '@/core/store';
import { KINGS, getKing } from '@/core/content';
import { getKingCoinImage } from '@/core/kingAssets';
import { color, radius, elevation } from '@/theme/tokens';

// การ์ดรายละเอียดมหาราช (แบบ Pokédex) — เปิดจากการ์ดสะสม
// แสดงพระประวัติ + พระราชกรณียกิจ + ไทม์ไลน์ยุค (AR อยู่เฉพาะช่องทองเท่านั้น)
export function KingDetailModal({
  kingId,
  onSelect,
  onClose,
}: {
  kingId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const owned = useGame((s) => s.players[s.currentPlayerIndex]?.kingCoins ?? []);
  const king = getKing(kingId);
  if (!king) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 130,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(165deg, #FFFDF8 0%, #F3E7CF 100%)',
          borderRadius: radius.lg,
          border: `2px solid ${king.themeColor}`,
          boxShadow: elevation.modal,
          width: 'min(560px, 94vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        {/* หัวการ์ด: เหรียญ + พระนาม */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              flexShrink: 0,
              width: 76,
              height: 84,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              fontWeight: 800,
              color: '#fff',
              background: `radial-gradient(circle at 32% 28%, #ffffffcc, ${king.themeColor})`,
              boxShadow: `0 4px 12px ${king.themeColor}99, inset 0 2px 3px #ffffffcc`,
              border: '3px solid #fff',
              overflow: 'hidden',
            }}
          >
            <img
              src={getKingCoinImage(king.id)}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 24, color: king.themeColor, lineHeight: 1.25 }}>
              {king.name}
            </h2>
            <div style={{ fontSize: 17, color: color.textMuted, marginTop: 2 }}>
              🏛️ {king.era} · {king.reignPeriod}
            </div>
          </div>
        </div>

        {/* พระประวัติ */}
        <p style={{ fontSize: 19, lineHeight: 1.65, margin: '16px 0 8px' }}>{king.shortBio}</p>

        {/* พระราชกรณียกิจ */}
        <div style={{ fontWeight: 700, color: color.primary, fontSize: 18, marginTop: 8 }}>
          ⭐ พระราชกรณียกิจสำคัญ
        </div>
        <ul style={{ fontSize: 18, lineHeight: 1.75, paddingLeft: 22, margin: '6px 0 14px' }}>
          {king.achievements.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>

        {/* ไทม์ไลน์ยุค — มหาราชทั้ง 7 เรียงตามเวลา */}
        <div style={{ fontWeight: 700, fontSize: 17, color: color.text, marginBottom: 8 }}>
          🗓️ ไทม์ไลน์ 7 มหาราช
        </div>
        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 6,
            borderTop: `2px dashed ${color.secondary}66`,
            paddingTop: 12,
          }}
        >
          {KINGS.map((k) => {
            const isUnlocked = owned.includes(k.id);
            const active = k.id === kingId;
            return (
              <button
                key={k.id}
                disabled={!isUnlocked}
                onClick={() => onSelect(k.id)}
                style={{
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  width: 62,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  cursor: isUnlocked ? 'pointer' : 'default',
                  opacity: isUnlocked ? 1 : 0.45,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 38,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#fff',
                    background: isUnlocked
                      ? `radial-gradient(circle at 32% 28%, #ffffffaa, ${k.themeColor})`
                      : '#9a9a9a',
                    border: active ? '3px solid #2A2118' : '2px solid #fff',
                    boxShadow: active ? '0 0 0 2px ' + k.themeColor : '0 2px 4px rgba(0,0,0,.25)',
                    overflow: 'hidden',
                  }}
                >
                  {isUnlocked ? (
                    <img
                      src={getKingCoinImage(k.id)}
                      alt=""
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  ) : (
                    '🔒'
                  )}
                </div>
                <span style={{ fontSize: 12, color: color.textMuted, textAlign: 'center', lineHeight: 1.15 }}>
                  {k.era}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            fontFamily: 'inherit',
            marginTop: 18,
            width: '100%',
            fontSize: 20,
            fontWeight: 700,
            color: '#fff',
            background: color.primary,
            border: 'none',
            borderRadius: radius.pill,
            padding: 14,
            minHeight: 52,
            cursor: 'pointer',
          }}
        >
          ปิด
        </button>
      </div>
    </div>
  );
}
