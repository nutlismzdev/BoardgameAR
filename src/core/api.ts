import type { KnowledgeCard, QuizCard, SubjectQuizCard } from './types';

export type ContentType = 'quiz' | 'knowledge' | 'gold' | 'subject';
export type ContentByType<T extends ContentType> = T extends 'knowledge'
  ? KnowledgeCard
  : T extends 'subject'
  ? SubjectQuizCard
  : QuizCard;

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');
const TOKEN_KEY = 'bg7_admin_token';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  version?: number;
  token?: string;
  expiresAt?: number;
  error?: string;
}

function token(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function requireBaseUrl(): string {
  if (!API_BASE) {
    throw new Error('ยังไม่ได้ตั้งค่า VITE_API_BASE');
  }
  return API_BASE;
}

export function resolveApiAssetUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url;
  // ถ้ายังไม่ตั้ง VITE_API_BASE แต่มี asset แบบ relative (เช่นจาก cache CMS เก่า)
  // คืน '' แทนการโยน error กลาง render → กันจอขาว (เล่นต่อบน placeholder ได้)
  try {
    return `${requireBaseUrl()}/${url.replace(/^\/+/, '')}`;
  } catch {
    return '';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const res = await fetch(`${requireBaseUrl()}/${path.replace(/^\/+/, '')}`, {
    ...options,
    headers,
  });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) {
    throw new Error('API response ไม่ใช่ JSON');
  }
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `API error ${res.status}`);
  }
  return json;
}

function authHeaders(): HeadersInit {
  const current = token();
  if (!current) {
    throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  }
  return { Authorization: `Bearer ${current}` };
}

export async function login(password: string): Promise<void> {
  const res = await request<never>('auth.php', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (!res.token) {
    throw new Error('API ไม่ได้คืน token');
  }
  localStorage.setItem(TOKEN_KEY, res.token);
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return Boolean(token());
}

export async function fetchContent<T extends ContentType>(type: T): Promise<{
  data: ContentByType<T>[];
  version: number;
}> {
  const res = await request<ContentByType<T>[]>(`content.php?type=${type}`);
  return { data: res.data ?? [], version: res.version ?? 1 };
}

export async function createCard<T extends ContentType>(
  type: T,
  payload: ContentByType<T>
): Promise<ContentByType<T>[]> {
  const res = await request<ContentByType<T>[]>(`content.php?type=${type}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.data ?? [];
}

export async function uploadGoldVideo(file: File): Promise<string> {
  const form = new FormData();
  form.set('video', file);
  const res = await fetch(`${requireBaseUrl()}/upload.php`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  const json = (await res.json().catch(() => null)) as ApiResponse<{ url: string }> | null;
  if (!json || !res.ok || !json.ok || !json.data?.url) {
    throw new Error(json?.error || 'อัปโหลดวิดีโอไม่สำเร็จ');
  }
  return json.data.url;
}

export async function updateCard<T extends ContentType>(
  type: T,
  payload: ContentByType<T>
): Promise<ContentByType<T>[]> {
  const res = await request<ContentByType<T>[]>(`content.php?type=${type}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.data ?? [];
}

export async function deleteCard<T extends ContentType>(type: T, id: string): Promise<ContentByType<T>[]> {
  const res = await request<ContentByType<T>[]>(
    `content.php?type=${type}&id=${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    }
  );
  return res.data ?? [];
}
