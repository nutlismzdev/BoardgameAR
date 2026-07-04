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
  question: '#F9A825', // เหลือง
  mission: '#1565C0', // ฟ้า
  coin: '#F9A825',
  knowledge: '#E91E63', // ชมพู
  king: '#8B0000',
  goldking: '#C9A227', // ทอง — เหรียญกษัตริย์
  bonus: '#2E9E44', // เขียว
  chance: '#6A1B9A', // ม่วง
  special: '#607D8B',
};

export const tileIcon: Record<string, string> = {
  start: '🏛️',
  question: '❓',
  mission: '🎯',
  coin: '💰',
  knowledge: '💡',
  king: '👑',
  goldking: '👑',
  bonus: '💚',
  chance: '🌀',
  special: '⏭️',
};

export const tileLabel: Record<string, string> = {
  start: 'เริ่ม',
  question: 'คำถาม',
  mission: 'ภารกิจ',
  coin: 'รับเหรียญ',
  knowledge: 'ความรู้',
  king: 'มหาราช',
  goldking: 'เหรียญกษัตริย์',
  bonus: 'โบนัส',
  chance: 'โชค',
  special: 'พิเศษ',
};
