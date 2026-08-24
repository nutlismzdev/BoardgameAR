// State ของ "แบบทดสอบก่อนเรียน/หลังเรียน" — แยกจาก store ของเกมโดยตั้งใจ
//
// ทำไมไม่ยัดรวมใน store.ts:
//  1. เซฟเกม (`bg7_save`) มีอายุ 15 นาทีแล้วโดนทิ้ง + resume เข้ากระดานเองทันที
//     ข้อสอบที่ทำค้างไว้ 20 ข้อจะหายไปเฉย ๆ และ resume ผิดจอ
//  2. เกมล้าง players ทุกครั้งที่ backToHome — ข้อสอบต้องรอดจากทุกอย่างนั้น
// กติกา/การให้คะแนนทั้งหมดอยู่ที่ `pretest.ts` ไฟล์นี้เก็บแค่ "สถานะกำลังทำถึงไหน"

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  buildAttempt,
  emptyAnswers,
  scoreAttempt,
  studentKey,
  TEST_TOTAL,
  UNANSWERED,
} from './pretest';
import type { TestItem, TestMode } from './pretest';
import { TestDuplicateError, submitResult, testApiAvailable } from './testApi';
import type { TestSubmission } from './testApi';

export type TestPhase = 'idle' | 'form' | 'running' | 'review' | 'result';

export interface StudentInfo {
  name: string;
  no: string;
  room: string;
}

export interface TestAttempt {
  mode: TestMode;
  student: StudentInfo;
  key: string;
  items: TestItem[]; // ชุดที่แจกให้คนนี้ (เก็บไว้เพื่อกลับมาทำต่อได้ "เรียงเหมือนเดิมเป๊ะ")
  answers: number[]; // answers[no-1] = index ตัวเลือกต้นฉบับ · UNANSWERED = ยังไม่ตอบ
  index: number; // ตำแหน่งข้อที่กำลังดูอยู่ (index ใน items ไม่ใช่เลขข้อ)
  startedAt: number;
  elapsedSec: number; // นับเฉพาะตอนเปิดจอทำข้อสอบจริง — ปิดแท็บทิ้งไว้ข้ามคืนเวลาต้องไม่เดิน
}

interface TestState {
  phase: TestPhase;
  mode: TestMode;
  student: StudentInfo; // ค่าล่าสุดที่กรอก — เติมให้อัตโนมัติรอบหน้า
  attempt: TestAttempt | null;
  results: TestSubmission[]; // ผลที่ทำเสร็จบนเครื่องนี้ (mode+key ซ้ำ = ทับของเดิม)
  queue: TestSubmission[]; // ส่งขึ้น server ไม่สำเร็จ รอส่งใหม่ (เน็ตหลุดห้ามทำให้เด็กทำข้อสอบไม่จบ)
  lastResult: TestSubmission | null;
  finishedGames: number; // เล่นเกมจบบนเครื่องนี้กี่รอบ — ใช้เตือน (ไม่บล็อก) ตอนกดแบบทดสอบหลังเรียน
  sending: boolean;

  openTest: (mode: TestMode) => void;
  closeTest: () => void;
  setStudent: (patch: Partial<StudentInfo>) => void;
  startAttempt: (mode: TestMode, student: StudentInfo, shuffleSet: boolean) => void;
  discardAttempt: () => void;
  resumeAttempt: () => void;
  answer: (no: number, originalIndex: number) => void;
  goto: (index: number) => void;
  step: (delta: number) => void;
  setElapsed: (sec: number) => void;
  review: () => void;
  backToQuestions: () => void;
  submit: (opts: { sendName: boolean; allowRetake: boolean }) => Promise<void>;
  flushQueue: () => Promise<void>;
  clearLocalResults: () => void;
  noteGameFinished: () => void;
  resultFor: (mode: TestMode, key: string) => TestSubmission | null;
}

const emptyStudent = (): StudentInfo => ({ name: '', no: '', room: '' });

/** เก็บผลแบบ "คนเดิม + โหมดเดิม = ทับของเดิม" (ทำซ้ำได้ แต่ไม่ทำให้ตารางครูมีชื่อซ้ำ) */
function upsert(list: TestSubmission[], row: TestSubmission): TestSubmission[] {
  const rest = list.filter((r) => !(r.mode === row.mode && r.studentKey === row.studentKey));
  return [...rest, row];
}

export const useTest = create<TestState>()(
  persist(
    (set, get) => ({
      phase: 'idle',
      mode: 'pre',
      student: emptyStudent(),
      attempt: null,
      results: [],
      queue: [],
      lastResult: null,
      finishedGames: 0,
      sending: false,

      openTest: (mode) => set({ phase: 'form', mode, lastResult: null }),
      closeTest: () => set({ phase: 'idle', lastResult: null }),

      setStudent: (patch) => set({ student: { ...get().student, ...patch } }),

      startAttempt: (mode, student, shuffleSet) => {
        const key = studentKey(student.room, student.no);
        set({
          mode,
          student,
          phase: 'running',
          lastResult: null,
          attempt: {
            mode,
            student,
            key,
            items: buildAttempt(mode, key, shuffleSet),
            answers: emptyAnswers(),
            index: 0,
            startedAt: Date.now(),
            elapsedSec: 0,
          },
        });
      },

      discardAttempt: () => set({ attempt: null, phase: 'form' }),
      resumeAttempt: () => {
        const a = get().attempt;
        if (a) set({ phase: 'running', mode: a.mode, student: a.student });
      },

      answer: (no, originalIndex) => {
        const a = get().attempt;
        if (!a) return;
        const answers = a.answers.slice();
        answers[no - 1] = originalIndex;
        set({ attempt: { ...a, answers } });
      },

      goto: (index) => {
        const a = get().attempt;
        if (!a) return;
        set({ attempt: { ...a, index: Math.max(0, Math.min(a.items.length - 1, index)) } });
      },

      step: (delta) => get().goto((get().attempt?.index ?? 0) + delta),

      // ⚠️ ห้ามให้เข็มวินาทีเขียน store ทุกวินาที — persist ของ zustand เขียน localStorage
      // ทุกครั้งที่ state เปลี่ยน (JSON ของ attempt ≈ 15KB) = 3,600 ครั้ง/ชม. บนแท็บเล็ตโรงเรียน
      // จอทำข้อสอบจึงนับวินาทีใน component แล้วมาลงบันทึกเป็นช่วง ๆ + ตอนออกจากจอ
      setElapsed: (sec) => {
        const a = get().attempt;
        if (!a || sec === a.elapsedSec) return;
        set({ attempt: { ...a, elapsedSec: sec } });
      },

      review: () => set({ phase: 'review' }),
      backToQuestions: () => set({ phase: 'running' }),

      submit: async ({ sendName, allowRetake }) => {
        const a = get().attempt;
        if (!a) return;
        const scored = scoreAttempt(a.answers);
        const name = a.student.name.trim();
        // สำเนาในเครื่อง — **เก็บชื่อไว้เสมอ** ไม่ผูกกับสวิตช์ส่งชื่อ
        // ⚠️ เดิมสร้างก้อนเดียวแล้วใช้ทั้งเก็บและส่ง → ปิดสวิตช์ส่งชื่อเมื่อไหร่
        // สำเนาในเครื่องก็ไม่มีชื่อไปด้วย จอครูเลยขึ้น "ไม่ได้ระบุชื่อ" ทั้งกระดาน
        const local: TestSubmission = {
          mode: a.mode,
          studentKey: a.key,
          studentNo: a.student.no.trim(),
          studentRoom: a.student.room.trim(),
          ...(name ? { studentName: name } : null),
          score: scored.score,
          total: scored.total,
          durationSec: a.elapsedSec,
          answers: a.answers,
          byKing: scored.byKing,
          submittedAt: Date.now(),
        };
        // ก้อนที่ส่งขึ้นระบบโรงเรียน — ตัดชื่อออกเมื่อครูปิดสวิตช์
        // (JSON.stringify ตัดฟิลด์ที่เป็น undefined ทิ้งอยู่แล้ว)
        const base: TestSubmission = sendName ? local : { ...local, studentName: undefined };
        const payload: TestSubmission = { ...base, retake: allowRetake };

        // เก็บในเครื่องก่อนเสมอ แล้วค่อยลองส่ง — เด็กต้องได้หน้าผลทันทีไม่ว่าเน็ตจะเป็นยังไง
        set({
          attempt: null,
          phase: 'result',
          lastResult: local,
          results: upsert(get().results, local),
        });
        if (!testApiAvailable()) return;
        set({ sending: true });
        try {
          await submitResult(payload);
        } catch {
          set({ queue: [...get().queue, payload] });
        } finally {
          set({ sending: false });
        }
      },

      flushQueue: async () => {
        if (!testApiAvailable() || get().sending) return;
        const pending = get().queue;
        if (!pending.length) return;
        set({ sending: true });
        const left: TestSubmission[] = [];
        for (const row of pending) {
          try {
            await submitResult(row);
          } catch (err) {
            // เจอ "ซ้ำ" = ส่งสำเร็จไปแล้วรอบก่อน หรือครูยังไม่เปิดโหมดทำซ้ำ → ทิ้งออกจากคิว
            // ไม่งั้นคิวจะค้างวนส่งทุกครั้งที่เปิดแอปไม่รู้จบ
            if (!(err instanceof TestDuplicateError)) left.push(row);
          }
        }
        set({ queue: left, sending: false });
      },

      /**
       * ล้างผลที่เก็บไว้ในแท็บเล็ตเครื่องนี้ (คุณครูสั่งเอง)
       *
       * ⚠️ ต้องล้าง `queue` ด้วยเสมอ — คิวคือผลที่ยังส่งไม่สำเร็จ ถ้าเหลือไว้
       * `flushQueue()` ตอนเปิดแอปรอบหน้าจะส่งขึ้นไปใหม่ แล้วแถวที่คุณครูเพิ่งลบใน
       * ฐานข้อมูลจะ "งอกกลับมาเอง" โดยไม่มีใครสั่ง
       */
      clearLocalResults: () => set({ results: [], queue: [], lastResult: null }),

      noteGameFinished: () => set({ finishedGames: get().finishedGames + 1 }),

      resultFor: (mode, key) =>
        get().results.find((r) => r.mode === mode && r.studentKey === key) ?? null,
    }),
    {
      name: 'bg7_test',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // ไม่เก็บ phase: เปิดแอปมาต้องอยู่ที่หน้า Home เสมอ แล้วค่อยให้เด็กกดเข้าแบบทดสอบเอง
      // แต่ `attempt` เก็บไว้ → กดเข้ามาแล้วระบบถามว่า "ทำต่อจากข้อเดิมไหม"
      partialize: (s) => ({
        student: s.student,
        attempt: s.attempt,
        results: s.results,
        queue: s.queue,
        finishedGames: s.finishedGames,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TestState>;
        const attempt =
          p.attempt &&
          Array.isArray(p.attempt.items) &&
          p.attempt.items.length === TEST_TOTAL &&
          Array.isArray(p.attempt.answers)
            ? p.attempt
            : null;
        return {
          ...current,
          student: p.student ?? current.student,
          attempt,
          results: p.results ?? [],
          queue: p.queue ?? [],
          finishedGames: p.finishedGames ?? 0,
        };
      },
    }
  )
);

/** ทำไปแล้วกี่ข้อ (ใช้ทั้งแถบไทม์ไลน์และหน้าตรวจทาน) */
export function answeredCount(answers: number[]): number {
  return answers.reduce((n, a) => (a !== UNANSWERED ? n + 1 : n), 0);
}
