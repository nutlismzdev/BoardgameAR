// เปลือกของแบบทดสอบ — ลงชื่อ → ทำข้อสอบ → ตรวจทาน → ส่ง → หน้าผล
// เปิดเป็น overlay เต็มจอจากหน้า Home (แพตเทิร์นเดียวกับ RoomPanel/SettingsPanel)

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useGame } from '@/core/store';
import { answeredCount, useTest } from '@/core/testStore';
import { TEST_META, TEST_MODE_LABEL, TEST_TOTAL, UNANSWERED, studentKey } from '@/core/pretest';
import type { TestMode } from '@/core/pretest';
import { testApiAvailable } from '@/core/testApi';
import { TestRunner } from './TestRunner';
import { TestResult } from './TestResult';
import {
  Card,
  CRIMSON,
  dangerBtn,
  EraStrip,
  fieldInput,
  ghostBtn,
  GOLD,
  headingStyle,
  hexA,
  INK,
  formatDateTime,
  MUTED,
  PAPER,
  primaryBtn,
  TEST_STYLE,
  toThai,
} from './testUi';

const CHOICE_LETTERS = ['ก', 'ข', 'ค', 'ง'];

export function TestPanel({ onClose }: { onClose: () => void }) {
  const phase = useTest((s) => s.phase);
  const mode = useTest((s) => s.mode);
  const lastResult = useTest((s) => s.lastResult);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 170,
        background: PAPER,
        color: INK,
        fontFamily: "'Sarabun', sans-serif",
        // เผื่อรอยบาก/แถบท่าทางของแท็บเล็ต — overlay กินเต็มจอจึงต้องเผื่อเอง
        padding: 'clamp(14px, 2.2vw, 26px)',
        paddingTop: 'max(clamp(14px, 2.2vw, 26px), env(safe-area-inset-top))',
        paddingBottom: 'max(clamp(14px, 2.2vw, 26px), env(safe-area-inset-bottom))',
        display: 'grid',
      }}
    >
      <style>{TEST_STYLE}</style>
      <div style={{ width: 'min(1080px, 100%)', margin: '0 auto', height: '100%', minHeight: 0 }}>
        {phase === 'form' && <TestForm mode={mode} onClose={onClose} />}
        {phase === 'running' && <TestRunner onExit={onClose} />}
        {phase === 'review' && <TestReview />}
        {phase === 'result' && lastResult && <TestResult result={lastResult} onClose={onClose} />}
      </div>
    </div>
  );
}

// ── ลงชื่อ (+ ถามว่าจะทำต่อจากของเดิมไหม) ────────────────────────────────
function TestForm({ mode, onClose }: { mode: TestMode; onClose: () => void }) {
  const saved = useTest((s) => s.student);
  const attempt = useTest((s) => s.attempt);
  const startAttempt = useTest((s) => s.startAttempt);
  const resumeAttempt = useTest((s) => s.resumeAttempt);
  const discardAttempt = useTest((s) => s.discardAttempt);
  const shuffleSet = useGame((s) => s.settings.testShuffle);
  const sendName = useGame((s) => s.settings.testSendName);
  const allowRetake = useGame((s) => s.settings.testAllowRetake);
  const resultFor = useTest((s) => s.resultFor);

  const [form, setForm] = useState<StudentForm>(() => ({
    name: saved.name,
    no: saved.no,
    room: saved.room || 'ป.5',
  }));
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // ข้อสอบที่ทำค้างไว้ต้องถามก่อนเสมอ — เขียนทับทิ้งเงียบ ๆ = เด็กเสีย 20 ข้อที่ทำมาแล้ว
  if (attempt) {
    const done = answeredCount(attempt.answers);
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <Card style={{ display: 'grid', gap: 14, maxWidth: 520, padding: 26 }}>
          <h1 style={headingStyle}>มีแบบทดสอบที่ยังทำไม่เสร็จ</h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#5A4A2E' }}>
            {TEST_MODE_LABEL[attempt.mode]} ของ {attempt.student.name || 'ไม่ระบุชื่อ'} · เลขที่{' '}
            {attempt.student.no} · {attempt.student.room}
            <br />
            ทำไปแล้ว {toThai(done)} ข้อ จากทั้งหมด {toThai(TEST_TOTAL)} ข้อ
          </p>
          {confirmDiscard ? (
            // ลบของที่ทำมาแล้ว 20 ข้อคือการกระทำที่กู้คืนไม่ได้ — ต้องถามซ้ำก่อนเสมอ
            <div style={{ display: 'grid', gap: 10 }}>
              <p style={{ margin: 0, color: CRIMSON, fontWeight: 700, fontSize: 15.5 }}>
                ยืนยันลบคำตอบ {toThai(done)} ข้อที่ทำไว้ แล้วเริ่มทำใหม่ทั้งหมด (ไม่สามารถเรียกคืนได้)
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="t-tap" onClick={() => setConfirmDiscard(false)} style={primaryBtn}>
                  ยกเลิก
                </button>
                <button type="button" className="t-tap" onClick={discardAttempt} style={dangerBtn}>
                  ยืนยันเริ่มทำใหม่
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="t-tap" onClick={resumeAttempt} style={primaryBtn}>
                ทำต่อจากข้อเดิม
              </button>
              <button type="button" className="t-tap" onClick={() => setConfirmDiscard(true)} style={ghostBtn}>
                เริ่มทำใหม่ทั้งหมด
              </button>
              <button type="button" className="t-tap" onClick={onClose} style={ghostBtn}>
                กลับสู่หน้าหลัก
              </button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const submit = () => {
    if (!form.no.trim() || !form.room.trim()) {
      setError('กรุณากรอกเลขที่และชั้นให้ครบถ้วน');
      return;
    }
    // ทำรอบเดิมซ้ำ = คะแนนใช้วัดผลไม่ได้ (ดูเหตุผลที่ `testAllowRetake` ใน store.ts)
    // จึงกันไว้ก่อน แล้วให้คุณครูเป็นคนเปิดให้ทำใหม่เมื่อมีเหตุจริง
    const done = allowRetake ? null : resultFor(mode, studentKey(form.room, form.no));
    if (done) {
      setError(
        `เลขที่ ${done.studentNo} ${done.studentRoom} ทำ${TEST_MODE_LABEL[mode]}ไปแล้ว ` +
          `เมื่อ ${formatDateTime(done.submittedAt)} · หากต้องการทำใหม่ กรุณาแจ้งคุณครู`
      );
      return;
    }
    startAttempt(mode, { ...form, name: form.name.trim() }, shuffleSet);
  };

  return (
    <div className="t-scroll" style={{ display: 'grid', placeItems: 'center', height: '100%', overflowY: 'auto' }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ width: 'min(560px, 100%)' }}
      >
        <Card style={{ display: 'grid', gap: 16, padding: 26 }}>
          <div>
            <h1 style={headingStyle}>{TEST_MODE_LABEL[mode]}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: MUTED }}>
              {TEST_META.school} · {TEST_META.grade} · {toThai(TEST_TOTAL)} ข้อ
              {TEST_META.timeLimitMin ? ` · ${toThai(TEST_META.timeLimitMin)} นาที` : ''}
            </p>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <Field label="ชื่อ-นามสกุล" htmlFor="test-name">
              <input
                id="test-name"
                name="student-name"
                className="t-input"
                style={fieldInput}
                value={form.name}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="เช่น สมชาย ใจดี"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Field label="เลขที่" htmlFor="test-no">
                <input
                  id="test-no"
                  name="student-no"
                  className="t-input"
                  style={fieldInput}
                  value={form.no}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  placeholder="เช่น 12"
                  onChange={(e) => setForm({ ...form, no: e.target.value })}
                />
              </Field>
              <Field label="ชั้น" htmlFor="test-room">
                <input
                  id="test-room"
                  name="student-room"
                  className="t-input"
                  style={fieldInput}
                  value={form.room}
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  placeholder="เช่น ป.5/1"
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: MUTED,
              background: hexA(GOLD, 0.1),
              borderRadius: 10,
              padding: '10px 12px',
            }}
          >
            {testApiAvailable()
              ? `ข้อมูลที่ส่งถึงคุณครู: เลขที่ ชั้น และคะแนน${sendName ? ' รวมถึงชื่อ-นามสกุล' : ''}`
              : 'ขณะนี้ยังไม่ได้เชื่อมต่อกับระบบของโรงเรียน ผลการทำแบบทดสอบจะบันทึกไว้ในเครื่องนี้'}
            {!sendName && testApiAvailable() && ' ส่วนชื่อ-นามสกุลจะบันทึกไว้ในเครื่องนี้เท่านั้น'}
          </p>

          <p role="alert" style={{ margin: 0, minHeight: error ? undefined : 0, color: CRIMSON, fontWeight: 700, fontSize: 14.5 }}>
            {error}
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="t-tap" onClick={onClose} style={ghostBtn}>
              ยกเลิก
            </button>
            <button type="submit" className="t-tap" style={primaryBtn}>
              เริ่มทำแบบทดสอบ
            </button>
          </div>
        </Card>
      </form>
    </div>
  );
}

interface StudentForm {
  name: string;
  no: string;
  room: string;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 5, flex: '1 1 140px', minWidth: 0 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 13.5, fontWeight: 700, color: '#7A5B1E' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── ตรวจทานก่อนส่ง ────────────────────────────────────────────────────────
function TestReview() {
  const attempt = useTest((s) => s.attempt);
  const goto = useTest((s) => s.goto);
  const back = useTest((s) => s.backToQuestions);
  const submit = useTest((s) => s.submit);
  const sending = useTest((s) => s.sending);
  const sendName = useGame((s) => s.settings.testSendName);
  const allowRetake = useGame((s) => s.settings.testAllowRetake);
  const [confirming, setConfirming] = useState(false);

  if (!attempt) return null;
  const done = answeredCount(attempt.answers);
  const missing = TEST_TOTAL - done;

  const jump = (no: number) => {
    const at = attempt.items.findIndex((i) => i.no === no);
    if (at >= 0) goto(at);
    back();
  };

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateRows: 'auto auto minmax(0,1fr) auto', height: '100%' }}>
      <h1 style={headingStyle}>ตรวจทานก่อนส่ง</h1>
      <EraStrip
        state={(no) => (attempt.answers[no - 1] !== UNANSWERED ? 'answered' : 'empty')}
        onPick={jump}
        ariaLabel="ข้ามไปแก้รายข้อ"
      />

      <div className="t-scroll" style={{ overflowY: 'auto', minHeight: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 8,
          }}
        >
          {attempt.items
            .slice()
            .sort((a, b) => a.no - b.no)
            .map((item) => {
              const picked = attempt.answers[item.no - 1] ?? UNANSWERED;
              const shownAt = picked === UNANSWERED ? -1 : item.choiceMap.indexOf(picked);
              const blank = picked === UNANSWERED;
              return (
                <button
                  key={item.no}
                  type="button"
                  className="t-tap"
                  onClick={() => jump(item.no)}
                  aria-label={`ข้อ ${item.no} ${blank ? 'ยังไม่ได้ตอบ' : `ตอบข้อ ${CHOICE_LETTERS[shownAt] ?? ''}`} เลือกเพื่อกลับไปทำข้อนี้`}
                  style={{
                    fontFamily: "'Sarabun',sans-serif",
                    textAlign: 'left',
                    background: blank ? hexA(CRIMSON, 0.07) : '#FFFDF6',
                    border: `1.5px solid ${blank ? hexA(CRIMSON, 0.45) : hexA(GOLD, 0.45)}`,
                    borderRadius: 10,
                    padding: '9px 11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 46,
                  }}
                >
                  <span style={{ fontSize: 17, fontWeight: 800, color: hexA(GOLD, 0.95) }}>
                    {toThai(item.no)}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: blank ? CRIMSON : INK }}>
                    {blank ? 'ยังไม่ได้ตอบ' : `ตอบข้อ ${CHOICE_LETTERS[shownAt] ?? '—'}`}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="t-tap" onClick={back} style={ghostBtn}>
          ← กลับไปทำแบบทดสอบ
        </button>
        <p
          aria-live="polite"
          style={{
            margin: 0,
            flex: '1 1 160px',
            fontSize: 14.5,
            fontWeight: 700,
            color: missing ? CRIMSON : '#2E7D32',
          }}
        >
          {missing ? `ยังไม่ได้ตอบ ${toThai(missing)} ข้อ` : 'ตอบครบทุกข้อเรียบร้อยแล้ว'}
        </p>
        {confirming ? (
          <>
            <span style={{ fontSize: 14.5, color: CRIMSON, fontWeight: 700 }}>
              ยืนยันส่งคำตอบ เมื่อส่งแล้วจะไม่สามารถแก้ไขได้
            </span>
            <button type="button" className="t-tap" onClick={() => setConfirming(false)} style={ghostBtn}>
              ยกเลิก
            </button>
            <button
              type="button"
              className="t-tap"
              disabled={sending}
              onClick={() => void submit({ sendName, allowRetake })}
              style={primaryBtn}
            >
              {sending ? 'กำลังส่งคำตอบ…' : 'ยืนยันการส่ง'}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="t-tap"
            disabled={sending}
            onClick={() => (missing ? setConfirming(true) : void submit({ sendName, allowRetake }))}
            style={primaryBtn}
          >
            {sending ? 'กำลังส่งคำตอบ…' : 'ส่งคำตอบ'}
          </button>
        )}
      </div>
    </div>
  );
}
