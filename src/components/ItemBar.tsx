import { useGame, ITEM_META, MAX_HEARTS } from '@/core/store';
import type { ItemType } from '@/core/store';
import { color, radius } from '@/theme/tokens';

// แถบไอเทมพาวเวอร์อัพ — โชว์คลังไอเทม, แตะ ✨×2 เพื่อเปิดใช้กับรางวัลถัดไป
// (✂️50:50 และ ⏭️ข้ามคำถาม ใช้ในหน้าคำถาม)
export function ItemBar() {
  const items = useGame((s) => s.items);
  const doubleNext = useGame((s) => s.doubleNext);
  const useItem = useGame((s) => s.useItem);
  const hearts = useGame((s) => s.players[s.currentPlayerIndex]?.hearts ?? MAX_HEARTS);

  const owned = (Object.keys(ITEM_META) as ItemType[]).filter((t) => items[t] > 0);
  if (owned.length === 0 && !doubleNext) {
    return (
      <div style={{ fontSize: 15, color: color.textMuted, textAlign: 'center', padding: '4px 0' }}>
        🎁 เก็บไอเทมจากช่องโชค 🎲
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
      {doubleNext && (
        <span style={{ ...chip, background: color.secondary, color: '#fff', animation: 'itemGlow 1s ease-in-out infinite' }}>
          ✨ ×2 พร้อมใช้!
        </span>
      )}
      {owned.map((t) => {
        const activatable = (t === 'double' && !doubleNext) || (t === 'heartPotion' && hearts < MAX_HEARTS);
        return (
          <button
            key={t}
            disabled={!activatable}
            onClick={() => activatable && useItem(t)}
            style={{
              ...chip,
              border: `1.5px solid ${color.info}`,
              background: '#fff',
              color: color.text,
              cursor: activatable ? 'pointer' : 'default',
            }}
            title={ITEM_META[t].label}
          >
            {ITEM_META[t].icon} {items[t]}
          </button>
        );
      })}
      <style>{`@keyframes itemGlow{0%,100%{box-shadow:0 0 0 0 ${color.secondary}88}50%{box-shadow:0 0 0 5px ${color.secondary}22}}`}</style>
    </div>
  );
}

const chip: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 700,
  padding: '7px 12px',
  minHeight: 40,
  borderRadius: radius.pill,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};
