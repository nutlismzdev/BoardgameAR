// ชนิดข้อมูลกลางของเกม — ใช้ร่วมทุก layer

export type TileType =
  | 'question'
  | 'knowledge'
  | 'subject' // ช่องกลุ่มสาระการเรียนรู้ — สุ่มคำถามตามวิชา (สังคม/คณิต/วิทย์/ศิลปะ/สุขศึกษา/ภาษาต่างประเทศ) ของพระองค์ที่ผูกช่อง
  | 'goldking' // ช่องทอง — ตอบคำถามถูก = ได้เหรียญกษัตริย์ (เงื่อนไขชนะ)
  | 'bonus' // ช่องเขียว — การ์ดโบนัส (และเป็นจุดทางแยก)
  | 'penalty' // ช่องทำโทษ — เดินย้อนหลัง หรือ หยุดพัก 1 ตา
  | 'shop' // ช่องร้านค้า — เปิดร้านซื้อไอเทมได้เฉพาะตอนหยุดช่องนี้ (จำกัดการเข้าถึง)
  | 'blank';

// 8 กลุ่มสาระฯ แต่คัดมาใช้ 6 วิชาตามที่กำหนด (ไม่รวมภาษาไทย/การงานฯ)
export type SubjectArea =
  | 'social' // สังคมศึกษา ศาสนา และวัฒนธรรม
  | 'math' // คณิตศาสตร์
  | 'science' // วิทยาศาสตร์
  | 'art' // ศิลปะ
  | 'health_pe' // สุขศึกษาและพลศึกษา
  | 'foreign_language'; // ภาษาต่างประเทศ

// ผลของช่องทำโทษ: 'back' = ถอยหลัง steps ช่อง · 'skip' = หยุดพัก steps ตา
export interface PenaltyConfig {
  type: 'back' | 'skip';
  steps: number;
}

export interface Tile {
  index: number;
  type: TileType;
  kingId: string | null;
  label?: string;
  reward?: number;
  passReward?: number;
  penalty?: PenaltyConfig; // ช่องทำโทษ: รายละเอียดผล
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
  videoUrl?: string;
  imageUrl?: string; // ภาพประกอบคำถาม (optional) — path/URL (relative = ผ่าน API base)
}

export type GoldQuizCard = QuizCard;

// คำถามช่องกลุ่มสาระฯ — เหมือนควิซปกติ แต่ผูกกับ "วิชา" ด้วย (ใช้โชว์ป้ายวิชา + คัดตามหมวด)
export interface SubjectQuizCard extends QuizCard {
  subject: SubjectArea;
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
  hearts: number;
  kingCoins: string[]; // เหรียญกษัตริย์ที่เก็บได้ (จากช่องทอง) — เก็บครบ 7 = ชนะ
  skipNext: number; // จำนวนตาที่ต้อง "หยุดพัก" (จากช่องทำโทษ) — ถูกข้ามเทิร์นจนกว่าจะเป็น 0
  knowledgeCards: string[]; // การ์ดความรู้ที่เก็บได้ (ช่องชมพู) สูงสุด 10 ใบ/คน สุ่มไม่ซ้ำ
}

export type Orientation = 'portrait' | 'landscape';

// เหตุการณ์ที่เกิดหลังหยุดช่อง — layout จะเอาไปเปิด Modal/การ์ด
export interface TileEvent {
  tile: Tile;
  kind: TileType;
}
