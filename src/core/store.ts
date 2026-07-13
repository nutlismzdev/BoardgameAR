// State กลางของเกม (Zustand) — กติกาทั้งหมดอยู่ที่นี่
// ไฟล์ Layout (portrait/landscape) เพียงอ่าน state และเรียก action เท่านั้น ห้ามฝัง logic

import { create } from 'zustand';
import boardData from '@/data/board-layout.json';
import kingsData from '@/data/kings.json';
import type { Player, Tile, TileEvent, Difficulty } from './types';
import { rollDie, isBonusRoll } from './diceLogic';
import { sfx, setSoundEnabled, startBackgroundMusic, stopBackgroundMusic } from './sfx';

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

export const MAX_HEARTS = 3;

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
  arCardMode: boolean; // โหมดส่องการ์ดจริง (MindAR image-target) — ต้องมี public/ar/gold-card.mind
  calibrate: boolean; // โหมดปรับตำแหน่งช่องบนภาพกระดาน (สำหรับผู้ดูแล)
  showTileIcons: boolean; // แสดงไอคอนบอกว่าช่องนั้นเป็นเกมอะไร
}

const DEFAULT_SETTINGS: Settings = {
  timerEnabled: true,
  difficulty: 'all',
  soundEnabled: true,
  arEnabled: true,
  arCardMode: true, // เปิดโหมดส่องการ์ดจริงเป็นค่าเริ่มต้น เมื่อมี public/ar/gold-card.mind แล้ว
  calibrate: false,
  showTileIcons: true,
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
}

const TOKENS = ['🐘', '⛵', '🛕', '🐉'];
const NAMES = ['ผู้เล่น 1', 'ผู้เล่น 2', 'ผู้เล่น 3', 'ผู้เล่น 4'];

function makeTileEvent(tile: Tile): TileEvent | null {
  // ช่องเดินเปล่า (blank) ไม่มี modal — จบเทิร์นเลย
  if (tile.type === 'blank') return null;
  return { tile, kind: tile.type };
}

export const useGame = create<GameState>((set, get) => ({
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

  setupGame: (count, kingTokenIds = KING_IDS, names) => {
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

    const value = rollDie();
    set({ phase: 'rolling', lastRoll: value });
    startBackgroundMusic();
    sfx.roll();

    // อนิเมชันทอยแบบลุ้น (ลูกเต๋าหมุนสลับเลข)
    await wait(850);

    // เผยเลข: หยุดหมุน โชว์เลขที่ทอยได้ แล้วหน่วงให้เห็นก่อนเดิน
    set({ phase: 'moving' });
    sfx.reveal();
    await wait(350);
    const idx = get().currentPlayerIndex;
    await runMovement(set, get, idx, value);
  },

  // ผู้เล่นเลือกเส้นทางที่ทางแยก → ก้าวเข้าเส้นที่เลือก แล้วเดินแต้มที่เหลือต่อ
  chooseBranch: async (dest) => {
    const { pendingFork, currentPlayerIndex } = get();
    if (!pendingFork || !pendingFork.options.includes(dest)) return;
    const idx = currentPlayerIndex;
    const remaining = pendingFork.remaining;
    set({ phase: 'moving', pendingFork: null });
    await stepTo(set, idx, dest);
    await runMovement(set, get, idx, remaining - 1);
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
    const value = get().lastRoll ?? 0;
    finishTurn(set, get, value);
  },

  nextTurn: () => {
    const value = get().lastRoll ?? 0;
    finishTurn(set, get, value);
  },

  backToHome: () => {
    stopBackgroundMusic();
    set({ players: [], phase: 'setup', currentPlayerIndex: 0, round: 1, lastRoll: null, pendingEvent: null });
  },
}));

// ── เดินหมากตามกราฟ (รองรับทางแยก) ──

// ก้าวไป 1 ช่อง (พร้อมเสียง + โบนัสผ่าน START)
async function stepTo(set: any, idx: number, dest: number) {
  await wait(180);
  sfx.step();
  const passReward = dest === 0 ? TILES[0].passReward ?? 0 : 0;
  set((s: GameState) => ({
    players: s.players.map((p, i) =>
      i === idx ? { ...p, position: dest, coins: p.coins + passReward } : p
    ),
  }));
}

// เดิน `steps` ก้าวจากตำแหน่งปัจจุบัน — ถ้าเจอทางแยกจะหยุดรอผู้เล่นเลือก (phase 'forking')
async function runMovement(set: any, get: any, idx: number, steps: number) {
  let remaining = steps;
  while (remaining > 0) {
    const cur = get().players[idx].position as number;
    const nexts = TILES[cur].next ?? [(cur + 1) % LOOP];
    if (nexts.length > 1) {
      // ทางแยก: หยุด รอ action chooseBranch มาเดินต่อ
      set({ phase: 'forking', pendingFork: { from: cur, options: nexts, remaining } });
      return;
    }
    await stepTo(set, idx, nexts[0]);
    remaining--;
  }
  await resolveLanding(set, get, idx);
}

// หยุดที่ช่องปลายทาง → เปิดการ์ด/ให้เหรียญ ตามชนิดช่อง
async function resolveLanding(set: any, get: any, idx: number) {
  const value = get().lastRoll ?? 0;
  const player = get().players[idx];
  const tile = TILES[player.position] as Tile;

  // ช่องทอง: หาพระองค์ถัดไปที่ยังไม่มีเหรียญ แล้วเปิดควิซชิงเหรียญกษัตริย์
  if (tile.type === 'goldking') {
    const nextKing = KING_IDS.find((id) => !player.kingCoins.includes(id)) ?? null;
    if (!nextKing) {
      set({ phase: 'resolving' });
      await wait(300);
      finishTurn(set, get, value);
      return;
    }
    set({
      phase: 'resolving',
      pendingEvent: { tile: { ...tile, kingId: nextKing }, kind: 'goldking' },
    });
    return;
  }

  const event = makeTileEvent(tile);
  set({ phase: 'resolving', pendingEvent: event });
  if (!event) {
    await wait(500);
    finishTurn(set, get, value);
  }
}

// จบเทิร์น: ถ้าทอยได้ 6 เล่นต่อ ไม่งั้นส่งเทิร์น
function finishTurn(set: any, get: any, rolled: number) {
  const { currentPlayerIndex, players, round } = get();
  set({ pendingEvent: null });

  // เงื่อนไขจบเกมทันที: มีผู้เล่นเก็บเหรียญกษัตริย์ครบ 7 พระองค์
  if (players.some((p: Player) => p.kingCoins.length >= KING_IDS.length)) {
    sfx.win();
    set({ phase: 'gameover', lastRoll: null });
    return;
  }

  if (isBonusRoll(rolled) && players[currentPlayerIndex].skipNext <= 0) {
    set({ phase: 'idle' }); // ผู้เล่นเดิมทอยอีกครั้ง
    return;
  }

  // หาผู้เล่นคนถัดไปที่ไม่ได้ "หยุดพัก" — คนที่ติดโทษพักจะถูกข้าม (ลด skipNext ลง 1)
  let nextIndex = currentPlayerIndex;
  let nextRound = round;
  const rested: number[] = [];
  for (let hop = 0; hop < players.length; hop++) {
    nextIndex = (nextIndex + 1) % players.length;
    if (nextIndex === 0) nextRound += 1;
    if (players[nextIndex].skipNext > 0) {
      rested.push(nextIndex); // คนนี้หยุดพัก ข้ามไป
      continue;
    }
    break; // เจอผู้เล่นที่พร้อมเล่น
  }

  // เกมจบเฉพาะเมื่อมีผู้เล่นเก็บเหรียญกษัตริย์ครบ 7 พระองค์ (เช็กด้านบน) — ไม่มีลิมิตรอบแล้ว

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
