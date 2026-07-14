import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { decodeChallenge } from '@/core/qrChallenge';
import { challengeApiAvailable, postChallengeResult } from '@/core/challengeApi';

// ── หน้าตอบคำถามบนมือถือส่วนตัว ──
// อ่าน payload จาก location.hash → โชว์คำถาม+ตัวเลือก → ตอบแล้วเห็นผลทันที (ตรวจในเครื่อง)
// ผลไม่ถูกส่งกลับอัตโนมัติ — ผู้เล่นกลับไปกด "ถูก/ผิด" ที่ tablet กลาง (โหมดเชื่อใจ)
const DIFF: Record<string, { label: string; bg: string }> = {
  easy: { label: 'ง่าย', bg: '#2E7D32' },
  medium: { label: 'ปานกลาง', bg: '#B8860B' },
  hard: { label: 'ยาก', bg: '#B02020' },
};

export function AnswerPage() {
  const challenge = useMemo(() => {
    const raw = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    return raw ? decodeChallenge(raw) : null;
  }, []);
  const [picked, setPicked] = useState<number | null>(null);
  const [sent, setSent] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');
  // ส่งผลอัตโนมัติได้ไหม (มี challenge id + backend) — ถ้าไม่ ใช้โหมดกดผลเองบน tablet
  const auto = !!challenge?.i && challengeApiAvailable();

  // ตอบแล้ว → ส่งผลขึ้น server อัตโนมัติ (ครั้งเดียว, ปุ่มถูก disable หลังตอบ)
  useEffect(() => {
    if (picked === null || !auto || !challenge?.i) return;
    setSent('sending');
    postChallengeResult(challenge.i, picked === challenge.a)
      .then(() => setSent('ok'))
      .catch(() => setSent('fail'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  if (!challenge) {
    return (
      <div style={shell}>
        <div style={card}>
          <div style={{ fontSize: 52 }}>📵</div>
          <h1 style={{ fontSize: 22, color: '#8B0000' }}>QR ไม่ถูกต้อง</h1>
          <p style={{ fontSize: 16, color: '#6B5E4E' }}>
            สแกน QR บนการ์ดจากจอกลางอีกครั้งนะ
          </p>
        </div>
      </div>
    );
  }

  const answered = picked !== null;
  const correct = answered && picked === challenge.a;
  const diff = challenge.d ? DIFF[challenge.d] : null;

  return (
    <div style={shell}>
      <div style={card}>
        {/* แถบบริบท (พระนาม/วิชา + ระดับ) — ไม่ใช่คำถาม */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 4 }}>
          {challenge.t && <span style={chip('#8B0000')}>{challenge.t}</span>}
          {diff && <span style={chip(diff.bg)}>ระดับ{diff.label}</span>}
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2A2118', lineHeight: 1.4, textAlign: 'center' }}>
          {challenge.q}
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
          {challenge.c.map((text, i) => {
            const isPicked = picked === i;
            const isAnswer = challenge.a === i;
            let bg = '#FBF3E4';
            let fg = '#2A2118';
            let border = '#C9A227';
            if (answered) {
              if (isAnswer) {
                bg = '#2E7D32';
                fg = '#fff';
                border = '#2E7D32';
              } else if (isPicked) {
                bg = '#C62828';
                fg = '#fff';
                border = '#C62828';
              }
            }
            return (
              <button
                key={i}
                disabled={answered}
                onClick={() => setPicked(i)}
                style={{
                  ...choiceBtn,
                  background: bg,
                  color: fg,
                  border: `2px solid ${border}`,
                  cursor: answered ? 'default' : 'pointer',
                }}
              >
                <b style={{ marginRight: 8 }}>{String.fromCharCode(65 + i)}.</b>
                {text}
              </button>
            );
          })}
        </div>

        {answered && (
          <div style={{ marginTop: 4 }}>
            <div style={{ ...resultBanner, background: correct ? '#2E7D32' : '#B02020' }}>
              <span style={{ fontSize: 30 }}>{correct ? '🎉' : '💪'}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {correct ? 'ถูกต้อง! เก่งมาก' : 'ยังไม่ถูกนะ'}
                </div>
                {correct && <div style={{ fontSize: 14, opacity: 0.95 }}>ได้เหรียญ 🪙 {challenge.r}</div>}
              </div>
            </div>
            {challenge.x && (
              <p style={{ fontSize: 16, color: '#6B5E4E', lineHeight: 1.5, marginTop: 12 }}>💡 {challenge.x}</p>
            )}
            <div style={backToTablet}>
              {auto ? (
                sent === 'ok' ? (
                  <>✓ ส่งคำตอบแล้ว — จอกลางจะไปต่อให้เอง</>
                ) : sent === 'fail' ? (
                  <>
                    ส่งไม่สำเร็จ · แจ้งผล <b>“{correct ? 'ตอบถูก' : 'ตอบผิด'}”</b> ที่จอกลาง
                  </>
                ) : (
                  <>⏳ กำลังส่งคำตอบ…</>
                )
              ) : (
                <>
                  👉 แจ้งผล <b>“{correct ? 'ตอบถูก' : 'ตอบผิด'}”</b> ที่จอกลาง
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const shell: CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'radial-gradient(120% 120% at 50% 0%, #3A1B0A, #1A0D04)',
};

const card: CSSProperties = {
  width: 'min(460px, 100%)',
  background: 'linear-gradient(170deg, #FFFDF8, #F3E7CF)',
  borderRadius: 22,
  boxShadow: '0 16px 44px rgba(0,0,0,.5)',
  padding: '22px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const choiceBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 19,
  fontWeight: 600,
  textAlign: 'left',
  padding: '16px 18px',
  minHeight: 58,
  borderRadius: 14,
  transition: 'background .15s',
};

const resultBanner: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  color: '#fff',
  padding: '14px 16px',
  borderRadius: 14,
};

const backToTablet: CSSProperties = {
  marginTop: 12,
  fontSize: 16,
  fontWeight: 700,
  color: '#8B0000',
  background: '#FFF6D8',
  border: '1.5px dashed #C9A227',
  borderRadius: 12,
  padding: '12px 14px',
  textAlign: 'center',
};

function chip(bg: string): CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 800,
    color: '#fff',
    background: bg,
    borderRadius: 999,
    padding: '4px 12px',
  };
}
