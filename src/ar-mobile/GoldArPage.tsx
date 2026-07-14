import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { challengeApiAvailable, fetchChallenge, postChallengeResult } from '@/core/challengeApi';
import { decodeChallenge } from '@/core/qrChallenge';
import type { GoldArChallenge } from '@/core/qrChallenge';

const ARGoldChallenge = lazy(() =>
  import('@/components/ARGoldChallenge').then((module) => ({ default: module.ARGoldChallenge }))
);

type PageState =
  | 'loading'
  | 'ready'
  | 'playing'
  | 'sending'
  | 'sent'
  | 'manual-complete'
  | 'send-failed'
  | 'cancelled'
  | 'invalid';

export function GoldArPage() {
  const challengeId = useMemo(() => new URLSearchParams(window.location.search).get('id'), []);
  const inlineChallenge = useMemo(() => {
    const raw = window.location.hash.replace(/^#/, '');
    return raw ? (decodeChallenge(raw) as GoldArChallenge | null) : null;
  }, []);
  const [challenge, setChallenge] = useState<GoldArChallenge | null>(inlineChallenge);
  const [state, setState] = useState<PageState>(() => (inlineChallenge?.mode === 'gold-ar' ? 'ready' : 'loading'));
  const [pendingResult, setPendingResult] = useState<boolean | null>(null);

  useEffect(() => {
    if (inlineChallenge?.mode === 'gold-ar') return;
    if (!challengeId) {
      setState('invalid');
      return;
    }
    let cancelled = false;
    fetchChallenge<GoldArChallenge>(challengeId)
      .then((nextChallenge) => {
        if (cancelled) return;
        if (nextChallenge.mode !== 'gold-ar' || !nextChallenge.king || !nextChallenge.quiz) {
          setState('invalid');
          return;
        }
        setChallenge(nextChallenge);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [challengeId, inlineChallenge]);

  const sendResult = useCallback(
    async (correct: boolean) => {
      if (!challenge?.i) return;
      setPendingResult(correct);
      if (!challengeApiAvailable()) {
        setState('manual-complete');
        return;
      }
      setState('sending');
      try {
        await postChallengeResult(challenge.i, correct);
        setState('sent');
      } catch {
        setState('send-failed');
      }
    },
    [challenge?.i]
  );

  if (state === 'playing' && challenge) {
    return (
      <Suspense fallback={<StatusScreen title="กำลังเตรียมระบบ AR…" />}>
        <ARGoldChallenge
          king={challenge.king}
          quiz={challenge.quiz}
          useCamera
          cardMode
          onDone={(correct) => void sendResult(correct)}
          onCancel={() => setState('cancelled')}
        />
      </Suspense>
    );
  }

  if (state === 'loading') return <StatusScreen title="กำลังโหลดภารกิจ…" />;
  if (state === 'invalid') {
    return <StatusScreen title="ไม่พบภารกิจ AR" detail="กลับไปสแกน QR การ์ดทองจากจอกลางอีกครั้ง" />;
  }
  if (state === 'sending') return <StatusScreen title="กำลังส่งผลไปจอกลาง…" />;
  if (state === 'sent') {
    return <StatusScreen title="ส่งผลเรียบร้อย" detail="จอกลางจะดำเนินเกมต่อโดยอัตโนมัติ" success />;
  }
  if (state === 'manual-complete') {
    return (
      <StatusScreen
        title={pendingResult ? 'ตอบถูก' : 'ตอบผิด'}
        detail="กลับไปเลือกผลเดียวกันที่จอกลางเพื่อดำเนินเกมต่อ"
        success={pendingResult === true}
      />
    );
  }
  if (state === 'send-failed') {
    return (
      <StatusScreen
        title="ส่งผลไม่สำเร็จ"
        detail="ตรวจสอบอินเทอร์เน็ตแล้วลองส่งอีกครั้ง"
        actionLabel="ส่งผลอีกครั้ง"
        onAction={() => pendingResult !== null && void sendResult(pendingResult)}
      />
    );
  }
  if (state === 'cancelled') {
    return <StatusScreen title="ออกจากภารกิจแล้ว" detail="กดยกเลิกภารกิจที่จอกลางเพื่อเล่นต่อ" />;
  }

  return (
    <main style={introShell}>
      <section style={introPanel}>
        <div style={seal}>๗</div>
        <div style={eyebrow}>ภารกิจการ์ดทอง</div>
        <h1 style={title}>{challenge?.king.name}</h1>
        <div style={steps}>
          <span>ส่องการ์ดทอง</span>
          <span>ชมวิดีโอ AR</span>
          <span>ลากคำตอบ</span>
        </div>
        <button type="button" style={startButton} onClick={() => setState('playing')}>
          เปิดกล้องและเริ่ม AR
        </button>
      </section>
    </main>
  );
}

function StatusScreen({
  title: screenTitle,
  detail,
  success = false,
  actionLabel,
  onAction,
}: {
  title: string;
  detail?: string;
  success?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main style={statusShell}>
      <div style={{ ...statusMark, borderColor: success ? '#E6C35C' : '#9F7A32' }}>{success ? '✓' : '๗'}</div>
      <h1 style={{ ...title, color: '#FFF8E7' }}>{screenTitle}</h1>
      {detail ? <p style={statusDetail}>{detail}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" style={startButton} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </main>
  );
}

const introShell: CSSProperties = {
  minHeight: '100dvh',
  display: 'grid',
  placeItems: 'center',
  padding: '24px 18px',
  color: '#2A2118',
  background: '#1A0D04',
};

const introPanel: CSSProperties = {
  width: 'min(440px, 100%)',
  padding: '34px 22px 24px',
  textAlign: 'center',
  background: '#FFF9E8',
  border: '2px solid #C89B30',
  borderRadius: 8,
  boxShadow: '0 18px 50px rgba(0,0,0,.45)',
};

const seal: CSSProperties = {
  width: 74,
  height: 74,
  display: 'grid',
  placeItems: 'center',
  margin: '0 auto 18px',
  color: '#FFF9E8',
  background: '#8B0000',
  border: '4px double #E6C35C',
  borderRadius: '50%',
  fontFamily: 'serif',
  fontSize: 38,
  fontWeight: 800,
};

const eyebrow: CSSProperties = {
  color: '#8B0000',
  fontSize: 14,
  fontWeight: 800,
};

const title: CSSProperties = {
  margin: '8px 0 20px',
  fontSize: 27,
  lineHeight: 1.35,
  fontWeight: 800,
};

const steps: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 1,
  marginBottom: 22,
  color: '#5E4930',
  background: '#DCC68C',
  border: '1px solid #DCC68C',
  fontSize: 13,
  fontWeight: 700,
};

const startButton: CSSProperties = {
  width: '100%',
  minHeight: 54,
  padding: '13px 18px',
  color: '#fff',
  background: '#8B0000',
  border: '1px solid #650000',
  borderRadius: 6,
  fontSize: 18,
  fontWeight: 800,
  cursor: 'pointer',
};

const statusShell: CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: 24,
  textAlign: 'center',
  color: '#FFF8E7',
  background: '#1A0D04',
};

const statusMark: CSSProperties = {
  width: 70,
  height: 70,
  display: 'grid',
  placeItems: 'center',
  border: '3px double #9F7A32',
  borderRadius: '50%',
  color: '#E6C35C',
  fontSize: 34,
  fontWeight: 800,
};

const statusDetail: CSSProperties = {
  maxWidth: 360,
  color: '#D8C9A8',
  fontSize: 16,
  lineHeight: 1.6,
};
