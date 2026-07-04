import { useMemo, useState } from 'react';
import { useGame } from '@/core/store';
import { KINGS } from '@/core/content';
import { color, radius, elevation } from '@/theme/tokens';
import type { DailyQuest, LessonProgress } from '@/core/types';

function score(progress?: LessonProgress): number {
  if (!progress) return 0;
  return [progress.knowledge, progress.quiz, progress.mission].filter(Boolean).length;
}

function totalStars(progress: Record<string, LessonProgress> = {}): number {
  return Object.values(progress).reduce((sum, p) => sum + score(p), 0);
}

function questValue(quest: DailyQuest, coins: number, unlocked: number, stars: number): number {
  if (quest.kind === 'coins') return coins;
  if (quest.kind === 'unlocks') return unlocked;
  return stars;
}

export function QuestPanel() {
  const player = useGame((s) => s.players[s.currentPlayerIndex]);
  const quest = useGame((s) => s.dailyQuest);
  const bossCleared = useGame((s) => s.bossCleared);
  const [bossOpen, setBossOpen] = useState(false);

  const stars = totalStars(player?.lessonProgress);
  const unlocked = player?.unlockedKings.length ?? 0;
  const value = Math.min(quest.target, questValue(quest, player?.coins ?? 0, unlocked, stars));
  const questDone = value >= quest.target;
  const bossReady = stars >= 9 && !bossCleared;

  return (
    <div
      style={{
        background: 'linear-gradient(160deg, #FFFDF8, #F3E7CF)',
        borderRadius: radius.lg,
        border: `1.5px solid ${color.secondary}55`,
        boxShadow: '0 8px 20px rgba(90,60,20,.18), inset 0 1px 0 #fff',
        padding: 12,
        display: 'grid',
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: color.primary }}>
          🎯 {quest.title}
        </div>
        <div style={{ fontSize: 15, color: color.textMuted }}>{quest.description}</div>
        <div style={{ height: 8, background: '#00000012', borderRadius: radius.pill, marginTop: 8 }}>
          <div
            style={{
              height: '100%',
              width: `${(value / quest.target) * 100}%`,
              background: questDone ? color.success : color.secondary,
              borderRadius: radius.pill,
              transition: 'width .3s',
            }}
          />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: questDone ? color.success : color.textMuted, marginTop: 4 }}>
          {questDone ? 'สำเร็จแล้ว' : `${value}/${quest.target}`}
        </div>
      </div>

      <button
        disabled={!bossReady}
        onClick={() => setBossOpen(true)}
        style={{
          fontFamily: 'inherit',
          minHeight: 44,
          border: 'none',
          borderRadius: radius.pill,
          background: bossCleared ? color.success : bossReady ? color.primary : '#D8CDBD',
          color: '#fff',
          fontSize: 16,
          fontWeight: 800,
          cursor: bossReady ? 'pointer' : 'default',
        }}
      >
        {bossCleared ? '🏆 ผ่านบอสทบทวนแล้ว' : bossReady ? '⚔️ เข้าด่านบอสทบทวน' : `⭐ บอสเปิดที่ 9 ดาว (${stars}/9)`}
      </button>

      {bossOpen && <BossReviewModal onClose={() => setBossOpen(false)} />}
    </div>
  );
}

function BossReviewModal({ onClose }: { onClose: () => void }) {
  const completeBossReview = useGame((s) => s.completeBossReview);
  const player = useGame((s) => s.players[s.currentPlayerIndex]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const questions = useMemo(() => {
    const learned = KINGS.filter((k) => score(player?.lessonProgress?.[k.id]) > 0);
    const source = learned.length >= 3 ? learned : KINGS;
    return source.slice(0, 3).map((king) => {
      const correct = king.achievements[0];
      const choices = [correct, ...KINGS.filter((k) => k.id !== king.id).map((k) => k.achievements[0]).slice(0, 2)]
        .sort(() => Math.random() - 0.5)
        .map((text) => ({ text, correct: text === correct }));
      return { king, choices };
    });
  }, [player?.unlockedKings.length]);

  const correctCount = questions.filter((q, i) => q.choices[answers[i]]?.correct).length;
  const passed = correctCount >= questions.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 140,
        padding: 20,
      }}
    >
      <div
        style={{
          width: 'min(760px, 94vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: color.surface,
          borderRadius: radius.lg,
          boxShadow: elevation.modal,
          padding: 24,
        }}
      >
        <h2 style={{ margin: '0 0 8px', color: color.primary, fontSize: 28 }}>⚔️ บอสทบทวนความจำ</h2>
        <p style={{ margin: '0 0 18px', color: color.textMuted, fontSize: 18 }}>
          ตอบให้ครบ 3 ข้อเพื่อรับเหรียญโบนัสและป้ายผ่านด่าน
        </p>

        <div style={{ display: 'grid', gap: 18 }}>
          {questions.map((q, qi) => (
            <div key={q.king.id} style={{ background: color.bg, borderRadius: radius.md, padding: 14 }}>
              <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 10 }}>
                {qi + 1}. ข้อใดเกี่ยวข้องกับ {q.king.name.split('(')[0].trim()}?
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {q.choices.map((choice, ci) => {
                  const picked = answers[qi] === ci;
                  const reveal = submitted;
                  const bg = reveal
                    ? choice.correct
                      ? color.success
                      : picked
                      ? color.danger
                      : '#fff'
                    : picked
                    ? color.secondary
                    : '#fff';
                  return (
                    <button
                      key={choice.text}
                      disabled={submitted}
                      onClick={() => setAnswers((s) => ({ ...s, [qi]: ci }))}
                      style={{
                        fontFamily: 'inherit',
                        textAlign: 'left',
                        fontSize: 18,
                        padding: '12px 14px',
                        borderRadius: radius.md,
                        border: `2px solid ${color.secondary}`,
                        background: bg,
                        color: picked || (reveal && choice.correct) ? '#fff' : color.text,
                        cursor: submitted ? 'default' : 'pointer',
                      }}
                    >
                      {choice.text}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {submitted && (
          <p style={{ fontSize: 20, fontWeight: 800, color: passed ? color.success : color.danger }}>
            {passed ? 'ผ่านบอสทบทวน! รับ 180 เหรียญ' : `ถูก ${correctCount}/3 ข้อ ลองกลับไปทบทวนในพิพิธภัณฑ์ก่อน`}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <button
            onClick={() => {
              if (!submitted) {
                setSubmitted(true);
                return;
              }
              completeBossReview(passed);
              onClose();
            }}
            style={primaryBtn}
          >
            {submitted ? 'กลับเข้าเกม' : 'ตรวจคำตอบ'}
          </button>
          <button onClick={onClose} style={{ ...primaryBtn, background: '#607D8B' }}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  flex: 1,
  minHeight: 54,
  border: 'none',
  borderRadius: radius.pill,
  background: color.primary,
  color: '#fff',
  fontSize: 19,
  fontWeight: 800,
  cursor: 'pointer',
};
