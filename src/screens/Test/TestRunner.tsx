// จอทำข้อสอบ — ทีละ 1 ข้อเต็มจอ
// ⚠️ ห้ามบอกถูก/ผิดตรงนี้เด็ดขาด แม้แต่ตอนหลังเรียน (เฉลยอยู่หน้าผลหลังส่งแล้วเท่านั้น)
// ไม่งั้นเด็กจะย้อนกลับไปแก้ข้อเดิมจนได้เต็มทุกคน แล้วคะแนนไม่มีความหมาย

import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/core/store';
import { answeredCount, useTest } from '@/core/testStore';
import { TEST_MODE_LABEL, TEST_TOTAL, UNANSWERED } from '@/core/pretest';
import {
  Card,
  CRIMSON,
  EraStrip,
  formatClock,
  ghostBtn,
  GOLD,
  headingStyle,
  hexA,
  INK,
  KingTag,
  MUTED,
  primaryBtn,
  toThai,
} from './testUi';

const CHOICE_LETTERS = ['ก', 'ข', 'ค', 'ง'];

export function TestRunner({ onExit }: { onExit: () => void }) {
  const attempt = useTest((s) => s.attempt);
  const answer = useTest((s) => s.answer);
  const goto = useTest((s) => s.goto);
  const stepBy = useTest((s) => s.step);
  const setElapsed = useTest((s) => s.setElapsed);
  const review = useTest((s) => s.review);
  const limitMin = useGame((s) => s.settings.testTimeLimitMin);

  // นับเวลาเฉพาะตอนจอนี้เปิดอยู่จริง — ปิดแท็บทิ้งไว้ข้ามคืนแล้วเวลาต้องไม่เดินต่อ
  // เข็มวินาทีอยู่ใน component ส่วน store รับรู้ทุก 15 วิ + ตอนออกจากจอ (กันเขียน localStorage รัว)
  const startSec = useRef(attempt?.elapsedSec ?? 0);
  const [sec, setSec] = useState(startSec.current);
  const secRef = useRef(sec);
  secRef.current = sec;

  useEffect(() => {
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => {
      clearInterval(id);
      setElapsed(secRef.current); // ออกจากจอ (พักไว้ก่อน/ไปหน้าตรวจทาน) = ลงบันทึกเวลาจริง
    };
  }, [setElapsed]);

  useEffect(() => {
    if (sec > 0 && sec % 15 === 0) setElapsed(sec);
  }, [sec, setElapsed]);

  if (!attempt) return null;

  const item = attempt.items[attempt.index];
  const picked = attempt.answers[item.no - 1] ?? UNANSWERED;
  const done = answeredCount(attempt.answers);
  const limitSec = limitMin > 0 ? limitMin * 60 : 0;
  const leftSec = limitSec ? Math.max(0, limitSec - sec) : 0;
  const warning = limitSec > 0 && leftSec <= 300;

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateRows: 'auto auto minmax(0,1fr) auto', height: '100%' }}>
      {/* หัวจอ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ ...headingStyle, fontSize: 17 }}>{TEST_MODE_LABEL[attempt.mode]}</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: MUTED }}>
          {attempt.student.name || 'ไม่ระบุชื่อ'} · เลขที่ {attempt.student.no} · {attempt.student.room}
        </p>
        <div style={{ flex: 1 }} />
        {limitSec > 0 && (
          <div
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 800,
              fontSize: 15,
              padding: '5px 12px',
              borderRadius: 999,
              color: warning ? CRIMSON : '#7A5B1E',
              background: warning ? hexA(CRIMSON, 0.1) : hexA(GOLD, 0.14),
              border: `1.5px solid ${warning ? hexA(CRIMSON, 0.5) : hexA(GOLD, 0.5)}`,
            }}
          >
            <span className="t-nav-long">{leftSec > 0 ? 'เหลือ ' : ''}</span>
            {leftSec > 0 ? formatClock(leftSec) : 'หมดเวลา'}
          </div>
        )}
        <button
          type="button"
          className="t-tap"
          onClick={onExit}
          style={{ ...ghostBtn, padding: '9px 14px', minHeight: 44, fontSize: 14 }}
        >
          หยุดพักชั่วคราว
        </button>
      </div>

      {/* แถบไทม์ไลน์ — แตะข้ามข้อได้ */}
      <EraStrip
        state={(no) => (attempt.answers[no - 1] !== UNANSWERED ? 'answered' : 'empty')}
        currentNo={item.no}
        onPick={(no) => {
          const at = attempt.items.findIndex((i) => i.no === no);
          if (at >= 0) goto(at);
        }}
        ariaLabel="ไปยังข้ออื่น"
      />

      {/* โจทย์ */}
      <Card scroll style={{ overflowY: 'auto', minHeight: 0, display: 'grid', gap: 14, alignContent: 'start' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
          <div
            style={{
              fontSize: 46,
              fontWeight: 800,
              lineHeight: 0.9,
              color: hexA(GOLD, 0.95),
              minWidth: 62,
            }}
          >
            {toThai(item.no)}
          </div>
          <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
            <span>
              <KingTag no={item.no} />
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: INK,
                lineHeight: 1.45,
                overflowWrap: 'anywhere',
                textWrap: 'pretty',
              }}
            >
              {item.question}
            </h2>
          </div>
        </div>

        <div role="radiogroup" aria-label="ตัวเลือกคำตอบ" style={{ display: 'grid', gap: 8 }}>
          {item.choices.map((text, i) => {
            const original = item.choiceMap[i];
            const on = picked === original;
            return (
              <button
                key={i}
                type="button"
                className="t-tap"
                role="radio"
                aria-checked={on}
                onClick={() => answer(item.no, original)}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  textAlign: 'left',
                  fontFamily: "'Sarabun',sans-serif",
                  fontSize: 17,
                  fontWeight: on ? 800 : 600,
                  color: INK,
                  background: on ? hexA(GOLD, 0.18) : '#fff',
                  border: `2px solid ${on ? GOLD : hexA(GOLD, 0.35)}`,
                  borderRadius: 12,
                  padding: '13px 15px',
                  minHeight: 54,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    background: on ? GOLD : hexA(GOLD, 0.16),
                    color: on ? '#fff' : '#7A5B1E',
                    fontWeight: 800,
                    fontSize: 15,
                  }}
                >
                  {CHOICE_LETTERS[i]}
                </span>
                <span style={{ lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>{text}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ท้ายจอ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="t-tap"
          onClick={() => stepBy(-1)}
          disabled={attempt.index === 0}
          aria-label="ข้อก่อนหน้า"
          style={{ ...ghostBtn, opacity: attempt.index === 0 ? 0.45 : 1 }}
        >
          <span className="t-nav-long">← ข้อก่อนหน้า</span>
          <span className="t-nav-short">←</span>
        </button>
        <p
          aria-live="polite"
          style={{
            margin: 0,
            flex: '1 1 120px',
            textAlign: 'center',
            fontSize: 14.5,
            color: MUTED,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ทำแล้ว {toThai(done)} จาก {toThai(TEST_TOTAL)} ข้อ
        </p>
        {attempt.index < attempt.items.length - 1 ? (
          <button type="button" className="t-tap" onClick={() => stepBy(1)} style={primaryBtn}>
            ข้อถัดไป →
          </button>
        ) : (
          <button type="button" className="t-tap" onClick={review} style={primaryBtn}>
            ตรวจทานก่อนส่ง
          </button>
        )}
      </div>
    </div>
  );
}
