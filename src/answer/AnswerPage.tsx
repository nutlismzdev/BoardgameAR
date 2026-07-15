import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { decodeChallenge } from '@/core/qrChallenge';
import { challengeApiAvailable, fetchChallenge, postChallengeResult } from '@/core/challengeApi';

// lazy — jsqr หนัก ~130KB และหน้านี้ต้องเบา (มือถือเด็กโหลดใหม่ทุกคำถามผ่านไวไฟโรงเรียน)
// กล้องสแกนใช้ "หลังตอบเสร็จ" เท่านั้น จึงไม่ควรถ่วงตอนโหลดคำถาม → โหลดตอนต้องใช้จริง
const QrRescanner = lazy(() => import('./QrRescanner').then((m) => ({ default: m.QrRescanner })));

// ── หน้าตอบคำถามบนมือถือส่วนตัว ──
// ปกติโหลด payload ด้วย challenge id; รองรับ payload ใน hash เป็น fallback เมื่อไม่มี backend
// ตรวจคำตอบในเครื่องและส่งผลกลับจอกลางอัตโนมัติเมื่อ API พร้อม
const DIFF: Record<string, { label: string; bg: string }> = {
  easy: { label: 'ง่าย', bg: '#2E7D32' },
  medium: { label: 'ปานกลาง', bg: '#B8860B' },
  hard: { label: 'ยาก', bg: '#B02020' },
};

export function AnswerPage() {
  const inlineChallenge = useMemo(() => {
    const raw = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    return raw ? decodeChallenge(raw) : null;
  }, []);
  const challengeId = useMemo(
    () => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null),
    []
  );
  const [challenge, setChallenge] = useState(inlineChallenge);
  const [loading, setLoading] = useState(() => !!challengeId && !inlineChallenge);
  const [picked, setPicked] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [sent, setSent] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');
  // ส่งผลอัตโนมัติได้ไหม (มี challenge id + backend) — ถ้าไม่ ใช้โหมดกดผลเองบน tablet
  const auto = !!challenge?.i && challengeApiAvailable();
  const timerOn = (challenge?.s ?? 0) > 0;

  useEffect(() => {
    if (!challengeId || inlineChallenge) return;
    let cancelled = false;
    fetchChallenge(challengeId)
      .then((nextChallenge) => {
        if (!cancelled) setChallenge(nextChallenge);
      })
      .catch(() => {
        if (!cancelled) setChallenge(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [challengeId, inlineChallenge]);

  // เริ่มนับเมื่อกล้องเปิดหน้าคำถามสำเร็จ ใช้ deadline จริงเพื่อไม่ให้เวลาเพี้ยนเมื่อ browser อยู่เบื้องหลัง
  useEffect(() => {
    if (!challenge || !timerOn || picked !== null) return;
    const deadline = Date.now() + challenge.s! * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) setPicked(-1);
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [challenge, picked, timerOn]);

  // ตอบแล้ว → ส่งผลขึ้น server อัตโนมัติ (ครั้งเดียว, ปุ่มถูก disable หลังตอบ)
  useEffect(() => {
    if (picked === null || !auto || !challenge?.i) return;
    setSent('sending');
    postChallengeResult(challenge.i, picked === challenge.a)
      .then(() => setSent('ok'))
      .catch(() => setSent('fail'));
  }, [auto, challenge?.a, challenge?.i, picked]);

  if (loading) {
    return (
      <div style={shell}>
        <div style={card}>กำลังโหลดคำถาม…</div>
      </div>
    );
  }

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

        {timerOn && !answered && (
          <div style={timerWrap} role="timer" aria-live="polite">
            <div style={timerTrack}>
              <div
                style={{
                  ...timerFill,
                  width: `${(timeLeft / challenge.s!) * 100}%`,
                  background: timeLeft <= 5 ? '#C62828' : '#C9A227',
                }}
              />
            </div>
            <strong style={{ color: timeLeft <= 5 ? '#C62828' : '#6B4E00' }}>{timeLeft} วินาที</strong>
          </div>
        )}

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
                  {correct ? 'ถูกต้อง! เก่งมาก' : picked === -1 ? 'หมดเวลาตอบ' : 'ยังไม่ถูกนะ'}
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

            {/* ตอบเสร็จแล้วเปิดกล้องค้างรอใบต่อไปเลย — ไม่ต้องออกไปเปิดแอปกล้องใหม่ทุกตา
                (รอให้ส่งผลเสร็จก่อน ไม่งั้นแย่งแบนด์วิดท์/ทำจังหวะสับสน) */}
            {sent !== 'sending' && (
              <Suspense fallback={<div style={scannerLoading}>📷 กำลังเตรียมกล้อง…</div>}>
                <QrRescanner onFound={goToChallenge} />
              </Suspense>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ไปยังการ์ดใบใหม่ที่สแกนเจอ — เปลี่ยนแค่ hash เบราว์เซอร์จะไม่ reload เอง
// (payload อยู่ใน hash) จึงต้องสั่ง reload เพื่อให้ AnswerPage อ่าน challenge ใหม่
// หน้านี้เป็น entry เล็ก (~48KB) reload จึงเร็วกว่าการรื้อ state ทั้งหน้าให้ยุ่ง
function goToChallenge(url: string) {
  const next = new URL(url, window.location.href);
  const onlyHashChanged = next.pathname === window.location.pathname && next.search === window.location.search;
  window.location.href = next.href;
  if (onlyHashChanged) window.location.reload();
}

const scannerLoading: CSSProperties = {
  padding: '18px 12px',
  borderRadius: 16,
  border: '1px dashed #C8B48A',
  textAlign: 'center',
  fontSize: 14,
  color: '#6B5E4E',
};

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

const timerWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const timerTrack: CSSProperties = {
  flex: 1,
  height: 9,
  borderRadius: 999,
  background: '#E4D8C1',
  overflow: 'hidden',
};

const timerFill: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  transition: 'width .25s linear, background .2s',
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
