// หน้าผลหลังส่งคำตอบ
//
// 🔒 ก่อนเรียน (ค่าเริ่มต้น) = ไม่โชว์คะแนน ไม่โชว์เฉลย
//    ถ้าเฉลยตั้งแต่ก่อนเล่นเกม แบบทดสอบหลังเรียนจะกลายเป็นการวัด "ความจำเฉลย"
//    แทน "สิ่งที่ได้จากเกม" แล้วตัวเลขพัฒนาการที่ครูเอาไปใช้จะไม่มีความหมาย

import { useGame } from '@/core/store';
import { useTest } from '@/core/testStore';
import type { TestSubmission } from '@/core/testApi';
import {
  compareAttempts,
  isCorrect,
  scoreAttempt,
  shouldRevealAnswers,
  TEST_MODE_LABEL,
  TEST_QUESTIONS,
  UNANSWERED,
  weakKings,
} from '@/core/pretest';
import {
  Card,
  colorOfKing,
  CRIMSON,
  EraStrip,
  formatDuration,
  ghostBtn,
  GOLD,
  headingStyle,
  hexA,
  INK,
  labelOfKing,
  MUTED,
  primaryBtn,
  shade,
  toThai,
} from './testUi';

const CHOICE_LETTERS = ['ก', 'ข', 'ค', 'ง'];

export function TestResult({ result, onClose }: { result: TestSubmission; onClose: () => void }) {
  const showExplain = useGame((s) => s.settings.testShowExplain);
  const resultFor = useTest((s) => s.resultFor);
  const queued = useTest((s) => s.queue.some((q) => q.mode === result.mode && q.studentKey === result.studentKey));
  const sending = useTest((s) => s.sending);

  const reveal = shouldRevealAnswers(result.mode, showExplain);
  const scored = scoreAttempt(result.answers);
  const pre = result.mode === 'post' ? resultFor('pre', result.studentKey) : null;
  const gain = pre ? compareAttempts(scoreAttempt(pre.answers), scored) : null;
  const weak = weakKings(scored.byKing);

  const sendNote = sending
    ? 'กำลังส่งผลการทำแบบทดสอบถึงคุณครู…'
    : queued
    ? 'บันทึกผลไว้ในเครื่องแล้ว และจะส่งถึงคุณครูโดยอัตโนมัติเมื่อเชื่อมต่ออินเทอร์เน็ตได้'
    : 'บันทึกและส่งผลถึงคุณครูเรียบร้อยแล้ว';

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateRows: 'auto minmax(0,1fr) auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ ...headingStyle, fontSize: 19 }}>
          {TEST_MODE_LABEL[result.mode]} · ส่งคำตอบเรียบร้อยแล้ว
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: MUTED }}>
          {result.studentName || 'ไม่ระบุชื่อ'} · เลขที่ {result.studentNo} · {result.studentRoom} · ใช้เวลา{' '}
          {formatDuration(result.durationSec)}
        </p>
      </div>

      <div className="t-scroll" style={{ overflowY: 'auto', minHeight: 0, display: 'grid', gap: 14, alignContent: 'start' }}>
        {!reveal ? (
          <Card style={{ display: 'grid', gap: 10, placeItems: 'center', padding: 30, textAlign: 'center' }}>
            <div style={{ fontSize: 46 }}>📜</div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: INK, textWrap: 'balance' }}>
              ส่งคำตอบครบ {toThai(scored.answered)} ข้อเรียบร้อยแล้ว
            </h2>
            <p style={{ margin: 0, fontSize: 15.5, color: MUTED, maxWidth: 460, lineHeight: 1.6 }}>
              คะแนนและเฉลยจะเปิดให้ดูเมื่อนักเรียนทำแบบทดสอบหลังเรียนเรียบร้อยแล้ว
              เพื่อให้เห็นพัฒนาการของตนเอง
            </p>
            <p aria-live="polite" style={{ margin: 0, fontSize: 13, color: MUTED }}>
              {sendNote}
            </p>
          </Card>
        ) : (
          <>
            {/* คะแนน */}
            <Card style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', placeItems: 'center', minWidth: 130 }}>
                <div style={{ fontSize: 54, fontWeight: 800, color: CRIMSON, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {toThai(scored.score)}
                </div>
                <div style={{ fontSize: 14, color: MUTED, fontWeight: 700 }}>
                  จาก {toThai(scored.total)} คะแนน
                </div>
              </div>
              {gain ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: INK }}>
                    ก่อนเรียน {toThai(gain.pre)} → หลังเรียน {toThai(gain.post)}{' '}
                    <span style={{ color: gain.diff >= 0 ? '#2E7D32' : CRIMSON }}>
                      ({gain.diff >= 0 ? '+' : ''}
                      {toThai(gain.diff)})
                    </span>
                  </div>
                  {gain.normalized !== null && (
                    <div style={{ fontSize: 14, color: MUTED }}>
                      ทำคะแนนส่วนที่เคยตอบไม่ได้ เพิ่มขึ้น {toThai(Math.round(gain.normalized * 100))}%
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 14.5, color: MUTED, maxWidth: 420, lineHeight: 1.6 }}>
                  ยังไม่พบผลการทำแบบทดสอบก่อนเรียนของเลขที่ {result.studentNo} ในเครื่องนี้
                  จึงยังเปรียบเทียบพัฒนาการไม่ได้ คุณครูสามารถดูผลรวมทั้งห้องได้จากระบบของโรงเรียน
                </div>
              )}
              <div style={{ flex: 1 }} />
              <p aria-live="polite" style={{ margin: 0, fontSize: 12.5, color: MUTED, maxWidth: 200 }}>
                {sendNote}
              </p>
            </Card>

            {/* ไทม์ไลน์ถูก/ผิด */}
            <Card style={{ display: 'grid', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: INK }}>ผลการตอบรายข้อ เรียงตามลำดับรัชสมัย</h2>
              <EraStrip
                state={(no) =>
                  result.answers[no - 1] === UNANSWERED ? 'empty' : isCorrect(no, result.answers[no - 1]) ? 'correct' : 'wrong'
                }
              />
              {pre && (
                <>
                  <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>ผลการทำแบบทดสอบก่อนเรียน</div>
                  <EraStrip
                    state={(no) =>
                      pre.answers[no - 1] === UNANSWERED ? 'empty' : isCorrect(no, pre.answers[no - 1]) ? 'correct' : 'wrong'
                    }
                    showLabels={false}
                    compact
                  />
                </>
              )}
            </Card>

            {/* ควรทบทวนพระองค์ไหน */}
            {weak.length > 0 && (
              <Card style={{ display: 'grid', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: INK }}>เนื้อหาที่ควรทบทวนเพิ่มเติม</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {weak.map((k) => (
                    <span
                      key={k.kingId}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        background: hexA(colorOfKing(k.kingId), 0.14),
                        border: `1.5px solid ${hexA(colorOfKing(k.kingId), 0.5)}`,
                        color: shade(colorOfKing(k.kingId)),
                        fontSize: 13.5,
                        fontWeight: 700,
                      }}
                    >
                      {labelOfKing(k.kingId)} {toThai(k.correct)}/{toThai(k.total)}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: MUTED }}>
                  นักเรียนสามารถศึกษาเรื่องราวของแต่ละพระองค์เพิ่มเติมได้ที่ “พิพิธภัณฑ์” ในหน้าหลัก
                </div>
              </Card>
            )}

            {/* เฉลยรายข้อ */}
            <div style={{ display: 'grid', gap: 10 }}>
              {TEST_QUESTIONS.map((q) => {
                const picked = result.answers[q.no - 1] ?? UNANSWERED;
                const ok = picked === q.answer;
                return (
                  <Card
                    key={q.no}
                    style={{
                      borderLeft: `6px solid ${ok ? '#2E7D32' : CRIMSON}`,
                      display: 'grid',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: hexA(GOLD, 0.95), minWidth: 34 }}>
                        {toThai(q.no)}
                      </span>
                      <span style={{ fontSize: 16.5, fontWeight: 700, color: INK, lineHeight: 1.45, minWidth: 0, overflowWrap: 'anywhere' }}>
                        {q.question}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: 4, paddingLeft: 44 }}>
                      {q.choices.map((c, i) => {
                        const isAns = i === q.answer;
                        const isPick = i === picked;
                        return (
                          <div
                            key={i}
                            style={{
                              fontSize: 15,
                              lineHeight: 1.45,
                              color: isAns ? '#1B5E20' : isPick ? CRIMSON : '#6B5E4E',
                              fontWeight: isAns || isPick ? 700 : 600,
                            }}
                          >
                            {CHOICE_LETTERS[i]}. {c}
                            {isAns && ' — คำตอบที่ถูกต้อง'}
                            {isPick && !isAns && ' — คำตอบของนักเรียน'}
                          </div>
                        );
                      })}
                      {picked === UNANSWERED && (
                        <div style={{ fontSize: 14, color: CRIMSON, fontWeight: 700 }}>นักเรียนไม่ได้ตอบข้อนี้</div>
                      )}
                    </div>
                    <div
                      style={{
                        marginLeft: 44,
                        fontSize: 14.5,
                        lineHeight: 1.6,
                        color: '#5A4A2E',
                        background: hexA(GOLD, 0.1),
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}
                    >
                      {q.explanation}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="t-tap" onClick={onClose} style={reveal ? ghostBtn : primaryBtn}>
          กลับสู่หน้าหลัก
        </button>
      </div>
    </div>
  );
}
