// ชนิดข้อมูลกลางของเกม — ใช้ร่วมทุก layer

export type TileType =
  | 'start'
  | 'question'
  | 'mission'
  | 'coin'
  | 'knowledge'
  | 'king'
  | 'goldking' // ช่องทอง — ตอบคำถามถูก = ได้เหรียญกษัตริย์ (เงื่อนไขชนะ)
  | 'bonus' // ช่องเขียว — การ์ดโบนัส (และเป็นจุดทางแยก)
  | 'chance'
  | 'special'
  | 'blank';

export interface Tile {
  index: number;
  type: TileType;
  kingId: string | null;
  label?: string;
  reward?: number;
  passReward?: number;
  // ช่องถัดไปที่เดินไปได้ — ปกติ 1 ทาง, ช่องทางแยกมี 2 ทาง (ผู้เล่นเลือก)
  // ถ้าไม่ระบุ = เดินไปช่อง index+1 ตามปกติ
  next?: number[];
}

export interface King {
  id: string;
  order: number;
  name: string;
  era: string;
  reignPeriod: string;
  shortBio: string;
  achievements: string[];
  themeColor: string;
  portrait2D: string;
  arModel3D: string;
  arModelIOS: string;
  arMarkerId: string;
  audioNarration: string;
  arVideo?: string; // คลิปวิดีโอ 15 วิ สำหรับช่องทอง (ยังเป็น placeholder — เสียบ path จริงภายหลัง)
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuizChoice {
  text: string;
  correct: boolean;
}

export interface QuizCard {
  id: string;
  kingId: string;
  difficulty: Difficulty;
  reward: number;
  timeLimitSec: number;
  question: string;
  choices: QuizChoice[];
  explanation: string;
}

export interface ChanceCard {
  id: string;
  title: string;
  body: string;
  move: number;
  coin: number;
  item?: 'fiftyFifty' | 'skip' | 'double';
}

// การ์ดภารกิจ (ช่องฟ้า) — เป็นโจทย์ปรนัย ก/ข/ค/ง เท่านั้น
export interface MissionCard {
  id: string;
  kingId: string;
  reward: number;
  question: string;
  choices: QuizChoice[];
}

// การ์ดความรู้ (ช่องชมพู) — เกร็ดความรู้ + คำถามทวนแบบ ก/ข/ค/ง เก็บสะสมได้ (ไม่มี AR)
export interface KnowledgeCard {
  id: string;
  kingId: string;
  title: string;
  body: string;
  question: string;
  choices: QuizChoice[];
}

export interface Player {
  id: number;
  name: string;
  token: string; // emoji หมาก
  kingTokenId: string; // ภาพหมากกษัตริย์ที่ผู้เล่นเลือก
  position: number; // index ช่องปัจจุบัน
  coins: number;
  kingCoins: string[]; // เหรียญกษัตริย์ที่เก็บได้ (จากช่องทอง) — เก็บครบ 7 = ชนะ
  knowledgeCards: string[]; // การ์ดความรู้ที่เก็บได้ (ช่องชมพู) สูงสุด 10 ใบ/คน สุ่มไม่ซ้ำ
  unlockedKings: string[]; // มหาราชที่ "เรียนรู้ครบ 3 ขั้น" แล้ว (ใช้กับพิพิธภัณฑ์ — คนละอย่างกับ kingCoins)
  lessonProgress: Record<string, LessonProgress>; // ความคืบหน้าการเรียนรู้รายพระองค์
  arStickers: Record<string, string[]>; // คำสำคัญที่เก็บจาก AR แยกตามพระองค์
  arPosters: ArPoster[]; // โปสเตอร์ AR ที่เด็กสร้างเป็นผลงาน
}

export type LessonStep = 'knowledge' | 'quiz' | 'mission';

export interface LessonProgress {
  knowledge: boolean;
  quiz: boolean;
  mission: boolean;
}

export type QuestKind = 'stars' | 'unlocks' | 'coins';

export interface DailyQuest {
  id: string;
  kind: QuestKind;
  title: string;
  description: string;
  target: number;
}

export interface ArPoster {
  id: string;
  kingId: string;
  imageDataUrl: string;
  stickers: string[];
  createdAt: number;
}

export type Orientation = 'portrait' | 'landscape';

// เหตุการณ์ที่เกิดหลังหยุดช่อง — layout จะเอาไปเปิด Modal/การ์ด
export interface TileEvent {
  tile: Tile;
  kind: TileType;
}
