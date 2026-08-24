// client ของ server/test.php — ส่งผลแบบทดสอบขึ้นส่วนกลาง + ให้ครูดึงผลทั้งห้อง
// standalone แบบเดียวกับ challengeApi.ts/roomApi.ts (ห้าม import store — จะพัง tree-shaking ของ entry มือถือ)

import type { KingScore, TestMode } from './pretest';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');
const TOKEN_KEY = 'bg7_admin_token';

export function testApiAvailable(): boolean {
  return !!API_BASE;
}

/** ผล 1 ครั้งของนักเรียน 1 คน (ทรงเดียวกันทั้งฝั่งเก็บในเครื่องและฝั่งส่งขึ้น server) */
export interface TestSubmission {
  mode: TestMode;
  studentKey: string;
  studentNo: string;
  studentRoom: string;
  /** ส่งขึ้น server เฉพาะเมื่อครูเปิดสวิตช์ — ไม่งั้นชื่อจริงอยู่แค่ในเครื่อง (PDPA) */
  studentName?: string;
  /** ครูเปิดโหมดทำซ้ำไว้ — ไม่ใส่ = server ปฏิเสธถ้ามีผลรอบนี้อยู่แล้ว */
  retake?: boolean;
  score: number;
  total: number;
  durationSec: number;
  answers: number[];
  byKing: KingScore[];
  submittedAt: number;
}

/** 1 แถวในตารางของครู */
export interface TestResultRow extends TestSubmission {
  attempts: number;
  updatedAt: number;
}

/**
 * ข้อความบนจอต้องเป็นภาษาที่ครู/นักเรียนอ่านรู้เรื่อง
 * รหัสจาก server (`invalid answers` ฯลฯ) เป็นสัญญาของ API ไว้ดีบัก ไม่ใช่ข้อความบอกผู้ใช้
 * → ส่งต่อเฉพาะข้อความที่เป็นภาษาไทยแล้วเท่านั้น นอกนั้นแทนด้วยประโยคกลาง
 */
function readableError(raw: string | undefined, fallback: string): string {
  return raw && /[฀-๿]/.test(raw) ? raw : fallback;
}

export async function submitResult(result: TestSubmission): Promise<void> {
  if (!API_BASE) throw new Error('ยังไม่ได้เชื่อมต่อกับระบบของโรงเรียน');
  const res = await fetch(`${API_BASE}/test.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  });
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: string; code?: string }
    | null;
  if (json?.code === 'already_submitted') {
    throw new TestDuplicateError(readableError(json.error, 'ทำแบบทดสอบรอบนี้ไปแล้ว'));
  }
  if (!res.ok || !json?.ok) {
    throw new Error(
      readableError(json?.error, 'ไม่สามารถส่งผลการทำแบบทดสอบได้ กรุณาลองใหม่อีกครั้ง')
    );
  }
}

/** ส่งซ้ำทั้งที่มีผลรอบนี้อยู่แล้ว — เป็นสถานะถาวร ส่งใหม่กี่ครั้งก็ได้ผลเดิม ห้าม retry */
export class TestDuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestDuplicateError';
  }
}

/** ต้องเข้าสู่ระบบครูก่อน — แยกชนิดไว้เพื่อให้จอครูเปิดช่องใส่รหัสให้ตรงจุด ไม่ใช่แค่ขึ้นข้อความ */
export class TestAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestAuthError';
  }
}

/** อ่านผลทั้งห้อง — เฉพาะครู (server บังคับ token ซ้ำอีกชั้น ห้ามเชื่อฝั่งนี้) */
export async function fetchResults(): Promise<TestResultRow[]> {
  if (!API_BASE) throw new Error('ยังไม่ได้เชื่อมต่อกับระบบของโรงเรียน');
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new TestAuthError('กรุณาเข้าสู่ระบบสำหรับคุณครูก่อน');
  const res = await fetch(`${API_BASE}/test.php`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: TestResultRow[]; error?: string }
    | null;
  if (res.status === 401) throw new TestAuthError('รหัสผ่านสำหรับคุณครูหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
  if (!res.ok || !json?.ok || !json.data) {
    throw new Error(readableError(json?.error, 'ไม่สามารถเรียกดูผลจากระบบของโรงเรียนได้'));
  }
  return json.data;
}
