import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '@/core/store';
import {
  getKing,
  getGoldQuizForKing,
  getQuizForKing,
  getSubjectQuizForKing,
  getRandomKnowledge,
  subjectLabel,
  KNOWLEDGE_CAP,
} from '@/core/content';
import { color, radius, difficultyMeta } from '@/theme/tokens';
import { ARGoldChallenge } from './ARGoldChallenge';
import { CardPicker } from './CardPicker';
import { CardFrame } from './CardFrame';
import { QuestionImage } from './QuestionImage';
import { QrChallengePanel } from './QrChallengePanel';
import { ResultStamp, STAMP_MS } from './ResultStamp';
import { buildGoldArChallenge, buildQuizChallenge, genChallengeId } from '@/core/qrChallenge';
import { getCardFront } from '@/core/cardAssets';
import { sfx } from '@/core/sfx';
import type { Orientation, KnowledgeCard, SubjectQuizCard, TileEvent } from '@/core/types';

// เอฟเฟกต์ตอนเฉลยคำถาม (แบนเนอร์เด้ง/ปุ่มถูกเด้ง/ปุ่มผิดสั่น/กระดาษหลากสีร่วง)
const QUIZ_FX = `
@keyframes quizBanner{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
@keyframes quizBounce{0%,100%{transform:translateY(0) scale(1)}30%{transform:translateY(-8px) scale(1.18)}60%{transform:translateY(0) scale(1)}}
@keyframes quizShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes quizPop{0%{transform:scale(1)}45%{transform:scale(1.05)}100%{transform:scale(1.02)}}
@keyframes confettiFall{0%{opacity:0;transform:translateY(-12px) rotate(0)}20%{opacity:1}100%{opacity:0;transform:translateY(96px) rotate(220deg)}}
`;

// Modal การ์ดรวม (question / goldking / knowledge / penalty / bonus)
// แนวตั้ง = เด้งจากล่าง (bottom sheet), แนวนอน = กลางจอ (center dialog)
export function CardModal({ orientation }: { orientation: Orientation }) {
  const event = useGame((s) => s.pendingEvent);
  const resolveReward = useGame((s) => s.resolveReward);
  const answerQuiz = useGame((s) => s.answerQuiz);
  const answerKingCoin = useGame((s) => s.answerKingCoin);
  const collectKnowledge = useGame((s) => s.collectKnowledge);
  const knowledgeCards = useGame((s) => s.players[s.currentPlayerIndex]?.knowledgeCards ?? []);
  const applyPenalty = useGame((s) => s.applyPenalty);
  const giveItem = useGame((s) => s.giveItem);
  const useItem = useGame((s) => s.useItem);
  const items = useGame((s) => s.items);
  const closeEvent = useGame((s) => s.closeEvent);
  const settings = useGame((s) => s.settings);
  const usedQuizIds = useGame((s) => s.usedQuizIds);
  const markQuizSeen = useGame((s) => s.markQuizSeen);
  const currentHearts = useGame((s) => s.players[s.currentPlayerIndex]?.hearts ?? 3);
  const [answered, setAnswered] = useState<number | null>(null);
  // ตราประทับผลลัพธ์กลางจอ — เก็บ `id` ที่เพิ่มขึ้นทุกครั้งด้วย ไม่ใช่แค่ชนิด
  // เพราะถ้าเก็บแค่ 'correct'/'wrong' แล้วตอบถูกสองใบติดกัน setStamp('correct') จะได้ค่าเดิม
  // → React bail out ไม่ re-render → element ไม่ remount → **อนิเมชันไม่เล่นซ้ำ ตราไม่ขึ้นเลย**
  // (เจอจริงตอนรีวิว: วัดได้ opacity ค้าง 0) · `id` ใช้เป็น key บังคับ remount ทุกครั้งที่ตอบ
  const [stamp, setStamp] = useState<{ id: number; kind: 'correct' | 'wrong' } | null>(null);
  const stampSeq = useRef(0);
  // timer หน่วงปิดการ์ดโหมด QR ให้ตราประทับเล่นจบ — ต้องเก็บไว้เคลียร์
  // ไม่งั้นถ้าการ์ดถูกปิดด้วยทางอื่นก่อน timer จะไปสั่ง closeEvent ทับ "การ์ดใบถัดไป"
  const qrCloseRef = useRef<number | null>(null);
  const clearQrClose = () => {
    if (qrCloseRef.current !== null) {
      window.clearTimeout(qrCloseRef.current);
      qrCloseRef.current = null;
    }
  };
  useEffect(() => clearQrClose, []);
  const [hidden, setHidden] = useState<number[]>([]); // ตัวเลือกที่ 50:50 ตัดออก
  const [arGoldOpen, setArGoldOpen] = useState(false);
  // เก็บ "event ที่จั่วเลือกใบไปแล้ว" แทน boolean — event ใหม่ย่อม !== ตัวนี้เสมอ ด่านจั่วจึงโผล่ทุกใบ
  // (เลี่ยง boolean ที่ต้องรีเซ็ตเองซึ่งค้างได้ ทำให้การ์ดใบต่อ ๆ ไปข้ามด่านจั่ว)
  const [pickedEvent, setPickedEvent] = useState<TileEvent | null>(null);
  const picked = !!event && pickedEvent === event;

  const kind = event?.kind;
  const kingId = event?.tile.kingId ?? null;
  const king = getKing(kingId);
  const isGold = kind === 'goldking'; // ช่องทอง — บทเรียนผ่าน AR (วิดีโอ + ลากคำตอบ)
  const isQuizKind = kind === 'question'; // เฉพาะช่องฟ้าที่ใช้ UI ควิซปกติ
  const isSubject = kind === 'subject'; // ช่องกลุ่มสาระฯ ใช้ UI ควิซเดียวกับช่องฟ้า แต่คัดจากคลังสาระ
  const usesQuizUI = isQuizKind || isSubject; // ทั้งสองใช้จอควิซ + จับเวลา + ไอเทมชุดเดียวกัน
  // โหมด QR: ช่องฟ้า/สาระ → โชว์ QR ให้ตอบบนมือถือส่วนตัวแทน UI ควิซบน tablet (ไม่มีตัวจับเวลา)
  const qrMode = settings.qrAnswerMode && usesQuizUI;

  // ช่องทองก็ต้องมีคำถาม (ใช้กับ drag-to-slot ใน AR) จึงสุ่ม quiz ไว้ด้วย
  const quiz = useMemo(
    () =>
      kind === 'question'
        ? getQuizForKing(kingId, settings.difficulty, usedQuizIds)
        : isGold
        ? getGoldQuizForKing(kingId, settings.difficulty, usedQuizIds)
        : isSubject
        ? getSubjectQuizForKing(kingId, settings.difficulty, usedQuizIds)
        : null,
    [event]
  );
  const subjectName = isSubject && quiz ? subjectLabel((quiz as SubjectQuizCard).subject) : '';
  // payload สำหรับโหมด QR — memo ให้ reference นิ่ง (ไม่งั้น QR วาดใหม่ทุก render)
  const qrLabel = isSubject ? subjectName : king ? shortKing(king.name) : undefined;
  const qrChallenge = useMemo(
    () =>
      qrMode && quiz
        ? buildQuizChallenge(quiz, qrLabel, genChallengeId(), settings.timerEnabled ? quiz.timeLimitSec : undefined)
        : null,
    [quiz, qrMode, qrLabel, settings.timerEnabled]
  );
  const goldArChallenge = useMemo(
    () => (settings.qrAnswerMode && isGold && king && quiz ? buildGoldArChallenge(king, quiz, genChallengeId()) : null),
    [isGold, king, quiz, settings.qrAnswerMode]
  );
  const penalty = kind === 'penalty' ? event?.tile.penalty ?? null : null;

  // การ์ดความรู้ = สุ่มใบที่ยังไม่มี 1 ใบต่อการลงช่อง (ไม่มีปุ่มสุ่มใหม่แล้ว)
  const [knowledge, setKnowledge] = useState<KnowledgeCard | null>(null);
  useEffect(() => {
    setKnowledge(kind === 'knowledge' ? getRandomKnowledge(knowledgeCards) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  // ── ตัวจับเวลาคำถาม (เปิด/ปิดได้ใน Teacher Mode; หมดเวลา = เฉลยอัตโนมัติ) ──
  const timerOn = settings.timerEnabled;
  const [timeLeft, setTimeLeft] = useState<number>(0);
  useEffect(() => {
    if (!usesQuizUI || !quiz) return;
    markQuizSeen(quiz.id);
    setTimeLeft(quiz.timeLimitSec);
    setAnswered(null);
    setHidden([]);
  }, [event]);
  useEffect(() => {
    setArGoldOpen(false);
    // ต้องเคลียร์ตราประทับตอนเปลี่ยนการ์ดด้วย — ถ้าผู้เล่นกด "เดินเกมต่อ" ภายใน STAMP_MS
    // (ซึ่งเป็นเรื่องปกติ เพราะปุ่มอยู่ตรงนั้น) `answered` จะกลับเป็น null → cleanup ของ effect
    // ไปยกเลิก timer ที่จะเคลียร์ตรา → ตราค้างข้ามการ์ด
    setStamp(null);
    clearQrClose(); // การ์ดเปลี่ยนแล้ว timer ปิดของใบเก่าต้องไม่ไปปิดใบใหม่
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  useEffect(() => {
    if (qrMode || !picked || !timerOn || !usesQuizUI || answered !== null || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, answered, kind, timerOn, picked, qrMode]);
  // หมดเวลา → บังคับเฉลย (นับเป็นตอบผิด: index -1) — เฉพาะหลังจั่วการ์ดแล้ว (ไม่ทำในโหมด QR)
  useEffect(() => {
    if (!qrMode && picked && timerOn && usesQuizUI && timeLeft === 0 && answered === null && quiz) {
      setAnswered(-1);
    }
  }, [timeLeft, timerOn, picked, qrMode]);
  // เด้งตราประทับ + เสียง — ใช้ร่วมกันทั้งโหมดตอบบน tablet และโหมดตอบผ่านมือถือ (QR)
  const showResult = (correct: boolean) => {
    if (correct) sfx.correct();
    else sfx.wrong();
    stampSeq.current += 1;
    setStamp({ id: stampSeq.current, kind: correct ? 'correct' : 'wrong' });
  };

  // ── ฟีดแบ็กทันทีตอนเฉลย (โหมดตอบบน tablet) ──
  useEffect(() => {
    if (!usesQuizUI || answered === null) return;
    showResult(answered >= 0 && !!quiz?.choices[answered]?.correct);
    const t = setTimeout(() => setStamp(null), STAMP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered]);

  // แบนเนอร์ผลลัพธ์ + ปุ่มเดินเกมต่อถูกวาง "ต่อท้ายปุ่มคำตอบ" ในกล่องที่ maxHeight 88vh + overflow:auto
  // → บนแท็บเล็ตแนวนอนจอเตี้ย (วัดจริงที่ 1024x640) ปุ่ม "รับเหรียญ →" ตกใต้ขอบกล่อง 164px
  // และ scrollTop ค้างที่ 0 = เด็กตอบแล้วเห็นแต่แบนเนอร์ ไม่เห็นปุ่ม เกมเหมือนค้าง
  // (ปุ่มนี้เป็นทางเดียวที่เรียก answerQuiz) → เลื่อนผลลัพธ์เข้ามาในสายตาให้เอง
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (answered === null) return;
    const el = resultRef.current;
    if (!el) return;
    // รอ 1 เฟรมให้ layout ของแบนเนอร์ (ที่เพิ่งโผล่) นิ่งก่อนค่อยวัดตำแหน่ง
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'end',
      });
    });
    return () => cancelAnimationFrame(id);
  }, [answered]);

  if (!event) return null;
  // ช่องร้านค้าเปิด ShopModal แยก (ใน layout) ไม่ใช่การ์ด — CardModal ไม่ต้องเรนเดอร์ (กันเงา overlay เปล่า)
  if (kind === 'shop') return null;

  // การ์ด 4 ชนิดนี้ต้อง "จั่วเลือกใบ" ก่อนเปิดเนื้อหา (คำถาม/สาระ/ความรู้/ทอง AR)
  // ช่องทำโทษ/โบนัสไม่ใช่การ์ดสะสม → เปิดตรง ๆ เหมือนเดิม
  const needsDraw = kind === 'question' || kind === 'subject' || kind === 'knowledge' || kind === 'goldking';

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
  return (
    <>
      {/* ── ตราประทับผลลัพธ์ — เด้งกลางจอทันทีที่กดตอบ ──
          จงใจเป็น position:fixed ทับทั้งจอ (ไม่ได้อยู่ในกล่องการ์ดที่เลื่อนได้)
          เพราะฟีดแบ็กต้องเห็นแน่นอนไม่ว่าเด็กจะเลื่อนการ์ดค้างไว้ตรงไหน · pointerEvents:none
          เพื่อไม่บังการกดปุ่ม แล้วจางหายเองใน 1.1 วิ */}
      {/* key = id ที่เพิ่มทุกครั้งที่ตอบ → บังคับ remount ให้อนิเมชันเล่นใหม่เสมอ
          แม้ตอบถูกติดกันหลายใบ (ชนิดเดิม) ก็ยังเด้งทุกครั้ง */}
      {stamp && <ResultStamp key={stamp.id} kind={stamp.kind} />}

      {/* บทเรียน AR ช่องทอง (เต็มจอ) — ทับการ์ดปกติ */}
      {arGoldOpen && isGold && king && quiz && (
        <ARGoldChallenge
          king={king}
          quiz={quiz}
          useCamera={settings.arEnabled}
          cardMode={settings.arCardMode}
          onDone={(correct) => {
            setArGoldOpen(false);
            answerKingCoin(correct, kingId!);
            closeEvent();
          }}
          onCancel={() => {
            // ถอนตัวก่อนตอบ — ไม่ได้เหรียญ + ไม่เสียหัวใจ แค่จบเทิร์น
            setArGoldOpen(false);
            closeEvent();
          }}
        />
      )}
    {needsDraw && !picked ? (
      <CardPicker kind={kind as 'question' | 'subject' | 'knowledge' | 'goldking'} onPicked={() => setPickedEvent(event)} />
    ) : (
    <div style={shell}>
        {/* ── ช่องทอง (AR เท่านั้น) — เข้าสู่บทเรียน AR เพื่อรับเหรียญกษัตริย์ ── */}
        {isGold && king && (
          <CardFrame
            kind="goldking"
            title="ชิงเหรียญกษัตริย์"
            subtitle={shortKing(king.name)}
            icon="🪙"
            bannerFrom="#E8B84B"
            bannerTo="#B8860B"
            orientation={orientation}
            skipBackFlip
          >
          {goldArChallenge ? (
            <QrChallengePanel
              challenge={goldArChallenge}
              variant="gold-ar"
              onResult={(correct) => {
                answerKingCoin(correct, kingId!);
                closeEvent();
              }}
              onCancel={closeEvent}
            />
          ) : (
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
          </CardFrame>
        )}

        {/* ── ช่องคำถาม (ฟ้า) + ช่องกลุ่มสาระฯ (เขียวหัวเป็ด) — ใช้จอควิซเดียวกัน ── */}
        {usesQuizUI && quiz && (
          <CardFrame
            kind={kind!}
            title={isSubject ? 'สาระการเรียนรู้' : 'การ์ดคำถาม'}
            subtitle={king ? shortKing(king.name) : undefined}
            icon={isSubject ? '📚' : '❓'}
            bannerFrom={isSubject ? '#26A69A' : '#1E88E5'}
            bannerTo={isSubject ? '#00695C' : '#0D47A1'}
            orientation={orientation}
            skipBackFlip
          >
          {qrMode && qrChallenge ? (
            <QrChallengePanel
              challenge={qrChallenge}
              onResult={(ok) => {
                // โหมด QR ไม่เคยเซ็ต `answered` (มือถือเป็นคนตอบ) → effect ตราประทับไม่ทำงาน
                // ต้องเด้งเอง ไม่งั้นจอกลางไม่บอกอะไรเลย การ์ดปิดไปเฉย ๆ
                showResult(ok);
                answerQuiz(ok, quiz.reward);
                // หน่วงปิดการ์ดให้ตราเล่นจบก่อน — closeEvent ทำให้ event=null แล้ว CardModal
                // return null ทั้งก้อน (ตราอยู่ในนั้น) ถ้าปิดทันทีตราจะหายในเสี้ยววินาที
                qrCloseRef.current = window.setTimeout(closeEvent, STAMP_MS);
              }}
            />
          ) : (
          <div>
            {/* แถวป้ายบอกบริบทคำถาม: ระดับความยาก (+ วิชา ถ้าเป็นช่องสาระ) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <DifficultyBadge difficulty={quiz.difficulty} />
              {/* ป้ายวิชา (เฉพาะช่องกลุ่มสาระฯ) — บอกว่าสุ่มได้วิชาอะไร */}
              {isSubject && <div style={{ ...subjectChip, marginBottom: 0 }}>📚 กลุ่มสาระ · {subjectName}</div>}
            </div>
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
            <QuestionImage url={quiz.imageUrl} />
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
                      border: `2px solid ${revealed && c.correct ? color.success : color.secondary}`,
                      background: bg,
                      color: fg,
                      cursor: revealed ? 'default' : 'pointer',
                      transition: 'background .2s, box-shadow .2s',
                      boxShadow: revealed && c.correct ? `0 0 0 4px ${color.success}44` : 'none',
                      animation: revealed
                        ? c.correct
                          ? 'quizPop .5s ease'
                          : i === answered
                          ? 'quizShake .4s ease'
                          : undefined
                        : undefined,
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

            {answered !== null &&
              (() => {
                const correct = answered >= 0 && !!quiz.choices[answered].correct;
                const correctText = quiz.choices.find((c) => c.correct)?.text ?? '';
                return (
                  // scrollMarginBottom = ระยะหายใจใต้ปุ่มตอน scrollIntoView(block:'end')
                  // ไม่งั้นปุ่มไปแปะขอบล่างพอดีเป๊ะ (เสี่ยงโดนตัดเศษพิกเซล + ดูอึดอัด)
                  <div ref={resultRef} style={{ marginTop: 16, scrollMarginBottom: 14 }}>
                    {/* แบนเนอร์ผลลัพธ์ — บอกทันทีว่าถูกหรือผิด + ฉลองเมื่อถูก */}
                    <div
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 16px',
                        borderRadius: radius.md,
                        marginBottom: 14,
                        color: '#fff',
                        background: correct
                          ? 'linear-gradient(135deg,#2FA84A,#1B7A34)'
                          : 'linear-gradient(135deg,#E4572E,#B02020)',
                        boxShadow: correct
                          ? '0 6px 18px rgba(31,122,52,.4)'
                          : '0 6px 18px rgba(176,32,32,.32)',
                        animation: 'quizBanner .45s cubic-bezier(.2,1.3,.5,1) both',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 34,
                          lineHeight: 1,
                          animation: correct ? 'quizBounce .6s ease' : 'quizShake .45s ease',
                        }}
                      >
                        {correct ? '🎉' : answered === -1 ? '⏱️' : '💪'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>
                          {correct ? 'ถูกต้อง! เก่งมาก' : answered === -1 ? 'หมดเวลา!' : 'ยังไม่ถูกนะ'}
                        </div>
                        <div style={{ fontSize: 14.5, fontWeight: 600, opacity: 0.96 }}>
                          {correct ? `ได้เหรียญ 🪙 ${quiz.reward}` : `คำตอบที่ถูกคือ: ${correctText}`}
                        </div>
                      </div>
                      {/* กระดาษหลากสีร่วงลงมา — เฉพาะตอนตอบถูก */}
                      {correct &&
                        ['🎊', '⭐', '✨', '🌟', '🎉', '⭐', '✨'].map((e, i) => (
                          <span
                            key={i}
                            style={{
                              position: 'absolute',
                              top: -16,
                              left: `${8 + i * 13}%`,
                              fontSize: 16,
                              pointerEvents: 'none',
                              animation: `confettiFall ${1 + (i % 3) * 0.25}s ease-in ${i * 0.06}s both`,
                            }}
                          >
                            {e}
                          </span>
                        ))}
                    </div>
                    {/* คำอธิบายโชว์เฉพาะตอนตอบถูก · ตอบผิดโชว์แค่ "คำตอบที่ถูก" ในแบนเนอร์ */}
                    {correct && (
                      <p style={{ fontSize: 18, color: color.textMuted, lineHeight: 1.55 }}>💡 {quiz.explanation}</p>
                    )}
                    <PrimaryButton
                      onClick={() => {
                        answerQuiz(correct, quiz.reward);
                        setAnswered(null);
                        closeEvent();
                      }}
                      label={
                        correct
                          ? `เยี่ยม! รับ 🪙 ${quiz.reward} →`
                          : currentHearts <= 1
                          ? 'เสีย ❤️ และพักฟื้น 1 เทิร์น →'
                          : 'เสีย ❤️ ไว้ลองใหม่นะ →'
                      }
                    />
                    <style>{QUIZ_FX}</style>
                  </div>
                );
              })()}
          </div>
          )}
          </CardFrame>
        )}

        {/* ── ช่องความรู้ (ชมพู) — ใช้ "รูปหน้าการ์ดจริง" เป็นพื้น + วางข้อความทับในกรอบ ── */}
        {kind === 'knowledge' && knowledge && (
          <CardFrame
            kind="knowledge"
            title="การ์ดความรู้"
            icon="💡"
            bannerFrom="#EC407A"
            bannerTo="#C2185B"
            orientation={orientation}
            artFront={getCardFront('knowledge')}
            artRatio="722 / 1019"
            contentInset={{ top: 20, right: 12, bottom: 9, left: 12 }}
            skipBackFlip
          >
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
            {/* อ่านเกร็ดแล้วเก็บได้เลย — ไม่มีคำถามทบทวน ไม่มีสุ่มใหม่ */}
            <PrimaryButton
              onClick={() => {
                collectKnowledge(knowledge.id, 30);
                closeEvent();
              }}
              label="เก็บการ์ดความรู้! รับ 🪙 30 →"
            />
          </div>
          </CardFrame>
        )}

        {/* ── ช่องทำโทษ (แดง) — ถอยหลัง หรือ หยุดพัก 1 ตา ── */}
        {kind === 'penalty' && penalty && (
          <CardFrame
            kind="penalty"
            title="ช่องทำโทษ"
            icon="⛓️"
            bannerFrom="#D32F2F"
            bannerTo="#8E2020"
            orientation={orientation}
          >
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: color.danger }}>
              {penalty.type === 'back' ? '⛓️ โดนสั่งถอย!' : '💤 โดนสั่งพัก!'}
            </p>
            <p style={{ fontSize: 19, margin: '10px 0 20px', lineHeight: 1.55 }}>
              {penalty.type === 'back'
                ? `โชคร้าย! ต้องเดินย้อนกลับ ${penalty.steps} ช่อง`
                : `โชคร้าย! ต้องหยุดพัก ${penalty.steps} ตา (อดเล่นเทิร์นถัดไป)`}
            </p>
            <PrimaryButton
              onClick={() => {
                applyPenalty(
                  penalty.type === 'back' ? penalty.steps : 0,
                  penalty.type === 'skip' ? penalty.steps : 0
                );
                closeEvent();
              }}
              label="ยอมรับกรรม 😵 →"
            />
          </div>
          </CardFrame>
        )}

        {/* ── ช่องโบนัส (เขียว) — ได้เหรียญ + ไอเทม แล้วต่อด้วยทางแยก ── */}
        {kind === 'bonus' && (
          <CardFrame
            kind="bonus"
            title="การ์ดโบนัส"
            icon="🎁"
            bannerFrom="#43A047"
            bannerTo="#2E7D32"
            orientation={orientation}
          >
          <div>
            <p style={{ fontSize: 22, fontWeight: 600 }}>🎁 ได้รับโบนัสพิเศษ!</p>
            <p style={{ fontSize: 19, margin: '10px 0 20px', lineHeight: 1.55, color: color.textMuted }}>
              รับ 🪙 80 เหรียญ พร้อมไอเทมช่วยเล่น 1 ชิ้น — ก้าวต่อไปจะได้เลือกเส้นทางเอง
            </p>
            <PrimaryButton
              onClick={() => {
                resolveReward(80);
                const pool: Array<'fiftyFifty' | 'skip' | 'double' | 'heartPotion'> = [
                  'fiftyFifty',
                  'skip',
                  'double',
                  'heartPotion',
                ];
                giveItem(pool[Math.floor(Math.random() * pool.length)]);
                closeEvent();
              }}
              label="รับโบนัส 🪙 80 + ไอเทม →"
            />
          </div>
          </CardFrame>
        )}
    </div>
    )}
    </>
  );
}

// ตัดพระนามยาวให้พอดีปุ่ม (เอาส่วนก่อนวงเล็บ)
function shortKing(name: string): string {
  return name.split('(')[0].trim();
}

// ป้ายระดับความยากของคำถาม — สีตาม difficultyMeta ให้ผู้เล่นรู้ทันทีว่ากำลังเจอคำถามระดับไหน
function DifficultyBadge({ difficulty }: { difficulty: 'easy' | 'medium' | 'hard' }) {
  const m = difficultyMeta[difficulty];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 15,
        fontWeight: 800,
        color: m.color,
        background: m.bg,
        border: `1.5px solid ${m.border}`,
        borderRadius: radius.pill,
        padding: '5px 12px',
      }}
    >
      {m.icon} ระดับ{m.label}
    </span>
  );
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

// ป้ายบอกวิชาของช่องกลุ่มสาระฯ (โทน teal ให้ตรงกับสีช่องบนกระดาน)
const subjectChip: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 15,
  fontWeight: 800,
  color: '#00695C',
  background: '#E0F2F1',
  border: '1.5px solid #4DB6AC',
  borderRadius: radius.pill,
  padding: '5px 12px',
  marginBottom: 12,
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
