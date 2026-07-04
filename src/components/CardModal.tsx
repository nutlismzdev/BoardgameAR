import { useEffect, useMemo, useState } from 'react';
import { useGame } from '@/core/store';
import {
  getKing,
  getQuizForKing,
  getRandomChance,
  getRandomKnowledge,
  getMissionForKing,
  KNOWLEDGE_CAP,
} from '@/core/content';
import { color, radius, elevation } from '@/theme/tokens';
import { ARGoldChallenge } from './ARGoldChallenge';
import type { Orientation, KnowledgeCard } from '@/core/types';

// ป้ายตัวเลือกภาษาไทย ก/ข/ค/ง สำหรับการ์ดภารกิจ/ความรู้
const THAI_CHOICE = ['ก', 'ข', 'ค', 'ง'];

// Modal การ์ดรวม (quiz / mission / knowledge / king / chance)
// แนวตั้ง = เด้งจากล่าง (bottom sheet), แนวนอน = กลางจอ (center dialog)
export function CardModal({ orientation }: { orientation: Orientation }) {
  const event = useGame((s) => s.pendingEvent);
  const resolveReward = useGame((s) => s.resolveReward);
  const answerQuiz = useGame((s) => s.answerQuiz);
  const answerKingCoin = useGame((s) => s.answerKingCoin);
  const completeLessonStep = useGame((s) => s.completeLessonStep);
  const collectKnowledge = useGame((s) => s.collectKnowledge);
  const knowledgeCards = useGame((s) => s.players[s.currentPlayerIndex]?.knowledgeCards ?? []);
  const applyChance = useGame((s) => s.applyChance);
  const giveItem = useGame((s) => s.giveItem);
  const useItem = useGame((s) => s.useItem);
  const items = useGame((s) => s.items);
  const closeEvent = useGame((s) => s.closeEvent);
  const settings = useGame((s) => s.settings);
  const usedQuizIds = useGame((s) => s.usedQuizIds);
  const markQuizSeen = useGame((s) => s.markQuizSeen);
  const [answered, setAnswered] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]); // ตัวเลือกที่ 50:50 ตัดออก
  const [knowledgeAnswer, setKnowledgeAnswer] = useState<number | null>(null);
  const [missionAnswer, setMissionAnswer] = useState<number | null>(null);
  const [arGoldOpen, setArGoldOpen] = useState(false);

  const kind = event?.kind;
  const kingId = event?.tile.kingId ?? null;
  const king = getKing(kingId);
  const isGold = kind === 'goldking'; // ช่องทอง — บทเรียนผ่าน AR (วิดีโอ + ลากคำตอบ)
  const isQuizKind = kind === 'question'; // เฉพาะช่องเหลืองที่ใช้ UI ควิซปกติ

  // ช่องทองก็ต้องมีคำถาม (ใช้กับ drag-to-slot ใน AR) จึงสุ่ม quiz ไว้ด้วย
  const quiz = useMemo(
    () => (kind === 'question' || isGold ? getQuizForKing(kingId, settings.difficulty, usedQuizIds) : null),
    [event]
  );
  const chance = useMemo(() => (kind === 'chance' ? getRandomChance() : null), [event]);
  const mission = useMemo(() => (kind === 'mission' ? getMissionForKing(kingId) : null), [event]);

  // การ์ดความรู้ = state เพื่อให้กดปุ่ม "สุ่มใหม่" เปลี่ยนคำถามได้ (สุ่มใบที่ยังไม่มี)
  const [knowledge, setKnowledge] = useState<KnowledgeCard | null>(null);
  useEffect(() => {
    setKnowledge(kind === 'knowledge' ? getRandomKnowledge(knowledgeCards) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  const rerollKnowledge = () => {
    const exclude = knowledge ? [...knowledgeCards, knowledge.id] : knowledgeCards;
    setKnowledge(getRandomKnowledge(exclude));
    setKnowledgeAnswer(null);
  };

  // ── ตัวจับเวลาคำถาม (เปิด/ปิดได้ใน Teacher Mode; หมดเวลา = เฉลยอัตโนมัติ) ──
  const timerOn = settings.timerEnabled;
  const [timeLeft, setTimeLeft] = useState<number>(0);
  useEffect(() => {
    if (!isQuizKind || !quiz) return;
    markQuizSeen(quiz.id);
    setTimeLeft(quiz.timeLimitSec);
    setAnswered(null);
    setHidden([]);
    setKnowledgeAnswer(null);
  }, [event]);
  useEffect(() => {
    setKnowledgeAnswer(null);
    setMissionAnswer(null);
    setArGoldOpen(false);
  }, [event]);
  useEffect(() => {
    if (!timerOn || !isQuizKind || answered !== null || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, answered, kind, timerOn]);
  // หมดเวลา → บังคับเฉลย (นับเป็นตอบผิด: index -1)
  useEffect(() => {
    if (timerOn && isQuizKind && timeLeft === 0 && answered === null && quiz) {
      setAnswered(-1);
    }
  }, [timeLeft, timerOn]);

  if (!event) return null;

  const isPortrait = orientation === 'portrait';
  const shell: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.5)',
    display: 'flex',
    alignItems: isPortrait ? 'flex-end' : 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: isPortrait ? 0 : 24,
  };
  const panel: React.CSSProperties = {
    background: color.surface,
    borderRadius: isPortrait ? `${radius.lg}px ${radius.lg}px 0 0` : radius.lg,
    boxShadow: elevation.modal,
    width: isPortrait ? '100%' : 'min(720px, 92vw)',
    maxHeight: '88vh',
    overflow: 'auto',
    padding: 24,
  };

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 26 }}>{isGold ? '🪙' : kind === 'bonus' ? '🎁' : '👑'}</span>
      <strong style={{ fontSize: 20, color: king?.themeColor ?? color.primary }}>
        {isGold
          ? `ชิงเหรียญกษัตริย์: ${king ? shortKing(king.name) : ''}`
          : kind === 'bonus'
          ? 'การ์ดโบนัส'
          : king?.name ?? 'การ์ดโชค'}
      </strong>
    </div>
  );

  return (
    <>
      {/* บทเรียน AR ช่องทอง (เต็มจอ) — ทับการ์ดปกติ */}
      {arGoldOpen && isGold && king && quiz && (
        <ARGoldChallenge
          king={king}
          quiz={quiz}
          useCamera={settings.arEnabled}
          onDone={(correct) => {
            setArGoldOpen(false);
            answerKingCoin(correct, kingId!);
            closeEvent();
          }}
        />
      )}
    <div style={shell}>
      <div style={panel}>
        {header}

        {/* ── ช่องทอง (AR เท่านั้น) — เข้าสู่บทเรียน AR เพื่อรับเหรียญกษัตริย์ ── */}
        {isGold && king && (
          <div>
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#B8860B',
                background: '#FFF6D8',
                border: '1.5px solid #E0B84A',
                borderRadius: radius.md,
                padding: '10px 14px',
                marginBottom: 14,
              }}
            >
              🪙 ช่องทอง — เรียนผ่าน AR เพื่อรับเหรียญกษัตริย์ของ {shortKing(king.name)} (เก็บครบ 7 พระองค์ชนะ!)
            </p>
            <ol style={{ fontSize: 18, lineHeight: 1.7, color: color.text, paddingLeft: 22, margin: '0 0 18px' }}>
              <li>ส่องกล้อง AR</li>
              <li>ดูคลิปวิดีโอ 15 วินาที</li>
              <li>ลากคำตอบที่ถูกไปวางในช่อง → รับเหรียญ!</li>
            </ol>
            <PrimaryButton onClick={() => setArGoldOpen(true)} label="📷 เริ่มบทเรียน AR" />
          </div>
        )}

        {/* ── ช่องคำถาม (เหลือง) ── */}
        {isQuizKind && quiz && (
          <div>
            {/* แถบจับเวลา */}
            {timerOn && answered === null && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    height: 8,
                    borderRadius: radius.pill,
                    background: '#eee',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(timeLeft / quiz.timeLimitSec) * 100}%`,
                      background: timeLeft <= 5 ? color.danger : color.secondary,
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
                <span style={{ fontSize: 16, color: color.textMuted }}>⏱️ {timeLeft} วินาที</span>
              </div>
            )}
            <p style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>❓ {quiz.question}</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isPortrait ? '1fr' : '1fr 1fr',
                gap: 12,
              }}
            >
              {quiz.choices.map((c, i) => {
                if (hidden.includes(i)) {
                  return <div key={i} style={{ minHeight: 56, opacity: 0.25 }} />;
                }
                const revealed = answered !== null;
                const bg = revealed
                  ? c.correct
                    ? color.success
                    : i === answered
                    ? color.danger
                    : '#Eee'
                  : color.bg;
                const fg = revealed && (c.correct || i === answered) ? '#fff' : color.text;
                return (
                  <button
                    key={i}
                    disabled={revealed}
                    onClick={() => setAnswered(i)}
                    style={{
                      fontFamily: 'inherit',
                      fontSize: 20,
                      textAlign: 'left',
                      padding: '16px 18px',
                      minHeight: 56,
                      borderRadius: radius.md,
                      border: `2px solid ${color.secondary}`,
                      background: bg,
                      color: fg,
                      cursor: revealed ? 'default' : 'pointer',
                    }}
                  >
                    {String.fromCharCode(65 + i)}. {c.text}
                  </button>
                );
              })}
            </div>

            {/* ปุ่มไอเทมช่วย (ก่อนตอบ) */}
            {answered === null && (items.fiftyFifty > 0 || items.skip > 0) && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                {items.fiftyFifty > 0 && hidden.length === 0 && (
                  <button
                    onClick={() => {
                      if (!useItem('fiftyFifty')) return;
                      const wrong = quiz.choices
                        .map((c, i) => (!c.correct ? i : -1))
                        .filter((i) => i >= 0);
                      // สุ่มตัดตัวเลือกผิด 2 ข้อ
                      setHidden(wrong.sort(() => Math.random() - 0.5).slice(0, 2));
                    }}
                    style={itemBtn}
                  >
                    ✂️ 50:50 ({items.fiftyFifty})
                  </button>
                )}
                {items.skip > 0 && (
                  <button
                    onClick={() => {
                      if (!useItem('skip')) return;
                      // ข้าม: ได้ครึ่งรางวัล แต่ไม่นับเป็น mastery ของพระองค์นั้น
                      resolveReward(Math.round(quiz.reward / 2));
                      closeEvent();
                    }}
                    style={itemBtn}
                  >
                    ⏭️ ข้ามคำถาม ({items.skip})
                  </button>
                )}
              </div>
            )}

            {answered !== null && (
              <div style={{ marginTop: 16 }}>
                {answered === -1 && (
                  <p style={{ fontSize: 18, fontWeight: 600, color: color.danger }}>⏱️ หมดเวลา!</p>
                )}
                <p style={{ fontSize: 18, color: color.textMuted, lineHeight: 1.55 }}>💡 {quiz.explanation}</p>
                <PrimaryButton
                  onClick={() => {
                    const correct = answered >= 0 && quiz.choices[answered].correct;
                    answerQuiz(correct, quiz.reward, correct ? kingId : null);
                    setAnswered(null);
                    closeEvent();
                  }}
                  label={
                    answered >= 0 && quiz.choices[answered].correct
                      ? `เยี่ยม! รับ 🪙 ${quiz.reward}`
                      : 'ไว้ลองใหม่นะ →'
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* ── ช่องความรู้ (ชมพู) — เก็บสะสมการ์ด 10 ใบ/คน + คำถามทวน ก/ข/ค/ง ── */}
        {kind === 'knowledge' && knowledge && (
          <div>
            <p
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#C2185B',
                background: '#FCE4EC',
                border: '1.5px solid #F48FB1',
                borderRadius: radius.md,
                padding: '6px 12px',
                marginBottom: 12,
              }}
            >
              💡 การ์ดความรู้ · เก็บแล้ว {Math.min(KNOWLEDGE_CAP, knowledgeCards.length)}/{KNOWLEDGE_CAP} ใบ
            </p>
            <p style={{ fontSize: 22, fontWeight: 600 }}>📖 {knowledge.title}</p>
            <p style={{ fontSize: 19, lineHeight: 1.65, color: color.text, margin: '12px 0 16px' }}>
              {knowledge.body}
            </p>
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>ทวนจำ: {knowledge.question}</p>
                {knowledgeAnswer === null && (
                  <button onClick={rerollKnowledge} style={itemBtn}>
                    🎲 สุ่มใหม่
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {knowledge.choices.map((choice, i) => {
                  const revealed = knowledgeAnswer !== null;
                  const bg = revealed
                    ? choice.correct
                      ? color.success
                      : i === knowledgeAnswer
                      ? color.danger
                      : color.bg
                    : color.bg;
                  const fg = revealed && (choice.correct || i === knowledgeAnswer) ? '#fff' : color.text;
                  return (
                    <button
                      key={i}
                      disabled={revealed}
                      onClick={() => setKnowledgeAnswer(i)}
                      style={{
                        fontFamily: 'inherit',
                        fontSize: 19,
                        textAlign: 'left',
                        padding: '14px 16px',
                        minHeight: 52,
                        borderRadius: radius.md,
                        border: `2px solid ${color.secondary}`,
                        background: bg,
                        color: fg,
                        cursor: revealed ? 'default' : 'pointer',
                      }}
                    >
                      {THAI_CHOICE[i]}. {choice.text}
                    </button>
                  );
                })}
              </div>

              {knowledgeAnswer !== null &&
                (knowledge.choices[knowledgeAnswer]?.correct ? (
                  <PrimaryButton
                    onClick={() => {
                      collectKnowledge(knowledge.id, knowledge.kingId, 30);
                      closeEvent();
                    }}
                    label={`เก็บการ์ดความรู้! รับ 🪙 30 →`}
                  />
                ) : (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 18, color: color.danger, fontWeight: 700 }}>
                      ยังไม่ใช่ ลองอ่านเกร็ดด้านบนอีกครั้ง
                    </p>
                    <button onClick={() => setKnowledgeAnswer(null)} style={itemBtn}>
                      ลองตอบใหม่
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── ช่องภารกิจ (ฟ้า) — โจทย์ปรนัย ก/ข/ค/ง ── */}
        {kind === 'mission' && mission && (
          <div>
            <p
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: color.info,
                background: '#E3F2FD',
                border: `1.5px solid ${color.info}55`,
                borderRadius: radius.md,
                padding: '6px 12px',
                marginBottom: 12,
              }}
            >
              🎯 การ์ดภารกิจ · ตอบให้ถูกเพื่อรับเหรียญ
            </p>
            <p style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>❓ {mission.question}</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isPortrait ? '1fr' : '1fr 1fr',
                gap: 12,
              }}
            >
              {mission.choices.map((c, i) => {
                const revealed = missionAnswer !== null;
                const bg = revealed
                  ? c.correct
                    ? color.success
                    : i === missionAnswer
                    ? color.danger
                    : '#Eee'
                  : color.bg;
                const fg = revealed && (c.correct || i === missionAnswer) ? '#fff' : color.text;
                return (
                  <button
                    key={i}
                    disabled={revealed}
                    onClick={() => setMissionAnswer(i)}
                    style={{
                      fontFamily: 'inherit',
                      fontSize: 20,
                      textAlign: 'left',
                      padding: '16px 18px',
                      minHeight: 56,
                      borderRadius: radius.md,
                      border: `2px solid ${color.secondary}`,
                      background: bg,
                      color: fg,
                      cursor: revealed ? 'default' : 'pointer',
                    }}
                  >
                    {THAI_CHOICE[i]}. {c.text}
                  </button>
                );
              })}
            </div>

            {missionAnswer !== null && (
              <PrimaryButton
                onClick={() => {
                  const correct = mission.choices[missionAnswer]?.correct ?? false;
                  if (correct) completeLessonStep(kingId, 'mission', mission.reward);
                  else resolveReward(0);
                  closeEvent();
                }}
                label={
                  mission.choices[missionAnswer]?.correct
                    ? `ถูกต้อง! รับ 🪙 ${mission.reward} →`
                    : 'ยังไม่ถูก ไปต่อ →'
                }
              />
            )}
          </div>
        )}

        {/* ── ช่องโชค ── */}
        {kind === 'chance' && chance && (
          <div>
            <p style={{ fontSize: 22, fontWeight: 600 }}>🎲 {chance.title}</p>
            <p style={{ fontSize: 19, margin: '10px 0 20px', lineHeight: 1.55 }}>{chance.body}</p>
            <PrimaryButton
              onClick={() => {
                applyChance(chance.move, chance.coin);
                if (chance.item) giveItem(chance.item); // ได้ไอเทมพาวเวอร์อัพ
                closeEvent();
              }}
              label="รับผลการ์ดโชค →"
            />
          </div>
        )}

        {/* ── ช่องโบนัส (เขียว) — ได้เหรียญ + ไอเทม แล้วต่อด้วยทางแยก ── */}
        {kind === 'bonus' && (
          <div>
            <p style={{ fontSize: 22, fontWeight: 600 }}>🎁 ได้รับโบนัสพิเศษ!</p>
            <p style={{ fontSize: 19, margin: '10px 0 20px', lineHeight: 1.55, color: color.textMuted }}>
              รับ 🪙 80 เหรียญ พร้อมไอเทมช่วยเล่น 1 ชิ้น — ก้าวต่อไปจะได้เลือกเส้นทางเอง
            </p>
            <PrimaryButton
              onClick={() => {
                resolveReward(80);
                const pool: Array<'fiftyFifty' | 'skip' | 'double'> = ['fiftyFifty', 'skip', 'double'];
                giveItem(pool[Math.floor(Math.random() * pool.length)]);
                closeEvent();
              }}
              label="รับโบนัส 🪙 80 + ไอเทม →"
            />
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// ตัดพระนามยาวให้พอดีปุ่ม (เอาส่วนก่อนวงเล็บ)
function shortKing(name: string): string {
  return name.split('(')[0].trim();
}

const itemBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 17,
  fontWeight: 700,
  padding: '10px 16px',
  minHeight: 46,
  borderRadius: radius.pill,
  border: `2px solid ${color.info}`,
  background: '#E3F2FD',
  color: color.info,
  cursor: 'pointer',
};

function PrimaryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'inherit',
        marginTop: 8,
        width: '100%',
        fontSize: 20,
        fontWeight: 700,
        color: '#fff',
        background: color.primary,
        border: 'none',
        borderRadius: radius.pill,
        padding: '16px',
        minHeight: 56,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
