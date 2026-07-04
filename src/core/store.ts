// State กลางของเกม (Zustand) — กติกาทั้งหมดอยู่ที่นี่
// ไฟล์ Layout (portrait/landscape) เพียงอ่าน state และเรียก action เท่านั้น ห้ามฝัง logic

import { create } from 'zustand';
import boardData from '@/data/board-layout.json';
import kingsData from '@/data/kings.json';
import type { Player, Tile, TileEvent, Difficulty, LessonStep, LessonProgress, DailyQuest, ArPoster } from './types';
import { rollDie, isBonusRoll } from './diceLogic';
import { sfx, setSoundEnabled } from './sfx';

const TILES = boardData.tiles as Tile[];
const LOOP = boardData.loopSize as number;
const KING_IDS = (kingsData.kings as { id: string }[]).map((k) => k.id);
const MASTERY_STEPS: LessonStep[] = ['knowledge', 'quiz', 'mission'];
const QUESTS: DailyQuest[] = [
  {
    id: 'quest_star_9',
    kind: 'stars',
    title: 'ล่าดาวนักประวัติศาสตร์',
    description: 'เก็บดาวความรู้ให้ครบ 9 ดาว',
    target: 9,
  },
  {
    id: 'quest_unlock_3',
    kind: 'unlocks',
    title: 'เปิดห้องจัดแสดง',
    description: 'ปลดล็อกมหาราชให้ครบ 3 พระองค์',
    target: 3,
  },
  {
    id: 'quest_coin_500',
    kind: 'coins',
    title: 'คลังเหรียญราชภักดิ์',
    description: 'สะสมเหรียญให้ครบ 500 เหรียญ',
    target: 500,
  },
];

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
}
let fxCounter = 0;

// ── ไอเทมพาวเวอร์อัพ ──
export type ItemType = 'fiftyFifty' | 'skip' | 'double';
export const ITEM_META: Record<ItemType, { icon: string; label: string }> = {
  fiftyFifty: { icon: '✂️', label: '50:50' },
  skip: { icon: '⏭️', label: 'ข้ามคำถาม' },
  double: { icon: '✨', label: '×2 เหรียญ' },
};
export type ItemBag = Record<ItemType, number>;

// ตัวคูณคอมโบ (ตอบถูกติดกัน) — คืนค่าตามจำนวน streak หลังบวก
function comboMult(streak: number): number {
  return streak <= 1 ? 1 : streak === 2 ? 1.5 : streak === 3 ? 2 : 3;
}

// ── Teacher Mode (การตั้งค่าโดยครู) ──
export interface Settings {
  maxRounds: number; // จำนวนรอบก่อนจบเกม
  timerEnabled: boolean; // เปิดตัวจับเวลาคำถาม
  difficulty: Difficulty | 'all'; // คัดคำถามตามระดับความยาก
  soundEnabled: boolean; // เสียง + haptic
  arEnabled: boolean; // เปิดปุ่ม AR
  calibrate: boolean; // โหมดปรับตำแหน่งช่องบนภาพกระดาน (สำหรับผู้ดูแล)
  showTileIcons: boolean; // แสดงไอคอนบอกว่าช่องนั้นเป็นเกมอะไร
}

const DEFAULT_SETTINGS: Settings = {
  maxRounds: 25,
  timerEnabled: true,
  difficulty: 'all',
  soundEnabled: true,
  arEnabled: true,
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
  dailyQuest: DailyQuest;
  bossCleared: boolean;

  // actions
  setupGame: (count: number, kingTokenIds?: string[]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  roll: () => Promise<void>;
  chooseBranch: (dest: number) => Promise<void>;
  resolveReward: (coins: number, unlockKingId?: string | null) => void;
  answerQuiz: (correct: boolean, baseReward: number, kingId: string | null) => void;
  answerKingCoin: (correct: boolean, kingId: string) => void;
  completeLessonStep: (kingId: string | null, step: LessonStep, coins: number) => void;
  collectKnowledge: (cardId: string, kingId: string | null, coins: number) => void;
  completeBossReview: (success: boolean) => void;
  markQuizSeen: (id: string) => void;
  collectArSticker: (kingId: string, sticker: string) => void;
  saveArPoster: (poster: Omit<ArPoster, 'id' | 'createdAt'>) => void;
  giveItem: (type: ItemType) => void;
  useItem: (type: ItemType) => boolean;
  applyChance: (move: number, coin: number) => void;
  closeEvent: () => void;
  nextTurn: () => void;
  backToHome: () => void;
}

const TOKENS = ['🐘', '⛵', '🛕', '🐉'];
const NAMES = ['ผู้เล่น 1', 'ผู้เล่น 2', 'ผู้เล่น 3', 'ผู้เล่น 4'];

function makeTileEvent(tile: Tile): TileEvent | null {
  // ช่อง start / blank (ช่องว่างพัก) ไม่มี modal — จบเทิร์นเลย
  if (tile.type === 'start' || tile.type === 'blank') return null;
  return { tile, kind: tile.type };
}

function makeLessonProgress(): Record<string, LessonProgress> {
  return Object.fromEntries(
    KING_IDS.map((id) => [id, { knowledge: false, quiz: false, mission: false }])
  ) as Record<string, LessonProgress>;
}

function progressScore(progress?: LessonProgress): number {
  if (!progress) return 0;
  return MASTERY_STEPS.filter((step) => progress[step]).length;
}

function markLessonStep(player: Player, kingId: string | null, step: LessonStep) {
  if (!kingId) return { player, unlockedNow: false };

  const current = player.lessonProgress?.[kingId] ?? {
    knowledge: false,
    quiz: false,
    mission: false,
  };
  const nextProgress = { ...current, [step]: true };
  const completed = progressScore(nextProgress) >= MASTERY_STEPS.length;
  const unlockedNow = completed && !player.unlockedKings.includes(kingId);

  return {
    player: {
      ...player,
      lessonProgress: {
        ...(player.lessonProgress ?? {}),
        [kingId]: nextProgress,
      },
      unlockedKings: unlockedNow ? [...player.unlockedKings, kingId] : player.unlockedKings,
    },
    unlockedNow,
  };
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
  items: { fiftyFifty: 0, skip: 0, double: 0 },
  doubleNext: false,
  usedQuizIds: [],
  dailyQuest: QUESTS[0],
  bossCleared: false,

  setupGame: (count, kingTokenIds = KING_IDS) => {
    const quest = QUESTS[Math.floor(Math.random() * QUESTS.length)];
    const players: Player[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      name: NAMES[i],
      token: TOKENS[i],
      kingTokenId: kingTokenIds[i] ?? KING_IDS[i % KING_IDS.length],
      position: 0,
      coins: 0,
      kingCoins: [],
      knowledgeCards: [],
      unlockedKings: [],
      lessonProgress: makeLessonProgress(),
      arStickers: {},
      arPosters: [],
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
      items: { fiftyFifty: 0, skip: 0, double: 0 },
      doubleNext: false,
      usedQuizIds: [],
      dailyQuest: quest,
      bossCleared: false,
    });
  },

  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    if (patch.soundEnabled !== undefined) setSoundEnabled(patch.soundEnabled);
    set({ settings: next });
  },

  roll: async () => {
    const { phase } = get();
    if (phase !== 'idle') return;

    const value = rollDie();
    set({ phase: 'rolling', lastRoll: value });
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

  resolveReward: (coins, unlockKingId) => {
    const idx = get().currentPlayerIndex;
    const kind: FxKind = unlockKingId ? 'unlock' : coins > 0 ? 'correct' : 'wrong';
    if (kind === 'unlock') sfx.unlock();
    else if (kind === 'correct') sfx.correct();
    else sfx.wrong();
    // ×2 เหรียญ ถ้าติดสถานะไว้
    let gain = coins;
    let usedDouble = false;
    if (gain > 0 && get().doubleNext) {
      gain *= 2;
      usedDouble = true;
    }
    set((s) => ({
      players: s.players.map((p, i) => {
        if (i !== idx) return p;
        const unlocked =
          unlockKingId && !p.unlockedKings.includes(unlockKingId)
            ? [...p.unlockedKings, unlockKingId]
            : p.unlockedKings;
        return { ...p, coins: p.coins + gain, unlockedKings: unlocked };
      }),
      doubleNext: usedDouble ? false : s.doubleNext,
      fx: { id: ++fxCounter, kind, coins: gain },
    }));
  },

  // ตอบคำถาม — จัดการคอมโบ + ×2 + บันทึก mastery step
  answerQuiz: (correct, baseReward, kingId) => {
    const idx = get().currentPlayerIndex;
    const { streak, doubleNext } = get();

    if (!correct) {
      sfx.wrong();
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
    let didUnlock = false;
    set((s) => ({
      players: s.players.map((p, i) => {
        if (i !== idx) return p;
        const { player, unlockedNow } = markLessonStep(p, kingId, 'quiz');
        if (unlockedNow) didUnlock = true;
        return { ...player, coins: player.coins + coins };
      }),
      streak: newStreak,
      doubleNext: usedDouble ? false : s.doubleNext,
      fx: { id: ++fxCounter, kind: didUnlock ? 'unlock' : 'correct', coins },
    }));
    if (didUnlock) sfx.unlock();
  },

  // ตอบคำถามที่ช่องทอง — ถูก = ได้ "เหรียญกษัตริย์" ของพระองค์นั้น (เงื่อนไขชนะ)
  answerKingCoin: (correct, kingId) => {
    const idx = get().currentPlayerIndex;
    if (!correct) {
      sfx.wrong();
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
      fx: { id: ++fxCounter, kind: 'unlock', coins: reward },
    }));
  },

  completeLessonStep: (kingId, step, coins) => {
    const idx = get().currentPlayerIndex;
    let didUnlock = false;
    let gain = coins;
    let usedDouble = false;
    if (gain > 0 && get().doubleNext) {
      gain *= 2;
      usedDouble = true;
    }

    set((s) => ({
      players: s.players.map((p, i) => {
        if (i !== idx) return p;
        const { player, unlockedNow } = markLessonStep(p, kingId, step);
        if (unlockedNow) didUnlock = true;
        return { ...player, coins: player.coins + gain };
      }),
      doubleNext: usedDouble ? false : s.doubleNext,
      fx: { id: ++fxCounter, kind: didUnlock ? 'unlock' : gain > 0 ? 'correct' : 'wrong', coins: gain },
    }));
    if (didUnlock) sfx.unlock();
    else if (gain > 0) sfx.correct();
  },

  // เก็บการ์ดความรู้ (ช่องชมพู) — สะสมได้สูงสุด 10 ใบ/คน, ให้เหรียญเฉพาะใบใหม่
  collectKnowledge: (cardId, kingId, coins) => {
    const idx = get().currentPlayerIndex;
    let didUnlock = false;
    let added = false;
    set((s) => ({
      players: s.players.map((p, i) => {
        if (i !== idx) return p;
        const already = p.knowledgeCards.includes(cardId);
        const canAdd = !already && p.knowledgeCards.length < 10;
        if (canAdd) added = true;
        const knowledgeCards = canAdd ? [...p.knowledgeCards, cardId] : p.knowledgeCards;
        const base = { ...p, knowledgeCards, coins: p.coins + (canAdd ? coins : 0) };
        // มาร์ก lessonProgress ของพระองค์นั้นด้วย (ใช้กับพิพิธภัณฑ์)
        const { player, unlockedNow } = markLessonStep(base, kingId, 'knowledge');
        if (unlockedNow) didUnlock = true;
        return player;
      }),
      fx: { id: ++fxCounter, kind: didUnlock ? 'unlock' : 'correct', coins: added ? coins : 0 },
    }));
    if (didUnlock) sfx.unlock();
    else sfx.correct();
  },

  markQuizSeen: (id) => {
    set((s) => (s.usedQuizIds.includes(id) ? s : { usedQuizIds: [...s.usedQuizIds, id] }));
  },

  collectArSticker: (kingId, sticker) => {
    const idx = get().currentPlayerIndex;
    set((s) => ({
      players: s.players.map((p, i) => {
        if (i !== idx) return p;
        const current = p.arStickers[kingId] ?? [];
        if (current.includes(sticker)) return p;
        return {
          ...p,
          arStickers: {
            ...p.arStickers,
            [kingId]: [...current, sticker],
          },
        };
      }),
    }));
  },

  saveArPoster: (poster) => {
    const idx = get().currentPlayerIndex;
    const saved: ArPoster = {
      ...poster,
      id: `poster_${poster.kingId}_${Date.now()}`,
      createdAt: Date.now(),
    };
    set((s) => ({
      players: s.players.map((p, i) =>
        i === idx ? { ...p, arPosters: [saved, ...p.arPosters].slice(0, 12) } : p
      ),
      fx: { id: ++fxCounter, kind: 'coin', coins: 0 },
    }));
    sfx.coin();
  },

  completeBossReview: (success) => {
    if (!success) {
      sfx.wrong();
      set({ fx: { id: ++fxCounter, kind: 'wrong', coins: 0 } });
      return;
    }
    const idx = get().currentPlayerIndex;
    const reward = 180;
    sfx.win();
    set((s) => ({
      players: s.players.map((p, i) => (i === idx ? { ...p, coins: p.coins + reward } : p)),
      bossCleared: true,
      fx: { id: ++fxCounter, kind: 'correct', coins: reward },
    }));
  },

  giveItem: (type) => {
    set((s) => ({ items: { ...s.items, [type]: s.items[type] + 1 } }));
  },

  // ใช้ไอเทม — คืน true ถ้ามีของและใช้สำเร็จ ('double' ติดสถานะ ×2 รางวัลถัดไป)
  useItem: (type) => {
    if (get().items[type] <= 0) return false;
    set((s) => ({
      items: { ...s.items, [type]: s.items[type] - 1 },
      doubleNext: type === 'double' ? true : s.doubleNext,
    }));
    return true;
  },

  applyChance: (move, coin) => {
    const idx = get().currentPlayerIndex;
    set((s) => ({
      players: s.players.map((p, i) => {
        if (i !== idx) return p;
        const pos = ((p.position + move) % LOOP + LOOP) % LOOP;
        return { ...p, position: pos, coins: p.coins + coin };
      }),
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

  // ช่องรับเหรียญ: ได้ทันที ไม่ต้องเปิดการ์ด
  if (tile.type === 'coin') {
    sfx.coin();
    set((s: GameState) => ({
      players: s.players.map((p, i) => (i === idx ? { ...p, coins: p.coins + (tile.reward ?? 0) } : p)),
      fx: { id: ++fxCounter, kind: 'coin', coins: tile.reward ?? 0 },
      phase: 'resolving',
    }));
    await wait(500);
    finishTurn(set, get, value);
    return;
  }

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
  const { currentPlayerIndex, players, round, settings } = get();
  set({ pendingEvent: null });

  // เงื่อนไขจบเกมทันที: มีผู้เล่นเก็บเหรียญกษัตริย์ครบ 7 พระองค์
  if (players.some((p: Player) => p.kingCoins.length >= KING_IDS.length)) {
    sfx.win();
    set({ phase: 'gameover', lastRoll: null });
    return;
  }

  if (isBonusRoll(rolled)) {
    set({ phase: 'idle' }); // ผู้เล่นเดิมทอยอีกครั้ง
    return;
  }

  const nextIndex = (currentPlayerIndex + 1) % players.length;
  const nextRound = nextIndex === 0 ? round + 1 : round;

  // จบเกมเมื่อเล่นครบจำนวนรอบ (ตั้งได้ใน Teacher Mode)
  if (nextRound > settings.maxRounds) {
    sfx.win();
    set({ phase: 'gameover', lastRoll: null });
    return;
  }

  set({ currentPlayerIndex: nextIndex, round: nextRound, phase: 'idle', lastRoll: null });
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export { TILES, LOOP };
