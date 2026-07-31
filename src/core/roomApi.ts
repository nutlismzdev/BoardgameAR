// ── client ของห้องแข่งออนไลน์ (`server/room.php`) ──
// standalone แบบเดียวกับ challengeApi.ts — **ห้าม import store/UI** จะได้ใช้ซ้ำได้ทุก entry
// กติกาเกมยังอยู่ที่ store.ts ในเครื่อง ที่นี่แค่ส่งแต้มออกไปและรับอันดับกลับมา (ดู ROOM-PLAN.md)

// ── ห้องแข่งไม่ต้อง login ── ใครสร้างก็ได้ แต่คนที่คุมห้อง (เริ่ม/จบ) คือคนที่สร้างเท่านั้น
// พิสูจน์ตัวด้วย teamToken ของเจ้าของห้องที่ได้ตอน create ไม่ใช่รหัสครูของ CMS
// (เดิมใช้รหัส CMS ซึ่งเปิดสิทธิ์ลบการ์ดได้ทั้งระบบ — ผิดขนาดของงานและเสี่ยงกว่าไม่มี login)
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

export function roomApiAvailable(): boolean {
  return !!API_BASE;
}

export interface RoomRules {
  durationSec: number;
  targetCoins: number;
  playersPerTeam: number;
  difficulty: 'all' | 'easy' | 'medium' | 'hard';
  sabotage: boolean; // เปิดการ์ดป่วนข้ามทีมไหม (ครูเลือกตอนสร้างห้อง)
  contentVersion: number;
}

// ── การ์ดป่วนข้ามทีม ──
// ผลทั้งหมดเป็นแบบ "ครั้งหน้า" ไม่ใช่ "เดี๋ยวนี้" เพราะ sync วิ่งทุก 3 วิ ผลจึงมาช้าได้ถึง 3 วินาที
// ถ้าออกแบบให้มีผลทันทีจะรู้สึกสุ่มสี่สุ่มห้า (เช่นเวลาหายกลางคันขณะกำลังตอบ)
export type EffectKind = 'storm' | 'block' | 'tax' | 'hardQuiz';

export interface RoomEffect {
  from: string; // ชื่อทีมที่ส่งมา — ต้องบอกเสมอ ความสนุกอยู่ที่ "รู้ว่าใครทำ แล้วอยากเอาคืน"
  kind: EffectKind;
}

export interface EffectMeta {
  icon: string;
  label: string;
  detail: string;
  price: number;
}

// ราคา = เหรียญของตัวเอง · จงใจให้ "จ่ายแพงกว่าที่คู่แข่งเสีย" — การป่วนคือการยอมสละ
// ความก้าวหน้าของตัวเองเพื่อถ่วงคนที่นำอยู่ ไม่ใช่ทางลัดที่กดรัวแล้วได้เปรียบฟรี
export const EFFECTS: Record<EffectKind, EffectMeta> = {
  storm: { icon: '🌪️', label: 'พายุ', detail: 'คำถามข้อถัดไปของเป้าหมาย เวลาลด 8 วินาที', price: 60 },
  hardQuiz: { icon: '📜', label: 'ข้อสอบยาก', detail: 'การ์ดใบถัดไปของเป้าหมายเป็นระดับยาก', price: 70 },
  tax: { icon: '💸', label: 'ริบเหรียญ', detail: 'เป้าหมายเสียเหรียญ 60', price: 70 },
  block: { icon: '🐘', label: 'ช้างขวางทาง', detail: 'ทอยครั้งถัดไปของเป้าหมายเดินได้ไม่เกิน 2 ช่อง', price: 90 },
};

export const TAX_COINS = 60; // เหรียญที่เป้าหมายเสียจากการ์ด "ริบเหรียญ"
export const STORM_SECONDS = 8; // วินาทีที่หายไปจากการ์ด "พายุ"
export const BLOCK_STEPS = 2; // เดินได้ไม่เกินกี่ช่องจากการ์ด "ช้างขวางทาง"

export interface RoomTeam {
  name: string;
  kingCoins: number;
  coins: number;
  finishedAt: number | null;
  suspect: boolean;
  online: boolean;
  lineup: string[]; // ขุนศึกที่ทีมเลือก (king id) — ทุกทีมเห็นของกันและกันในจอท้าชิง
}

export interface RoomInfo {
  code: string;
  hostName: string;
  status: 'lobby' | 'running' | 'ended';
  rules: RoomRules;
  startedAt: number | null;
  endsAt: number | null;
  serverTime: number; // นาฬิกาของเซิร์ฟเวอร์ — ใช้เป็นฐานเดียวของทุกเครื่อง
}

export interface RoomState {
  room: RoomInfo;
  teams: RoomTeam[];
}

/** ห้องเต็ม / เริ่มไปแล้ว / ชื่อทีมซ้ำ / คลังการ์ดคนละเวอร์ชัน — ต้องบอกผู้ใช้คนละข้อความกับ error ทั่วไป */
export class RoomError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

const MESSAGES: Record<string, string> = {
  'room not found': 'ไม่พบห้องนี้ — ตรวจรหัสอีกครั้ง',
  'room already started': 'ห้องนี้เริ่มแข่งไปแล้ว เข้าร่วมไม่ได้',
  'room is full': 'ห้องนี้เต็มแล้ว',
  'team name already used in this room': 'ชื่อทีมนี้ถูกใช้ไปแล้วในห้อง',
  'content version mismatch': 'คลังคำถามไม่ตรงกับห้อง — กดซิงก์เนื้อหาแล้วลองใหม่',
  'team not found': 'ทีมนี้ไม่อยู่ในห้องแล้ว',
  'only the room host can do this': 'เฉพาะเครื่องที่สร้างห้องเท่านั้นที่กดได้',
  'too many rooms': 'มีการสร้างห้องเยอะเกินไปในตอนนี้ ลองใหม่อีกสักครู่',
};

/** ข้อความอธิบายเมื่อส่งการ์ดป่วนไม่สำเร็จ (server เป็นคนตัดสิน ไม่เชื่อ client) */
export function sendErrorMessage(result: SendResult): string {
  switch (result.error) {
    case 'cooldown':
      return `ยังส่งไม่ได้ รออีก ${result.waitSec ?? 0} วินาที`;
    case 'target must rank above you':
      return 'ป่วนได้เฉพาะทีมที่อันดับนำหน้าเราเท่านั้น';
    case 'target inbox full':
      return 'ทีมนั้นมีการ์ดป่วนค้างอยู่แล้ว 2 ใบ';
    case 'sabotage disabled':
      return 'ห้องนี้ปิดการ์ดป่วนไว้';
    default:
      return 'ส่งการ์ดป่วนไม่สำเร็จ';
  }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!API_BASE) throw new RoomError('ยังไม่ได้ตั้งค่า VITE_API_BASE', 'no api', 0);
  const res = await fetch(`${API_BASE}/room.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
  if (!res.ok || !json?.ok) {
    const code = json?.error ?? `http ${res.status}`;
    throw new RoomError(MESSAGES[code] ?? `ห้องแข่งมีปัญหา (${code})`, code, res.status);
  }
  return json;
}

/** สร้างห้อง — คืน teamToken ของเจ้าของห้องมาเลย (ไม่ต้อง join ตามอีกรอบ) */
export async function createRoom(
  hostName: string,
  rules: Partial<RoomRules>
): Promise<RoomState & { code: string; teamToken: string }> {
  return call<RoomState & { code: string; teamToken: string }>({ action: 'create', hostName, rules });
}

export async function joinRoom(
  code: string,
  teamName: string,
  contentVersion: number,
  lineup: string[] = []
): Promise<RoomState & { teamToken: string }> {
  return call<RoomState & { teamToken: string }>({ action: 'join', code, teamName, contentVersion, lineup });
}

/** ตั้งขุนศึกของทีมระหว่างอยู่ล็อบบี้ — heartbeat ยังไม่ทำงานตอน phase 'setup' จึงต้องมี action แยก */
export async function setLineup(code: string, teamToken: string, lineup: string[]): Promise<RoomState> {
  return call<RoomState>({ action: 'lineup', code, teamToken, lineup });
}

export async function startRoom(code: string, teamToken: string): Promise<RoomState> {
  return call<RoomState>({ action: 'start', code, teamToken });
}

export async function endRoom(code: string, teamToken: string): Promise<RoomState> {
  return call<RoomState>({ action: 'end', code, teamToken });
}

export async function leaveRoom(code: string, teamToken: string): Promise<void> {
  await call({ action: 'leave', code, teamToken });
}

/** ผลของการส่งการ์ดป่วน — ล้มเหลวไม่ทำให้ sync พัง (sync คือชีพจรของเกม) จึงคืนมาเป็นฟิลด์ */
export interface SendResult {
  ok: boolean;
  error?: string;
  waitSec?: number;
  kind?: EffectKind;
  to?: string;
}

export interface SyncResult extends RoomState {
  incoming: RoomEffect[]; // การ์ดป่วนที่ส่งมาถึงเรา (server ปิดเป็น delivered แล้ว = ได้ครั้งเดียว)
  sent: SendResult | null;
}

/**
 * รายงานแต้มของทีมเรา แล้วรับสถานะห้องทั้งหมดกลับมาใน round trip เดียว
 * `send` = การ์ดป่วนที่รอส่ง — ฝากไปกับ sync ที่วิ่งอยู่แล้ว ไม่มี endpoint แยก
 */
export async function syncRoom(
  code: string,
  teamToken: string,
  kingCoins: number,
  coins: number,
  send?: { to: string; kind: EffectKind } | null
): Promise<SyncResult> {
  return call<SyncResult>({ action: 'sync', code, teamToken, kingCoins, coins, send: send ?? undefined });
}

/** อ่านสถานะห้องแบบไม่ต้องมี token (ล็อบบี้ก่อนเข้าร่วม / จอฉาย) */
export async function fetchRoom(code: string): Promise<RoomState> {
  if (!API_BASE) throw new RoomError('ยังไม่ได้ตั้งค่า VITE_API_BASE', 'no api', 0);
  const res = await fetch(`${API_BASE}/room.php?code=${encodeURIComponent(code)}`);
  const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & RoomState) | null;
  if (!res.ok || !json?.ok) {
    const code2 = json?.error ?? `http ${res.status}`;
    throw new RoomError(MESSAGES[code2] ?? `ห้องแข่งมีปัญหา (${code2})`, code2, res.status);
  }
  return json;
}

/** วินาทีที่เหลือ คิดจากนาฬิกา server ล้วน (นาฬิกาแท็บเล็ตแต่ละทีมไม่ตรงกัน) */
export function secondsLeft(room: RoomInfo | null): number {
  if (!room?.endsAt) return 0;
  return Math.max(0, room.endsAt - room.serverTime);
}
