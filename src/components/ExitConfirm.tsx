import type { CSSProperties } from 'react';
import { useGame } from '@/core/store';
import { color, radius, elevation } from '@/theme/tokens';

// กล่องยืนยันออกจากเกม — เปิดจากปุ่ม 🏠 หรือปุ่ม back ของเบราว์เซอร์ (ผ่าน store.exitPrompt)
// เกมถูกบันทึกอัตโนมัติ (resume ได้ภายใน 15 นาที) จึงย้ำว่าออกแล้วกลับมาเล่นต่อได้
export function ExitConfirm() {
  const open = useGame((s) => s.exitPrompt);
  const cancelExit = useGame((s) => s.cancelExit);
  const confirmExit = useGame((s) => s.confirmExit);
  if (!open) return null;

  return (
    <div style={overlay} onClick={cancelExit}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 48 }}>🏠</div>
        <h3 style={title}>ออกจากเกม?</h3>
        <p style={desc}>เกมถูกบันทึกไว้แล้ว กลับเข้ามาเล่นต่อได้ภายใน 15 นาที</p>
        <div style={row}>
          <button style={ghost} onClick={cancelExit}>
            เล่นต่อ
          </button>
          <button style={danger} onClick={confirmExit}>
            ออกจากเกม
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(20,12,6,.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: 24,
};

const box: CSSProperties = {
  background: color.surface,
  borderRadius: radius.lg,
  boxShadow: elevation.modal,
  padding: '28px 26px',
  width: 'min(360px, 92vw)',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
};

const title: CSSProperties = { margin: 0, fontSize: 24, fontWeight: 900, color: color.primary };
const desc: CSSProperties = { margin: '2px 0 10px', fontSize: 16, color: color.textMuted, lineHeight: 1.5 };
const row: CSSProperties = { display: 'flex', gap: 12, width: '100%' };

const btnBase: CSSProperties = {
  flex: 1,
  padding: '12px 0',
  borderRadius: radius.pill,
  fontSize: 17,
  fontWeight: 800,
  cursor: 'pointer',
  border: 'none',
};
const ghost: CSSProperties = {
  ...btnBase,
  background: color.bg,
  color: color.text,
  border: `2px solid ${color.secondary}`,
};
const danger: CSSProperties = { ...btnBase, background: color.danger, color: '#fff' };
