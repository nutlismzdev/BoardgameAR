// ── client ของห้องแข่งออนไลน์ (`server/room.php`) ──
// standalone แบบเดียวกับ challengeApi.ts — **ห้าม import store/UI** จะได้ใช้ซ้ำได้ทุก entry
// กติกาเกมยังอยู่ที่ store.ts ในเครื่อง ที่นี่แค่ส่งแต้มออกไปและรับอันดับกลับมา (ดู ROOM-PLAN.md)

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');
const TOKEN_KEY = 'bg7_admin_token'; // ใช้ token เดียวกับหลังบ้าน (สร้าง/เริ่ม/จบห้อง = สิทธิ์ครู)

export function roomApiAvailable(): boolean {
  return !!API_BASE;
}

export interface RoomRules {
  durationSec: number;
  targetCoins: number;
  playersPerTeam: number;
  difficulty: 'all' | 'easy' | 'medium' | 'hard';
  contentVersion: number;
}

export interface RoomTeam {
  name: string;
  kingCoins: number;
  coins: number;
  finishedAt: number | null;
  suspect: boolean;
  online: boolean;
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
  unauthorized: 'ต้องเข้าสู่ระบบครูก่อน',
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!API_BASE) throw new RoomError('ยังไม่ได้ตั้งค่า VITE_API_BASE', 'no api', 0);
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}/room.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
  if (!res.ok || !json?.ok) {
    const code = json?.error ?? `http ${res.status}`;
    throw new RoomError(MESSAGES[code] ?? `ห้องแข่งมีปัญหา (${code})`, code, res.status);
  }
  return json;
}

export async function createRoom(hostName: string, rules: Partial<RoomRules>): Promise<{ code: string }> {
  return call<{ code: string }>({ action: 'create', hostName, rules });
}

export async function joinRoom(
  code: string,
  teamName: string,
  contentVersion: number
): Promise<RoomState & { teamToken: string }> {
  return call<RoomState & { teamToken: string }>({ action: 'join', code, teamName, contentVersion });
}

export async function startRoom(code: string): Promise<RoomState> {
  return call<RoomState>({ action: 'start', code });
}

export async function endRoom(code: string): Promise<RoomState> {
  return call<RoomState>({ action: 'end', code });
}

export async function leaveRoom(code: string, teamToken: string): Promise<void> {
  await call({ action: 'leave', code, teamToken });
}

/** รายงานแต้มของทีมเรา แล้วรับสถานะห้องทั้งหมดกลับมาใน round trip เดียว */
export async function syncRoom(
  code: string,
  teamToken: string,
  kingCoins: number,
  coins: number
): Promise<RoomState> {
  return call<RoomState>({ action: 'sync', code, teamToken, kingCoins, coins });
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
