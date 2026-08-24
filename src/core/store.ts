// State กลางของเกม (Zustand) — กติกาทั้งหมดอยู่ที่นี่
// ไฟล์ Layout (portrait/landscape) เพียงอ่าน state และเรียก action เท่านั้น ห้ามฝัง logic

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import boardData from '@/data/board-layout.json';
import kingsData from '@/data/kings.json';
import type { Player, Tile, TileEvent, Difficulty } from './types';
import { BLOCK_STEPS, EFFECTS, REWIND_STEPS, STEAL_GAIN, STEAL_LOSS, sendErrorMessage } from './roomApi';
import type { EffectKind, RoomEffect, RoomState, SendResult } from './roomApi';
import { rollDie } from './diceLogic';
import { sfx, setSoundEnabled, startBackgroundMusic, stopAllAudio } from './sfx';

const TILES = boardData.tiles as Tile[];
const LOOP = boardData.loopSize as number;
const KING_IDS = (kingsData.kings as { id: string }[]).map((k) => k.id);

export type GamePhase = 'setup' | 'idle' | 'rolling' | 'moving' | 'forking' | 'resolving' | 'gameover';

// สถานะทางแยก: หมากหยุดที่ช่องแยก รอผู้เล่นเลือกเส้นทาง (เหลือแต้มอีกกี่ก้าว)
export interface PendingFork {
  from: number; // ช่องทางแยกที่หยุดอยู่
  options: number[]; // ช่องปลายทางให้เลือก
  remaining: number; // แต้มที่ยังต้องเดินต่อ (รวมก้าวที่จะก้าวเข้าเส้นที่เลือก)
}

// สัญญาณเอฟเฟกต์ฉลอง (คอนเฟตติ/มาสคอต/เหรียญเด้ง) — UI เฝ้าดู id ที่เปลี่ยน
export type FxKind = 'correct' | 'wrong' | 'unlock' | 'coin';
export interface FxSignal {
  id: number;
  kind: FxKind;
  coins: number;
  kingId?: string; // ตั้งเมื่อชนะ "เหรียญกษัตริย์" — UI เอาไปโชว์เหรียญพระองค์นั้นเด้งฉลอง
}
let fxCounter = 0;

// ── รุ่นของเกม (generation guard) ──
// runMovement เดินหมากแบบ async (await ทีละก้าว ~180ms) แต่ผู้เล่นกดออกจากเกมได้ตลอดเวลา
// (ปุ่ม 🏠 และปุ่ม back เบราว์เซอร์ ไม่มี guard เรื่อง phase) → backToHome ตั้ง players = []
// ทำให้ loop ที่ยังค้างอยู่อ่าน players[idx] ได้ undefined แล้วโยน TypeError
// ที่แย่กว่านั้น: ถ้าเริ่มเกมใหม่ทันภายในจังหวะนั้น loop เก่าจะไปเดินหมาก "เกมใหม่" ต่อเอง
// → ทุกครั้งที่เริ่ม/ออกจากเกม เพิ่มเลขรุ่น แล้วให้ทุก loop ตรวจหลัง await ว่ายังเป็นรุ่นตัวเองอยู่ไหม
let gameGen = 0;
function isStale(gen: number, get: any, idx: number): boolean {
  return gen !== gameGen || !get().players[idx];
}

export const MAX_HEARTS = 3;

// ── บันทึกเกม (resume อัตโนมัติภายในเวลาที่กำหนด) ──
export const SAVE_TTL_MS = 15 * 60 * 1000; // 15 นาที: เกินนี้เซฟหมดอายุ เริ่มใหม่ที่หน้า Home
const SAVE_KEY = 'bg7_save';
// phase ชั่วคราว (rolling/moving/forking/resolving) resume ไม่ได้ → เก็บเป็น idle เสมอ
function savablePhase(phase: GamePhase): GamePhase {
  return phase === 'setup' || phase === 'gameover' ? phase : 'idle';
}

// ── ไอเทมพาวเวอร์อัพ ──
export type ItemType = 'fiftyFifty' | 'skip' | 'double' | 'heartPotion';
export const ITEM_META: Record<ItemType, { icon: string; label: string }> = {
  fiftyFifty: { icon: '✂️', label: '50:50' },
  skip: { icon: '⏭️', label: 'ข้ามคำถาม' },
  double: { icon: '✨', label: '×2 เหรียญ' },
  heartPotion: { icon: '💖', label: 'ยารักษา' },
};
// ราคาไอเทมในร้านค้า (ใช้เหรียญราชภักดิ์ซื้อ) — coin sink หลักของเกม
export const ITEM_PRICE: Record<ItemType, number> = {
  fiftyFifty: 80,
  skip: 120,
  double: 150,
  heartPotion: 100,
};
export const HINT_PRICE = 60; // ค่าคำใบ้ในช่องมงกุฎ AR (ตัดคำตอบผิด 2 ข้อ)
export type ItemBag = Record<ItemType, number>;

// ตัวคูณคอมโบ (ตอบถูกติดกัน) — คืนค่าตามจำนวน streak หลังบวก
function comboMult(streak: number): number {
  return streak <= 1 ? 1 : streak === 2 ? 1.5 : streak === 3 ? 2 : 3;
}

// ── Teacher Mode (การตั้งค่าโดยครู) ──
export interface Settings {
  timerEnabled: boolean; // เปิดตัวจับเวลาคำถาม
  difficulty: Difficulty | 'all'; // คัดคำถามตามระดับความยาก
  soundEnabled: boolean; // เสียง + haptic
  arEnabled: boolean; // เปิดปุ่ม AR
  // 💤 พักงานอยู่ — ไม่มีโค้ดไหนอ่านค่านี้แล้ว (`cardMode={false}` ฮาร์ดโค้ดทั้ง CardModal และ GoldArPage)
  // เพราะการส่องการ์ดย้ายไปใช้ AR ภายนอกแล้ว จึง **ถอดสวิตช์ออกจากจอโหมดครู** เพื่อไม่ให้ครู
  // กดแล้วไม่มีอะไรเกิดขึ้น · จะเอา MindAR กลับต้องเปิด `cardMode` ที่ 2 จุดนั้นแล้วค่อยเติมสวิตช์คืน
  arCardMode: boolean;
  calibrate: boolean; // โหมดปรับตำแหน่งช่องบนภาพกระดาน (สำหรับผู้ดูแล)
  showTileIcons: boolean; // แสดงไอคอนบอกว่าช่องนั้นเป็นเกมอะไร
  qrAnswerMode: boolean; // ช่องคำถาม/สาระ → โชว์ QR ให้สแกนตอบบนมือถือส่วนตัว (แทนตอบบน tablet)
  // ── รูปแบบการตอบของการ์ดฟ้า/สาระ (การ์ดทองใช้ลาก+จีบนิ้วเสมออยู่แล้ว) ──
  dragAnswerMode: boolean; // ตอบแบบ "ลากคำตอบไปวางในช่อง" แทนปุ่มกด (ใช้ได้ทั้งบนแท็บเล็ตและมือถือ)
  // ⚠️ จีบนิ้วผ่านกล้อง = ต้องโหลด MediaPipe (wasm 11 MB + โมเดล 7.8 MB) ต่อ 1 เครื่อง
  // และการ์ดฟ้า/สาระเจอบ่อยกว่าช่องทองมาก → พึ่ง service worker แคช `/mediapipe/` ให้ทน reload
  // (ลงทะเบียนครบทั้ง 3 entry แล้ว) · เครื่องที่กล้อง/ตรวจจับมือไม่ไหวยังถอยไปแตะลาก/ปุ่มกดได้เอง
  handAnswerMode: boolean; // ใช้จีบนิ้วผ่านกล้องแทนการแตะลาก (มีผลเมื่อ dragAnswerMode เปิด)
  // โหมดนำเสนอ: ช่องเดินเปล่ากลายเป็นช่องทองหมด → เจอบทเรียน AR บ่อยขึ้นมากตอนสาธิตให้คนดู
  // (ช่องเดินเปล่ามี 14 ใน 46 → ความถี่เจอการ์ดทองขยับจากราว 13% เป็น ~43% ของเทิร์น)
  goldBoostMode: boolean;
  // ปุ่ม "ตอบถูก/ตอบผิด" ที่ครูกดเองบนจอ QR — **ปิดเป็นค่าเริ่มต้น** เพื่อกันเด็กกดข้ามคำถามเอง
  // ⚠️ ซ่อนได้เฉพาะตอนมี backend คอยส่งผลอัตโนมัติ — ถ้า `auto === false` จอบังคับโชว์เสมอ
  //    ไม่งั้นเกมไม่มีทางเดินต่อ · และมีปุ่ม "ข้ามข้อนี้" เป็นทางออกฉุกเฉินไว้ทุกกรณีแล้ว
  manualResultButtons: boolean;
  targetCoins: number; // เก็บเหรียญกษัตริย์กี่เหรียญถึงชนะ (ครูปรับตามเวลาที่มีในคาบ)
  // ── แบบทดสอบก่อนเรียน/หลังเรียน (สถานะการทำอยู่ที่ testStore.ts ที่นี่เก็บแค่สวิตช์ครู) ──
  testEnabled: boolean; // โชว์การ์ดแบบทดสอบที่หน้า Home
  // ⚠️ ค่าเริ่มต้นต้องเป็น 'post' — เฉลยตอนก่อนเรียนเมื่อไหร่ แบบทดสอบหลังเรียนจะกลายเป็น
  // การวัด "ความจำเฉลย" แทน "สิ่งที่ได้จากเกม" แล้วตัวเลขพัฒนาการที่ครูเอาไปใช้จะไม่มีความหมาย
  testShowExplain: 'post' | 'always' | 'never';
  testTimeLimitMin: number; // 0 = ไม่จับเวลา (ค่าเริ่มต้น 60 ตามหัวกระดาษของครู)
  // สลับลำดับข้อ+ตัวเลือกในรอบหลังเรียน — **ปิดเป็นค่าเริ่มต้น** เพื่อให้ทุกเครื่องตรงกับ
  // ฉบับกระดาษของครูเป๊ะ ๆ (ครูอ่านโจทย์ตามได้ ตรวจเทียบกับกระดาษได้)
  // เปิดเมื่อต้องการกันเด็กจำตำแหน่งเฉลยจากรอบก่อนเรียน/ลอกเพื่อนข้าง ๆ
  testShuffle: boolean;
  // ส่งชื่อ-นามสกุลไปยังระบบของโรงเรียนด้วยไหม — **เปิดเป็นค่าเริ่มต้น**
  // (ตัดสินใจโดยเจ้าของโปรเจกต์): ครูต้องใช้ชื่อคู่กับคะแนนในการบันทึกผลการเรียน
  // ถ้าส่งแต่เลขที่ ครูต้องมานั่งไล่เทียบบัญชีรายชื่อเองทุกครั้ง
  // ปิดได้เมื่อโรงเรียนไม่ต้องการให้ชื่อนักเรียนออกจากเครื่อง (เก็บแค่ในแท็บเล็ต)
  testSendName: boolean;
  // ยอมให้นักเรียนคนเดิมทำแบบทดสอบรอบเดิมซ้ำได้ไหม — **ปิดเป็นค่าเริ่มต้น**
  // ก่อนเรียน: ทำซ้ำแล้ว "คะแนนตั้งต้น" ใช้ไม่ได้ (เห็นข้อสอบมาแล้ว) และถ้ารอบสองได้สูงขึ้น
  //   ตัวเลขพัฒนาการ (หลัง − ก่อน) จะ **หดลง** ทั้งที่เด็กไม่ได้แย่ลง
  // หลังเรียน: จอผลเฉลยครบทั้ง 30 ข้อ ทำซ้ำทันทีก็ได้เต็มทุกคน = คะแนนเฟ้อ
  // เปิดเมื่อมีเหตุจริง (แท็บเล็ตดับกลางคัน / กรอกเลขที่ผิด / เด็กมาสอบชดเชย)
  testAllowRetake: boolean;
}

// จำนวนเหรียญที่ต้องเก็บเพื่อชนะ — ปรับได้ใน Teacher Mode
// ค่าเริ่มต้น 7 = เก็บครบทุกพระองค์ (ตัดสินใจโดยเจ้าของโปรเจกต์ 2026-07-31)
// ⚠️ ต้องรู้ว่าแลกมากับเวลา: ช่องทองวงนอกมี 6 ช่องใน 46 ช่อง + ต้อง "ลงพอดี" เท่านั้น
// → ลูกเต๋าเฉลี่ย 3.5 ก้าว ได้ลงช่องทองราว 0.13 ครั้ง/เทิร์น = 1 ครั้งต่อ ~7.7 เทิร์น
// 7 เหรียญ ⇒ ผู้ชนะเล่น ~54 เทิร์น (4 คน ≈ 216 เทิร์นรวม ≈ 1.8 ชม. = เกินคาบเรียนปกติ)
// 3 เหรียญ ⇒ ~23 เทิร์น ≈ 45 นาที · ถ้าคาบสั้น ให้ครูลดเป็น 3-5 ในโหมดครู
// (จะให้ 7 จบทันคาบต้องเพิ่มจำนวนช่องทองบนกระดาน ไม่ใช่แก้ค่านี้)
export const TARGET_COINS_MIN = 1;
export const TARGET_COINS_MAX = 7;
export const DEFAULT_TARGET_COINS = 7;
// กันค่าเพี้ยนจากเซฟเก่า/ค่าที่แก้มือ — ใช้ทุกที่ที่อ่านเป้าหมาย
export function clampTargetCoins(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_TARGET_COINS;
  return Math.min(TARGET_COINS_MAX, Math.max(TARGET_COINS_MIN, Math.round(n)));
}

const DEFAULT_SETTINGS: Settings = {
  timerEnabled: true,
  difficulty: 'all',
  soundEnabled: true,
  arEnabled: true,
  arCardMode: true, // เปิดโหมดส่องการ์ดจริงเป็นค่าเริ่มต้น เมื่อมี public/ar/gold-card.mind แล้ว
  calibrate: false,
  showTileIcons: true,
  qrAnswerMode: true, // ตอบบนมือถือส่วนตัวเป็นค่าเริ่มต้น — คำถามไม่โผล่บนจอกลาง ผู้เล่นอื่นไม่เห็นเฉลย
  goldBoostMode: false,
  manualResultButtons: false, // ซ่อนไว้ก่อน — ให้ผลมาจากมือถือจริงเท่านั้น
  dragAnswerMode: true, // ตอบแบบลากคำตอบเป็นค่าเริ่มต้นทุกการ์ด (ให้ฟีลเดียวกับการ์ดทอง)
  handAnswerMode: true, // จีบนิ้วผ่านกล้องเป็นค่าเริ่มต้น — ครูปิดเองได้ถ้าเน็ต/เครื่องไม่ไหว
  targetCoins: DEFAULT_TARGET_COINS,
  testEnabled: true,
  testShowExplain: 'post', // ก่อนเรียนห้ามเฉลย (ดูเหตุผลที่ประกาศ type)
  testTimeLimitMin: 60,
  testShuffle: false, // ให้ตรงกับฉบับกระดาษของครูเป็นค่าเริ่มต้น
  testSendName: true, // ครูต้องใช้ชื่อคู่กับคะแนนในการบันทึกผลการเรียน
  testAllowRetake: false, // กันคะแนนเฟ้อ/คะแนนตั้งต้นเสีย — ครูเปิดเองเมื่อมีเหตุจำเป็น
};

interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  lastRoll: number | null;
  pendingEvent: TileEvent | null; // ช่องที่หยุด รอ layout เปิดการ์ด
  round: number;
  settings: Settings;
  pendingFork: PendingFork | null; // ทางแยกที่รอผู้เล่นเลือก
  fx: FxSignal | null; // สัญญาณเอฟเฟกต์ล่าสุด
  streak: number; // ตอบถูกติดกันกี่ข้อ (คอมโบ)
  items: ItemBag; // คลังไอเทมพาวเวอร์อัพ
  doubleNext: boolean; // ×2 เหรียญรางวัลถัดไป
  usedQuizIds: string[]; // กันสุ่มคำถามซ้ำจนกว่าจะใช้ครบ pool
  exitPrompt: boolean; // เปิดกล่องยืนยันออกจากเกม (ปุ่ม 🏠 หรือปุ่ม back เบราว์เซอร์)
  room: RoomSession | null; // ห้องแข่งออนไลน์ (null = เล่นเดี่ยวตามปกติ)
  // ── การ์ดป่วนที่ทีมอื่นส่งมา ──
  pendingCardEffects: EffectKind[]; // รอลงกับ "การ์ดใบถัดไป" (storm / hardQuiz)
  cardEffects: EffectKind[]; // ผลที่ติดอยู่กับการ์ดที่เปิดอยู่ตอนนี้
  rollCap: number | null; // เพดานแต้มของการทอยครั้งถัดไป (จากการ์ดช้างขวางทาง)
  pendingBack: number; // ถอยหลังกี่ช่องก่อนทอยครั้งถัดไป (จากการ์ดย้อนรอย)
  sabotageWait: number; // เหลืออีกกี่วินาทีถึงส่งการ์ดป่วนใบถัดไปได้ (0 = พร้อม)
  outgoingSabotage: { to: string; kind: EffectKind } | null; // รอ heartbeat ฝากไปกับ sync รอบหน้า
  sabotageNotice: { id: number; from: string; kind: EffectKind } | null; // ป้ายแจ้งเตือน "โดนป่วน"
  sabotageFeedback: { id: number; ok: boolean; message: string } | null; // ผลของการ์ดที่เราส่งไป

  // actions
  setupGame: (count: number, kingTokenIds?: string[], names?: string[]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  roll: () => Promise<void>;
  chooseBranch: (dest: number) => Promise<void>;
  resolveReward: (coins: number) => void;
  answerQuiz: (correct: boolean, baseReward: number) => void;
  answerKingCoin: (correct: boolean, kingId: string) => void;
  collectKnowledge: (cardId: string, coins: number) => void;
  markQuizSeen: (id: string) => void;
  giveItem: (type: ItemType) => void;
  useItem: (type: ItemType) => boolean;
  buyItem: (type: ItemType) => boolean;
  buyHint: () => boolean;
  applyPenalty: (back: number, skip: number) => void;
  closeEvent: () => void;
  nextTurn: () => void;
  backToHome: () => void;
  requestExit: () => void;
  cancelExit: () => void;
  confirmExit: () => void;
  enterRoom: (session: RoomSession) => void;
  updateRoomState: (state: RoomState) => void;
  setRoomOffline: (offline: boolean) => void;
  setSabotageWait: (sec: number) => void;
  leaveRoomSession: () => void;
  receiveEffects: (effects: RoomEffect[]) => void;
  queueSabotage: (to: string, kind: EffectKind) => boolean;
  resolveSabotageSend: (result: SendResult | null) => void;
  clearSabotageNotice: () => void;
  clearSabotageFeedback: () => void;
}

// ── ห้องแข่งออนไลน์ ──
// เกมยังเดินด้วย store นี้เหมือนเดิมทุกอย่าง ห้องเป็นแค่ "กระดานคะแนนกลาง" ที่รับแต้มไปแสดง
// ⚠️ ในโหมดห้อง **เกมท้องถิ่นไม่จบเอง** — ห้องเป็นคนจบ (หมดเวลา หรือมีทีมถึงเป้า)
// เพราะคะแนนทีมคือ "ผลรวมเหรียญของทุกคนในเครื่อง" ซึ่งถึงเป้าได้ก่อนที่ผู้เล่นคนใดคนหนึ่งจะถึง
// ถ้าปล่อยให้เช็กแบบเดิมด้วย เกมจะจบไม่พร้อมกันระหว่างจอกับห้อง = อันดับเพี้ยน
export interface RoomSession {
  code: string;
  teamToken: string;
  teamName: string;
  isHost: boolean;
  state: RoomState | null; // สถานะล่าสุดที่ได้จาก server (null = ยังไม่เคยซิงก์สำเร็จ)
  offline: boolean; // sync ล่าสุดล้มเหลว — เกมเดินต่อได้ แต่แถบอันดับค้าง
}

/** คะแนนทีม = ผลรวมเหรียญกษัตริย์ของทุกคนในเครื่อง (ห้องล็อกจำนวนผู้เล่นให้เท่ากันทุกทีม) */
export function teamKingCoins(players: Player[]): number {
  return players.reduce((sum, p) => sum + p.kingCoins.length, 0);
}

export function teamCoins(players: Player[]): number {
  return players.reduce((sum, p) => sum + p.coins, 0);
}

const TOKENS = ['🐘', '⛵', '🛕', '🐉'];
const NAMES = ['ผู้เล่น 1', 'ผู้เล่น 2', 'ผู้เล่น 3', 'ผู้เล่น 4'];

function makeTileEvent(tile: Tile): TileEvent | null {
  // ช่องเดินเปล่า (blank) ไม่มี modal — จบเทิร์นเลย
  if (tile.type === 'blank') return null;
  return { tile, kind: tile.type };
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
  players: [],
  currentPlayerIndex: 0,
  phase: 'setup',
  lastRoll: null,
  pendingEvent: null,
  round: 1,
  settings: DEFAULT_SETTINGS,
  pendingFork: null,
  fx: null,
  streak: 0,
  items: { fiftyFifty: 0, skip: 0, double: 0, heartPotion: 0 },
  doubleNext: false,
  usedQuizIds: [],
  exitPrompt: false,
  room: null,
  pendingCardEffects: [],
  cardEffects: [],
  rollCap: null,
  pendingBack: 0,
  sabotageWait: 0,
  outgoingSabotage: null,
  sabotageNotice: null,
  sabotageFeedback: null,

  setupGame: (count, kingTokenIds = KING_IDS, names) => {
    gameGen++; // เกมใหม่: loop เดินหมากของเกมก่อนหน้า (ถ้ายังค้าง) ต้องหยุดทันที
    const players: Player[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      name: names?.[i]?.trim() || NAMES[i], // ชื่อที่ผู้เล่นกรอกเอง (ว่าง = ใช้ชื่อเริ่มต้น)
      token: TOKENS[i],
      kingTokenId: kingTokenIds[i] ?? KING_IDS[i % KING_IDS.length],
      position: 0,
      coins: 0,
      hearts: MAX_HEARTS,
      kingCoins: [],
      skipNext: 0,
      knowledgeCards: [],
    }));
    set({
      players,
      currentPlayerIndex: 0,
      phase: 'idle',
      round: 1,
      lastRoll: null,
      pendingEvent: null,
      pendingFork: null,
      fx: null,
      streak: 0,
      items: { fiftyFifty: 0, skip: 0, double: 0, heartPotion: 0 },
      doubleNext: false,
      usedQuizIds: [],
      pendingCardEffects: [],
      cardEffects: [],
      rollCap: null,
      pendingBack: 0,
      outgoingSabotage: null,
      sabotageNotice: null,
    });
    if (get().settings.soundEnabled) startBackgroundMusic();
  },

  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    if (patch.soundEnabled !== undefined) {
      setSoundEnabled(patch.soundEnabled);
      if (patch.soundEnabled && get().phase !== 'setup' && get().phase !== 'gameover') startBackgroundMusic();
    }
    set({ settings: next });
  },

  roll: async () => {
    const { phase } = get();
    if (phase !== 'idle') return;

    // การ์ด "ย้อนรอย": ถอยหลังก่อนทอย — ทำตรงนี้เพราะเป็นจังหวะเดียวที่หมากอยู่นิ่งแน่นอน
    // ⚠️ ข้ามถ้าอยู่ในเลนแยก (index ≥ LOOP) เพราะ applyPenalty คิดด้วย %LOOP ซึ่งใช้กับวงนอกเท่านั้น
    // ถ้าไม่กัน หมากจะวาร์ปข้ามกระดานแบบหาสาเหตุไม่เจอ (กับดักเดียวกับ applyChance)
    const back = get().pendingBack;
    if (back > 0) {
      const pos = get().players[get().currentPlayerIndex]?.position ?? 0;
      if (pos < LOOP) get().applyPenalty(back, 0);
      set({ pendingBack: 0 });
    }

    // การ์ด "ช้างขวางทาง" จากทีมอื่น: จำกัดแต้มของการทอยครั้งนี้ แล้วใช้แล้วหมดไป
    // (ยังได้ทอย ได้เดิน ได้เปิดการ์ด — แค่ไปได้ไม่ไกล ตรงตามกฎ "ป่วน ≠ ทำให้หยุดเล่น")
    const cap = get().rollCap;
    const value = cap === null ? rollDie() : Math.min(rollDie(), cap);
    const gen = gameGen; // ผูกการเดินครั้งนี้กับรุ่นเกมปัจจุบัน
    set({ phase: 'rolling', lastRoll: value, rollCap: null });
    startBackgroundMusic();
    sfx.roll();

    // อนิเมชันทอยแบบลุ้น (ลูกเต๋าหมุนสลับเลข)
    await wait(850);

    // เผยเลข: หยุดหมุน โชว์เลขที่ทอยได้ แล้วหน่วงให้เห็นก่อนเดิน
    set({ phase: 'moving' });
    sfx.reveal();
    await wait(350);
    if (gen !== gameGen) return; // ออกจากเกม/เริ่มใหม่ระหว่างอนิเมชันทอย
    const idx = get().currentPlayerIndex;
    await runMovement(set, get, idx, value, gen);
  },

  // ผู้เล่นเลือกเส้นทางที่ทางแยก → ก้าวเข้าเส้นที่เลือก แล้วเดินแต้มที่เหลือต่อ
  chooseBranch: async (dest) => {
    const { pendingFork, currentPlayerIndex } = get();
    if (!pendingFork || !pendingFork.options.includes(dest)) return;
    const idx = currentPlayerIndex;
    const remaining = pendingFork.remaining;
    const gen = gameGen;
    set({ phase: 'moving', pendingFork: null });
    if (!(await stepTo(set, get, idx, dest, gen))) return;
    await runMovement(set, get, idx, remaining - 1, gen);
  },

  resolveReward: (coins) => {
    const idx = get().currentPlayerIndex;
    const kind: FxKind = coins > 0 ? 'correct' : 'wrong';
    if (kind === 'correct') sfx.correct();
    else sfx.wrong();
    // ×2 เหรียญ ถ้าติดสถานะไว้
    let gain = coins;
    let usedDouble = false;
    if (gain > 0 && get().doubleNext) {
      gain *= 2;
      usedDouble = true;
    }
    set((s) => ({
      players: s.players.map((p, i) => (i === idx ? { ...p, coins: p.coins + gain } : p)),
      doubleNext: usedDouble ? false : s.doubleNext,
      fx: { id: ++fxCounter, kind, coins: gain },
    }));
  },

  // ตอบคำถาม — จัดการคอมโบ + ×2 (ได้เหรียญปกติ)
  answerQuiz: (correct, baseReward) => {
    const idx = get().currentPlayerIndex;
    const { streak, doubleNext } = get();

    if (!correct) {
      sfx.wrong();
      damageCurrentPlayer(set, get);
      set({ streak: 0, fx: { id: ++fxCounter, kind: 'wrong', coins: 0 } });
      return;
    }

    const newStreak = streak + 1;
    let coins = Math.round(baseReward * comboMult(newStreak));
    let usedDouble = false;
    if (doubleNext) {
      coins *= 2;
      usedDouble = true;
    }
    // ตอบถูกทั้งที่โดนป่วน = ได้โบนัสแก้เผ็ด — เปลี่ยน "ถูกกลั่นแกล้ง" ให้เป็นโอกาส
    // สำคัญในห้องเรียน: เด็กที่โดนถล่มต้องไม่รู้สึกว่าโดนลงโทษฟรี ๆ โดยทำอะไรไม่ได้
    if (get().cardEffects.length > 0) coins += 40;

    sfx.correct();
    set((s) => ({
      players: s.players.map((p, i) => (i === idx ? { ...p, coins: p.coins + coins } : p)),
      streak: newStreak,
      doubleNext: usedDouble ? false : s.doubleNext,
      fx: { id: ++fxCounter, kind: 'correct', coins },
    }));
  },

  // ตอบคำถามที่ช่องทอง — ถูก = ได้ "เหรียญกษัตริย์" ของพระองค์นั้น (เงื่อนไขชนะ)
  answerKingCoin: (correct, kingId) => {
    const idx = get().currentPlayerIndex;
    if (!correct) {
      sfx.wrong();
      damageCurrentPlayer(set, get);
      set({ streak: 0, fx: { id: ++fxCounter, kind: 'wrong', coins: 0 } });
      return;
    }
    const reward = 120; // เหรียญราชภักดิ์ที่ได้พ่วงมากับเหรียญกษัตริย์
    sfx.unlock();
    set((s) => ({
      players: s.players.map((p, i) => {
        if (i !== idx) return p;
        const kingCoins = p.kingCoins.includes(kingId) ? p.kingCoins : [...p.kingCoins, kingId];
        return { ...p, kingCoins, coins: p.coins + reward };
      }),
      fx: { id: ++fxCounter, kind: 'unlock', coins: reward, kingId },
    }));
  },

  // เก็บการ์ดความรู้ (ช่องชมพู) — สะสมได้สูงสุด 10 ใบ/คน, ให้เหรียญเฉพาะใบใหม่
  collectKnowledge: (cardId, coins) => {
    const idx = get().currentPlayerIndex;
    let added = false;
    set((s) => ({
      players: s.players.map((p, i) => {
        if (i !== idx) return p;
        const already = p.knowledgeCards.includes(cardId);
        const canAdd = !already && p.knowledgeCards.length < 10;
        if (canAdd) added = true;
        const knowledgeCards = canAdd ? [...p.knowledgeCards, cardId] : p.knowledgeCards;
        return { ...p, knowledgeCards, coins: p.coins + (canAdd ? coins : 0) };
      }),
      fx: { id: ++fxCounter, kind: 'correct', coins: added ? coins : 0 },
    }));
    sfx.correct();
  },

  markQuizSeen: (id) => {
    set((s) => (s.usedQuizIds.includes(id) ? s : { usedQuizIds: [...s.usedQuizIds, id] }));
  },

  giveItem: (type) => {
    set((s) => ({ items: { ...s.items, [type]: s.items[type] + 1 } }));
  },

  // ซื้อไอเทมด้วยเหรียญราชภักดิ์ของผู้เล่นปัจจุบัน — คืน true ถ้าเงินพอ
  buyItem: (type) => {
    const price = ITEM_PRICE[type];
    const idx = get().currentPlayerIndex;
    const player = get().players[idx];
    if (!player || player.coins < price) return false;
    sfx.coin();
    set((s) => ({
      players: s.players.map((p, i) => (i === idx ? { ...p, coins: p.coins - price } : p)),
      items: { ...s.items, [type]: s.items[type] + 1 },
      fx: { id: ++fxCounter, kind: 'coin', coins: 0 },
    }));
    return true;
  },

  // ซื้อคำใบ้ในช่องมงกุฎ AR — หักเหรียญผู้เล่นปัจจุบัน (คืน true ถ้าเงินพอ)
  buyHint: () => {
    const idx = get().currentPlayerIndex;
    const player = get().players[idx];
    if (!player || player.coins < HINT_PRICE) return false;
    sfx.coin();
    set((s) => ({
      players: s.players.map((p, i) => (i === idx ? { ...p, coins: p.coins - HINT_PRICE } : p)),
    }));
    return true;
  },

  // ใช้ไอเทม — คืน true ถ้ามีของและใช้สำเร็จ ('double' ติดสถานะ ×2 รางวัลถัดไป)
  useItem: (type) => {
    if (get().items[type] <= 0) return false;
    if (type === 'heartPotion') {
      const idx = get().currentPlayerIndex;
      const player = get().players[idx];
      if (!player || player.hearts >= MAX_HEARTS) return false;
      sfx.correct();
      set((s) => ({
        items: { ...s.items, heartPotion: s.items.heartPotion - 1 },
        players: s.players.map((p, i) =>
          i === idx ? { ...p, hearts: Math.min(MAX_HEARTS, p.hearts + 1) } : p
        ),
        fx: { id: ++fxCounter, kind: 'correct', coins: 0 },
      }));
      return true;
    }
    set((s) => ({
      items: { ...s.items, [type]: s.items[type] - 1 },
      doubleNext: type === 'double' ? true : s.doubleNext,
    }));
    return true;
  },

  // ช่องทำโทษ: back = ถอยหลัง N ช่อง (บนวงนอกเท่านั้น) · skip = สะสมตาหยุดพัก
  applyPenalty: (back, skip) => {
    const idx = get().currentPlayerIndex;
    if (back > 0) sfx.step();
    else sfx.wrong();
    set((s) => ({
      players: s.players.map((p, i) => {
        if (i !== idx) return p;
        const pos = back > 0 ? (((p.position - back) % LOOP) + LOOP) % LOOP : p.position;
        return { ...p, position: pos, skipNext: p.skipNext + (skip > 0 ? skip : 0) };
      }),
      fx: { id: ++fxCounter, kind: 'wrong', coins: 0 },
    }));
  },

  closeEvent: () => {
    finishTurn(set, get);
  },

  nextTurn: () => {
    finishTurn(set, get);
  },

  backToHome: () => {
    gameGen++; // ออกจากเกม: ตัด loop เดินหมากที่ยัง await ค้างอยู่ ไม่ให้ไปอ่าน players ที่ถูกล้างแล้ว
    stopAllAudio(); // ไม่ใช่แค่เพลงพื้นหลัง — เสียงลุ้น/เพลงฉลองต้องไม่ตามกลับไปที่หน้า Home
    // ออกจากเกม = ออกจากห้องแข่งด้วย (ไม่งั้น heartbeat จะยิงแต้มของเกมที่ไม่มีอยู่แล้วต่อไป)
    set({
      players: [],
      phase: 'setup',
      currentPlayerIndex: 0,
      round: 1,
      lastRoll: null,
      pendingEvent: null,
      room: null,
      pendingCardEffects: [],
      cardEffects: [],
      rollCap: null,
      pendingBack: 0,
      outgoingSabotage: null,
      sabotageNotice: null,
    });
  },

  // เปิด/ปิด/ยืนยัน กล่องออกจากเกม — เส้นทางออกทั้งปุ่ม 🏠 และปุ่ม back เบราว์เซอร์รวมมาที่นี่
  requestExit: () => set({ exitPrompt: true }),
  cancelExit: () => set({ exitPrompt: false }),
  confirmExit: () => {
    set({ exitPrompt: false });
    get().backToHome();
  },

  // ── ห้องแข่ง ── store เก็บแค่ "เราอยู่ห้องไหน + อันดับล่าสุด" ไม่มีกติกาเกมอยู่ในนี้
  enterRoom: (session) => set({ room: session }),
  updateRoomState: (state) => {
    const room = get().room;
    if (!room) return; // ออกจากห้องไปแล้วระหว่างที่คำขอค้างอยู่ — ทิ้งผลลัพธ์
    set({ room: { ...room, state, offline: false } });
    // ห้องประกาศจบ (หมดเวลา / มีทีมถึงเป้า) = จบเกมบนเครื่องนี้ด้วย
    // ต้องเช็ก phase ก่อน ไม่งั้นจะยิง sfx.win ซ้ำทุกครั้งที่ poll หลังจบไปแล้ว
    if (state.room.status === 'ended' && get().phase !== 'gameover' && get().phase !== 'setup') {
      sfx.win();
      set({ phase: 'gameover', lastRoll: null, pendingEvent: null, pendingFork: null });
    }
  },
  setSabotageWait: (sec) => {
    if (get().sabotageWait === sec) return; // กัน re-render ทุกรอบ poll
    set({ sabotageWait: sec });
  },

  setRoomOffline: (offline) => {
    const room = get().room;
    if (!room || room.offline === offline) return; // กัน set ซ้ำทุกรอบ poll = re-render ทั้งจอฟรี ๆ
    set({ room: { ...room, offline } });
  },
  leaveRoomSession: () =>
    set({ room: null, pendingCardEffects: [], cardEffects: [], rollCap: null, outgoingSabotage: null }),

  // ── การ์ดป่วนที่ถูกส่งมาถึงเรา ──
  // server ส่งมอบครั้งเดียว (ปิด delivered ตอนอ่าน) → ที่นี่ต้องลงผลให้ครบ ห้ามทิ้ง
  // ผลทั้งหมดเป็นแบบ "ครั้งหน้า" ยกเว้นริบเหรียญที่ลงทันที เพราะไม่ต้องรอจังหวะอะไร
  receiveEffects: (effects) => {
    if (!effects.length) return;
    const idx = get().currentPlayerIndex;
    const cardKinds: EffectKind[] = [];
    let cap = get().rollCap;
    let back = get().pendingBack;
    let stolen = 0;

    for (const e of effects) {
      if (e.kind === 'steal') stolen += STEAL_LOSS;
      else if (e.kind === 'block') cap = BLOCK_STEPS;
      else if (e.kind === 'rewind') back += REWIND_STEPS;
      else if (e.kind === 'ghost') continue; // ตลกล้วน ไม่มีผลกับเกม — เด้งแค่ป้ายแจ้งเตือน
      else cardKinds.push(e.kind); // storm / hardQuiz / lockItems → ลงกับการ์ดใบถัดไป
    }

    set((s) => ({
      players: stolen
        ? s.players.map((p, i) => (i === idx ? { ...p, coins: Math.max(0, p.coins - stolen) } : p))
        : s.players,
      pendingBack: back,
      // เก็บได้ไม่เกิน 2 ใบ (ตรงกับเพดานฝั่ง server) — ที่เกินทิ้ง ไม่สะสมไว้ถล่มทีหลัง
      pendingCardEffects: [...s.pendingCardEffects, ...cardKinds].slice(0, 2),
      rollCap: cap,
      // แจ้งเตือนใบล่าสุด — ต้องบอกว่า "ใครส่งมา" ไม่งั้นมันเป็นแค่ความซวยลอย ๆ ไม่มีใครอยากเอาคืน
      sabotageNotice: { id: ++fxCounter, from: effects[effects.length - 1].from, kind: effects[effects.length - 1].kind },
    }));
    sfx.wrong();
  },

  clearSabotageNotice: () => set({ sabotageNotice: null }),

  // จ่ายเหรียญของตัวเองเพื่อถ่วงทีมที่นำอยู่ — หักเหรียญทันที แล้วให้ heartbeat ฝากไปกับ sync รอบหน้า
  // (server เป็นคนตัดสินกฎจริงทั้งหมด ที่นี่แค่กันกดซ้ำและกันเหรียญไม่พอ)
  queueSabotage: (to, kind) => {
    const { room, outgoingSabotage, currentPlayerIndex, players } = get();
    if (!room || outgoingSabotage) return false;
    const price = EFFECTS[kind].price;
    const player = players[currentPlayerIndex];
    if (!player || player.coins < price) return false;
    sfx.coin();
    set((s) => ({
      players: s.players.map((p, i) => (i === currentPlayerIndex ? { ...p, coins: p.coins - price } : p)),
      outgoingSabotage: { to, kind },
    }));
    return true;
  },

  // server ตอบกลับว่ารับหรือปฏิเสธการ์ดที่ส่งไป — ถูกปฏิเสธต้อง **คืนเหรียญ** ที่หักไปตอนกด
  // (หักตั้งแต่ตอนกดเพื่อให้ผู้เล่นเห็นผลทันที ไม่ต้องรอ 3 วิ แต่ต้องแก้กลับให้ครบเมื่อไม่สำเร็จ)
  resolveSabotageSend: (result) => {
    const outgoing = get().outgoingSabotage;
    if (!outgoing) return;
    const failed = !result || !result.ok;
    const idx = get().currentPlayerIndex;
    // ล้มเหลว = คืนราคาเต็ม · สำเร็จและเป็น "โจรปล้น" = ได้ส่วนแบ่งที่ปล้นมา
    const delta = failed ? EFFECTS[outgoing.kind].price : outgoing.kind === 'steal' ? STEAL_GAIN : 0;
    set((s) => ({
      players: delta
        ? s.players.map((p, i) => (i === idx ? { ...p, coins: p.coins + delta } : p))
        : s.players,
      outgoingSabotage: null,
      sabotageFeedback: {
        id: ++fxCounter,
        ok: !failed,
        message: failed
          ? result
            ? sendErrorMessage(result)
            : 'ส่งการ์ดป่วนไม่สำเร็จ'
          : outgoing.kind === 'steal'
          ? `🥷 ปล้น ${outgoing.to} สำเร็จ · ได้ 🪙 ${STEAL_GAIN}`
          : `ส่ง ${EFFECTS[outgoing.kind].icon} ${EFFECTS[outgoing.kind].label} ไปที่ ${outgoing.to} แล้ว`,
      },
    }));
  },

  clearSabotageFeedback: () => set({ sabotageFeedback: null }),
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // เก็บเฉพาะ field ที่ serialize ได้ + เสถียร (fx/pendingEvent/pendingFork/exitPrompt ไม่เก็บ)
      partialize: (s) => ({
        players: s.players,
        currentPlayerIndex: s.currentPlayerIndex,
        round: s.round,
        settings: s.settings,
        streak: s.streak,
        items: s.items,
        doubleNext: s.doubleNext,
        usedQuizIds: s.usedQuizIds,
        // เก็บห้องแข่งไว้ด้วย — เผลอรีเฟรช/แอปถูก kill กลางแมตช์แล้วกลับเข้าห้องเดิมได้
        // (teamToken อยู่ในนี้ ถ้าหายต้อง join ใหม่ซึ่งชื่อทีมจะซ้ำแล้วเข้าไม่ได้)
        room: s.room,
        phase: savablePhase(s.phase),
        savedAt: Date.now(), // ประทับเวลาทุกครั้งที่ state เปลี่ยน = "เวลาที่เล่นล่าสุด"
      }),
      // เปิดแอป: resume เข้าเกมทันทีถ้าเซฟยังไม่หมดอายุ ไม่งั้นทิ้งเซฟ เริ่มที่หน้า Home
      merge: (persisted, current) => {
        const p = persisted as (Partial<GameState> & { savedAt?: number }) | undefined;
        const resumable =
          !!p &&
          p.phase === 'idle' &&
          Array.isArray(p.players) &&
          p.players.length > 0 &&
          typeof p.savedAt === 'number' &&
          Date.now() - p.savedAt <= SAVE_TTL_MS;
        // ⚠️ เซฟเกมหมดอายุ/ไม่มีอะไรให้ resume ก็ยัง **ต้องคืนค่าที่ครูตั้งไว้เสมอ**
        // เดิม `return current` ทิ้ง persisted ทั้งก้อนรวมถึง settings → ครูปรับสวิตช์
        // (เป้าเหรียญ/เวลาทำข้อสอบ/ส่งชื่อ ฯลฯ) แล้วพอรีโหลดจากหน้า Home ค่ากลับเป็นค่าเริ่มต้นหมด
        // เพราะ phase ตอนอยู่หน้า Home = 'setup' ซึ่งไม่เข้าเงื่อนไข resumable ตั้งแต่แรก
        // (settings เป็น "การตั้งค่าเครื่อง" ไม่ใช่ "เกมที่เล่นค้าง" อายุของเซฟจึงไม่ควรมีผลกับมัน)
        if (!resumable) {
          return { ...current, settings: { ...current.settings, ...(p?.settings ?? {}) } };
        }
        return {
          ...current,
          players: p.players as Player[],
          currentPlayerIndex: p.currentPlayerIndex ?? 0,
          round: p.round ?? 1,
          settings: { ...current.settings, ...(p.settings ?? {}) },
          streak: p.streak ?? 0,
          items: p.items ?? current.items,
          doubleNext: p.doubleNext ?? false,
          usedQuizIds: p.usedQuizIds ?? [],
          // สถานะห้องที่เซฟไว้อาจเก่าแล้ว — heartbeat รอบแรกจะเขียนทับให้เอง
          room: p.room ?? null,
          // snap กลับสถานะเสถียร: รอผู้เล่นปัจจุบันทอย (กัน phase ชั่วคราว/การ์ดค้างเมื่อ resume)
          phase: 'idle',
          pendingEvent: null,
          pendingFork: null,
          fx: null,
          lastRoll: null,
          exitPrompt: false,
        };
      },
    }
  )
);

// ── เดินหมากตามกราฟ (รองรับทางแยก) ──

// ก้าวไป 1 ช่อง (พร้อมเสียง + โบนัสผ่าน START)
// คืน false ถ้าเกมถูกออก/เริ่มใหม่ระหว่างรอ — ผู้เรียกต้องหยุดทันที
async function stepTo(set: any, get: any, idx: number, dest: number, gen: number): Promise<boolean> {
  await wait(180);
  if (isStale(gen, get, idx)) return false;
  sfx.step();
  const passReward = dest === 0 ? TILES[0].passReward ?? 0 : 0;
  set((s: GameState) => ({
    players: s.players.map((p, i) =>
      i === idx ? { ...p, position: dest, coins: p.coins + passReward } : p
    ),
  }));
  return true;
}

// เดิน `steps` ก้าวจากตำแหน่งปัจจุบัน — ถ้าเจอทางแยกจะหยุดรอผู้เล่นเลือก (phase 'forking')
async function runMovement(set: any, get: any, idx: number, steps: number, gen: number) {
  let remaining = steps;
  while (remaining > 0) {
    if (isStale(gen, get, idx)) return;
    const cur = get().players[idx].position as number;
    const nexts = TILES[cur].next ?? [(cur + 1) % LOOP];
    if (nexts.length > 1) {
      // ทางแยก: หยุด รอ action chooseBranch มาเดินต่อ
      set({ phase: 'forking', pendingFork: { from: cur, options: nexts, remaining } });
      return;
    }
    if (!(await stepTo(set, get, idx, nexts[0], gen))) return;
    remaining--;
  }
  await resolveLanding(set, get, idx, gen);
}

// หยุดที่ช่องปลายทาง → เปิดการ์ด/ให้เหรียญ ตามชนิดช่อง
async function resolveLanding(set: any, get: any, idx: number, gen: number) {
  if (isStale(gen, get, idx)) return;
  const player = get().players[idx];
  const tile = TILES[player.position] as Tile;

  // ── ดึงการ์ดป่วนที่รออยู่มาลงกับ "การ์ดใบนี้" ──
  // ทำที่นี่ที่เดียว (ไม่ใช่ใน UI) เพราะต้องเกิดครั้งเดียวต่อการลงช่อง 1 ครั้ง
  // ถ้าไปดึงตอน CardModal เรนเดอร์ StrictMode จะ mount ซ้ำแล้วผลหายไปเงียบ ๆ
  // ── โหมดนำเสนอ ── ช่องเดินเปล่ากลายเป็นช่องทอง เพื่อให้เห็นบทเรียน AR บ่อย ๆ ตอนสาธิต
  // แปลงที่นี่ที่เดียว (ไม่แตะ board-layout.json) → ปิดโหมดแล้วกระดานกลับเป็นปกติทันที
  // ลงพอดีจุดแยก (6/12/36 เป็นช่องเปล่า) ก็ยังปลอดภัย — resolve การ์ดก่อน แล้วทางแยกเด้งเทิร์นถัดไป
  // เหมือนที่ช่องโบนัส 32 ทำอยู่แล้ว
  const boosted =
    get().settings.goldBoostMode && tile.type === 'blank'
      ? ({ ...tile, type: 'goldking' } as Tile)
      : tile;

  const isCardTile =
    boosted.type === 'question' || boosted.type === 'subject' || boosted.type === 'goldking';
  if (isCardTile && get().pendingCardEffects.length) {
    set({ cardEffects: get().pendingCardEffects, pendingCardEffects: [] });
  }

  // ช่องทอง: หาพระองค์ถัดไปที่ยังไม่มีเหรียญ แล้วเปิดควิซชิงเหรียญกษัตริย์
  if (boosted.type === 'goldking') {
    const nextKing = KING_IDS.find((id) => !player.kingCoins.includes(id)) ?? null;
    if (!nextKing) {
      set({ phase: 'resolving' });
      await wait(300);
      if (isStale(gen, get, idx)) return;
      finishTurn(set, get);
      return;
    }
    set({
      phase: 'resolving',
      pendingEvent: { tile: { ...boosted, kingId: nextKing }, kind: 'goldking' },
    });
    return;
  }

  const event = makeTileEvent(tile);
  set({ phase: 'resolving', pendingEvent: event });
  if (!event) {
    await wait(500);
    if (isStale(gen, get, idx)) return;
    finishTurn(set, get);
  }
}

// จบเทิร์น: ส่งเทิร์นให้ผู้เล่นถัดไปเสมอ (ไม่มีโบนัสทอยซ้ำแล้ว — ทอย 6 = ส่งตาปกติ)
function finishTurn(set: any, get: any) {
  const { currentPlayerIndex, players, round } = get();
  // การ์ดใบนี้จบแล้ว ผลป่วนที่ติดอยู่กับมันต้องหมดไปด้วย (ไม่งั้นไปโผล่กับใบถัดไป)
  set({ pendingEvent: null, cardEffects: [] });

  // เงื่อนไขจบเกมทันที: มีผู้เล่นเก็บเหรียญกษัตริย์ครบตามเป้าที่ครูตั้งไว้
  // ⚠️ ยกเว้นโหมดห้องแข่ง — ที่นั่นคะแนนคือ "ผลรวมทั้งทีม" และ server เป็นคนประกาศจบ
  // (หมดเวลา หรือมีทีมถึงเป้า) ถ้าเช็กที่นี่ด้วย เครื่องจะจบไม่พร้อมห้อง = อันดับเพี้ยน
  const target = clampTargetCoins(get().settings.targetCoins);
  if (!get().room && players.some((p: Player) => p.kingCoins.length >= target)) {
    sfx.win();
    set({ phase: 'gameover', lastRoll: null });
    return;
  }

  // หาผู้เล่นคนถัดไปที่ไม่ได้ "หยุดพัก" — คนที่ติดโทษพักจะถูกข้าม (ลด skipNext ลง 1)
  let nextIndex = currentPlayerIndex;
  let nextRound = round;
  let found = false;
  const rested: number[] = [];
  for (let hop = 0; hop < players.length; hop++) {
    nextIndex = (nextIndex + 1) % players.length;
    if (nextIndex === 0) nextRound += 1;
    if (players[nextIndex].skipNext > 0) {
      rested.push(nextIndex); // คนนี้หยุดพัก ข้ามไป
      continue;
    }
    found = true;
    break; // เจอผู้เล่นที่พร้อมเล่น
  }

  // ทุกคนติดพักฟื้นพร้อมกัน (หัวใจหมดกันหมด/ลงช่องทำโทษพร้อมกัน) → ไม่มีใคร "พร้อมเล่น" เลย
  // ถ้าปล่อยไว้ loop จะวนกลับมาจบที่ nextIndex === currentPlayerIndex = **คนเดิมได้เล่นซ้ำ**
  // ทั้งที่ตัวเองก็เพิ่งติดพัก ส่วนคนถัดไปโดนข้ามฟรี (เห็นชัดมากตอนเล่น 2 คน)
  // ที่ถูกคือ: ถือว่าทุกคนพักไปพร้อมกัน 1 รอบ (rested มีครบทุกคนแล้ว จึงถูกลด skipNext ให้อยู่)
  // แล้วส่งเทิร์นต่อตามลำดับปกติ
  if (!found) nextIndex = (currentPlayerIndex + 1) % players.length;

  // เกมจบเฉพาะเมื่อมีผู้เล่นถึงเป้าเหรียญกษัตริย์ (เช็กด้านบน) — ไม่มีลิมิตรอบแล้ว

  set((s: GameState) => ({
    players: s.players.map((p, i) => {
      if (!rested.includes(i)) return p;
      const skipNext = Math.max(0, p.skipNext - 1);
      return { ...p, skipNext, hearts: skipNext === 0 && p.hearts <= 0 ? 1 : p.hearts };
    }),
    currentPlayerIndex: nextIndex,
    round: nextRound,
    phase: 'idle',
    lastRoll: null,
  }));
}

function damageCurrentPlayer(set: any, get: any) {
  const idx = get().currentPlayerIndex;
  set((s: GameState) => ({
    players: s.players.map((p, i) => {
      if (i !== idx) return p;
      const hearts = Math.max(0, p.hearts - 1);
      return {
        ...p,
        hearts,
        skipNext: hearts === 0 ? Math.max(p.skipNext, 1) : p.skipNext,
      };
    }),
  }));
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export { TILES, LOOP };
