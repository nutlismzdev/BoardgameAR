// สไตล์ + ชิ้นส่วน UI ที่หน้าหลังบ้านใช้ร่วมกัน (AdminPanel / ImportPanel)

import { color, radius } from '@/theme/tokens';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Status({ tone, text }: { tone: 'error' | 'success' | 'neutral'; text: string }) {
  const styles = tone === 'error' ? statusError : tone === 'success' ? statusSuccess : statusNeutral;
  return <p style={styles}>{text}</p>;
}

export const field: React.CSSProperties = { display: 'grid', gap: 7, fontSize: 15, fontWeight: 800, color: color.text };

export const input: React.CSSProperties = {
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 17,
  border: '1.5px solid #B8A98E',
  borderRadius: radius.sm,
  padding: '10px 12px',
  minHeight: 44,
  color: color.text,
  background: '#fff',
};

export const textarea: React.CSSProperties = { ...input, minHeight: 104, resize: 'vertical', lineHeight: 1.55 };

export const primaryButton: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 17,
  fontWeight: 800,
  border: 'none',
  borderRadius: radius.sm,
  background: color.primary,
  color: '#fff',
  padding: '11px 16px',
  minHeight: 46,
  cursor: 'pointer',
};

export const secondaryButton: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 800,
  border: '1.5px solid #B8A98E',
  borderRadius: radius.sm,
  background: '#fff',
  color: color.text,
  padding: '9px 14px',
  minHeight: 42,
  cursor: 'pointer',
};

export const dangerButton: React.CSSProperties = { ...secondaryButton, borderColor: color.danger, color: color.danger };

export const uploadButton: React.CSSProperties = {
  ...primaryButton,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const badge: React.CSSProperties = {
  justifySelf: 'start',
  display: 'inline-flex',
  fontSize: 13,
  fontWeight: 800,
  color: color.primary,
  background: '#FFF1C6',
  borderRadius: radius.sm,
  padding: '3px 8px',
};

export const muted: React.CSSProperties = { color: color.textMuted, fontSize: 14 };

export const statusError: React.CSSProperties = {
  margin: 0,
  padding: 12,
  borderRadius: radius.sm,
  color: color.danger,
  background: '#FFEBEE',
  fontWeight: 800,
};
export const statusSuccess: React.CSSProperties = {
  margin: 0,
  padding: 12,
  borderRadius: radius.sm,
  color: color.success,
  background: '#E8F5E9',
  fontWeight: 800,
};
export const statusNeutral: React.CSSProperties = {
  margin: 0,
  padding: 12,
  borderRadius: radius.sm,
  color: color.info,
  background: '#E3F2FD',
  fontWeight: 800,
};
