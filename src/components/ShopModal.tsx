import { useState } from 'react';
import { useGame, ITEM_META, ITEM_PRICE } from '@/core/store';
import type { ItemType } from '@/core/store';
import { color, radius, elevation } from '@/theme/tokens';

// คำอธิบายไอเทมในร้าน — บอกว่าซื้อไปแล้วช่วยอะไร
const ITEM_DESC: Record<ItemType, string> = {
  fiftyFifty: 'ตัดตัวเลือกที่ผิดออก 2 ข้อ ในช่องคำถาม',
  skip: 'ข้ามคำถามที่ไม่มั่นใจ — รับครึ่งรางวัล',
  double: 'คูณเหรียญรางวัลข้อถัดไป ×2',
  heartPotion: 'ฟื้นหัวใจให้ผู้เล่นปัจจุบัน 1 ดวง',
};

const ORDER: ItemType[] = ['fiftyFifty', 'skip', 'double', 'heartPotion'];

// ร้านค้าไอเทม — ใช้เหรียญราชภักดิ์ซื้อไอเทมพาวเวอร์อัพ (coin sink)
export function ShopModal({ onClose }: { onClose: () => void }) {
  const player = useGame((s) => s.players[s.currentPlayerIndex]);
  const items = useGame((s) => s.items);
  const buyItem = useGame((s) => s.buyItem);
  const coins = player?.coins ?? 0;
  const [flash, setFlash] = useState<ItemType | null>(null);

  const onBuy = (type: ItemType) => {
    if (buyItem(type)) {
      setFlash(type);
      setTimeout(() => setFlash((f) => (f === type ? null : f)), 500);
    }
  };

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* หัวร้าน + เหรียญคงเหลือ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, color: color.primary, fontSize: 26 }}>🛒 ร้านค้าไอเทม</h2>
            <p style={{ margin: '2px 0 0', color: color.textMuted, fontSize: 16 }}>
              ใช้เหรียญที่สะสมได้แลกไอเทมช่วยเล่น
            </p>
          </div>
          <div style={coinBadge}>
            🪙 <b style={{ color: color.secondary, fontSize: 22 }}>{coins}</b>
          </div>
        </div>

        {/* รายการไอเทม */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ORDER.map((type) => {
            const price = ITEM_PRICE[type];
            const canAfford = coins >= price;
            const owned = items[type];
            return (
              <div key={type} style={{ ...itemRow, boxShadow: flash === type ? `0 0 0 3px ${color.success}` : itemRow.boxShadow }}>
                <div style={itemIcon}>{ITEM_META[type].icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: color.text }}>
                    {ITEM_META[type].label}
                    {owned > 0 && (
                      <span style={{ fontSize: 14, color: color.textMuted, fontWeight: 700 }}> · มี {owned}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, color: color.textMuted, lineHeight: 1.35 }}>
                    {ITEM_DESC[type]}
                  </div>
                </div>
                <button
                  onClick={() => onBuy(type)}
                  disabled={!canAfford}
                  style={{
                    ...buyBtn,
                    background: canAfford ? color.primary : '#C9BCA8',
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                  }}
                >
                  🪙 {price}
                </button>
              </div>
            );
          })}
        </div>

        <button onClick={onClose} style={closeBtn}>
          ปิดร้าน
        </button>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.55)',
  zIndex: 140,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const panel: React.CSSProperties = {
  width: 'min(520px, 94vw)',
  maxHeight: '90vh',
  overflowY: 'auto',
  background: 'linear-gradient(165deg, #FFFDF8 0%, #F3E7CF 100%)',
  borderRadius: radius.lg,
  boxShadow: elevation.modal,
  padding: 22,
};

const coinBadge: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  background: '#fff',
  borderRadius: radius.pill,
  padding: '8px 16px',
  fontWeight: 800,
  fontSize: 16,
  boxShadow: 'inset 0 1px 3px rgba(0,0,0,.1)',
};

const itemRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: '#ffffffdd',
  borderRadius: radius.md,
  padding: 12,
  boxShadow: '0 3px 10px rgba(0,0,0,.1)',
  transition: 'box-shadow .2s',
};

const itemIcon: React.CSSProperties = {
  width: 48,
  height: 48,
  flexShrink: 0,
  borderRadius: '50%',
  background: '#FFF3D6',
  border: `2px solid ${color.secondary}66`,
  display: 'grid',
  placeItems: 'center',
  fontSize: 24,
};

const buyBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 17,
  fontWeight: 800,
  color: '#fff',
  border: 'none',
  borderRadius: radius.pill,
  padding: '10px 16px',
  minHeight: 46,
  minWidth: 84,
  flexShrink: 0,
};

const closeBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  marginTop: 18,
  width: '100%',
  fontSize: 18,
  fontWeight: 800,
  color: color.primary,
  background: '#fff',
  border: `2px solid ${color.primary}`,
  borderRadius: radius.pill,
  padding: 12,
  minHeight: 50,
  cursor: 'pointer',
};
