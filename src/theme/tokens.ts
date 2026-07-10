// ระบบดีไซน์กลาง (Design Tokens) — โทนไทยประยุกต์ ทอง–แดงชาด–ครีม
// ใช้ร่วมกันทั้ง Layout แนวตั้งและแนวนอน

export const color = {
  primary: '#8B0000', // แดงชาด
  secondary: '#C9A227', // ทอง
  bg: '#FBF3E4', // ครีมกระดาษสา
  surface: '#FFFFFF',
  text: '#2A2118',
  textMuted: '#6B5E4E',
  success: '#2E7D32',
  danger: '#C62828',
  info: '#1565C0',
} as const;

export const radius = { sm: 8, md: 16, lg: 24, pill: 999 } as const;

export const spacing = [4, 8, 12, 16, 24, 32, 48] as const;

export const font = {
  family: "'Kanit', 'Sarabun', sans-serif",
  size: { body: 18, title: 28, hero: 40 },
} as const;

export const elevation = {
  card: '0 4px 16px rgba(0,0,0,.12)',
  modal: '0 12px 40px rgba(0,0,0,.28)',
} as const;

// สีประจำประเภทช่อง (ตรงกับสีกรอบบนภาพกระดานจริง)
export const tileColor: Record<string, string> = {
  start: '#C9A227', // ทอง
  question: '#1565C0', // ฟ้าเข้ม (แยกโทนจากทองของช่องทอง)
  mission: '#1565C0', // ฟ้า
  coin: '#F9A825',
  knowledge: '#E91E63', // ชมพู
  subject: '#00897B', // เขียวหัวเป็ด (teal) — ช่องกลุ่มสาระการเรียนรู้
  king: '#8B0000',
  goldking: '#C9A227', // ทอง — เหรียญกษัตริย์
  bonus: '#2E9E44', // เขียว
  chance: '#6A1B9A', // ม่วง
  penalty: '#8E2020', // แดงเข้ม — ช่องทำโทษ
  special: '#607D8B',
};

export const tileIcon: Record<string, string> = {
  start: '🏛️',
  question: '❓',
  mission: '🎯',
  coin: '💰',
  knowledge: '💡',
  subject: '📚',
  king: '👑',
  goldking: '👑',
  bonus: '🎁',
  chance: '🌀',
  penalty: '⛓️',
  special: '⏭️',
};

// ระดับความยากของคำถาม — ป้ายสี + คำไทย ใช้ซ้ำทุกที่ที่แสดงคำถาม
// (ช่องฟ้า/ช่องสาระใน CardModal + ช่องทอง AR) ให้ผู้เล่นรู้ว่ากำลังเจอคำถามระดับไหน
export const difficultyMeta: Record<
  'easy' | 'medium' | 'hard',
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  easy: { label: 'ง่าย', color: '#1B7A34', bg: '#E7F6EC', border: '#57C27B', icon: '🟢' },
  medium: { label: 'ปานกลาง', color: '#A66A00', bg: '#FFF3DC', border: '#E7A83C', icon: '🟡' },
  hard: { label: 'ยาก', color: '#B02020', bg: '#FDE8E8', border: '#E06A6A', icon: '🔴' },
};

export const tileLabel: Record<string, string> = {
  start: 'เริ่ม',
  question: 'คำถาม',
  mission: 'ภารกิจ',
  coin: 'รับเหรียญ',
  knowledge: 'ความรู้',
  subject: 'สาระการเรียนรู้',
  king: 'มหาราช',
  goldking: 'เหรียญกษัตริย์',
  bonus: 'โบนัส',
  chance: 'โชค',
  penalty: 'ทำโทษ',
  special: 'พิเศษ',
};
