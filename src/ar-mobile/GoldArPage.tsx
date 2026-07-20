import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { challengeApiAvailable, fetchChallenge, postChallengeResult } from '@/core/challengeApi';
import { decodeChallenge } from '@/core/qrChallenge';
import { lessonVideoFor } from '@/core/videoPool';
import type { GoldArChallenge } from '@/core/qrChallenge';

const ARGoldChallenge = lazy(() =>
  import('@/components/ARGoldChallenge').then((module) => ({ default: module.ARGoldChallenge }))
);
const QrVideoStage = lazy(() =>
  import('./QrVideoStage').then((module) => ({ default: module.QrVideoStage }))
);
// กล้องรอสแกนใบต่อไป — ตัวเดียวกับที่หน้า answer.html ใช้ (โค้ดเดียว กฎกรอง QR เดียว)
// lazy เพราะ jsqr หนัก ~130KB และหน้าจอผลลัพธ์เป็นปลายทาง ไม่ควรถ่วงตอนโหลดภารกิจ
const QrRescanner = lazy(() =>
  import('@/answer/QrRescanner').then((module) => ({ default: module.QrRescanner }))
);

// ไปการ์ดใบใหม่ที่สแกนเจอ — ข้ามหน้าได้ (ar.html → answer.html) จึงตั้ง href ตรง ๆ
// เปลี่ยนแค่ hash เบราว์เซอร์จะไม่ reload เอง (payload อยู่ใน hash) ต้องสั่ง reload เอง
function goToChallenge(url: string) {
  const next = new URL(url, window.location.href);
  const onlyHashChanged = next.pathname === window.location.pathname && next.search === window.location.search;
  window.location.href = next.href;
  if (onlyHashChanged) window.location.reload();
}

type PageState =
  | 'loading'
  | 'ready'
  | 'qr-video'
  | 'card-fallback'
  | 'question'
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

  if (state === 'qr-video' && challenge?.i) {
    return (
      <Suspense fallback={<StatusScreen title="กำลังเตรียมตัวติดตาม QR…" />}>
        <QrVideoStage
          challengeId={challenge.i}
          lessonUrl={lessonVideoFor(challenge.quiz.id, challenge.quiz.videoUrl, challenge.king.arVideo)}
          kingName={challenge.king.name}
          onEnded={() => setState('question')}
          onFallback={() => setState('card-fallback')}
        />
      </Suspense>
    );
  }

  if ((state === 'card-fallback' || state === 'question') && challenge) {
    return (
      <Suspense fallback={<StatusScreen title="กำลังเตรียมระบบ AR…" />}>
        <ARGoldChallenge
          king={challenge.king}
          quiz={challenge.quiz}
          useCamera
          cardMode={state === 'card-fallback'}
          startAtQuestion={state === 'question'}
          onDone={(correct) => void sendResult(correct)}
          onCancel={() => setState('cancelled')}
        />
      </Suspense>
    );
  }

  if (state === 'loading') return <StatusScreen title="กำลังโหลดภารกิจ…" />;
  if (state === 'invalid') {
    return <StatusScreen title="ไม่พบภารกิจ AR" detail="เล็งกล้องไปที่ QR บนจอกลางอีกครั้ง" rescan />;
  }
  if (state === 'sending') return <StatusScreen title="กำลังส่งผลไปจอกลาง…" />;
  if (state === 'sent') {
    return (
      <StatusScreen
        title="ส่งผลเรียบร้อย"
        detail="จอกลางจะดำเนินเกมต่อโดยอัตโนมัติ · เล็งกล้องที่ QR ใบถัดไปได้เลย"
        success
        rescan
      />
    );
  }
  if (state === 'manual-complete') {
    return (
      <StatusScreen
        title={pendingResult ? 'ตอบถูก' : 'ตอบผิด'}
        detail="กลับไปเลือกผลเดียวกันที่จอกลางเพื่อดำเนินเกมต่อ"
        success={pendingResult === true}
        rescan
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
    return <StatusScreen title="ออกจากภารกิจแล้ว" detail="กดยกเลิกภารกิจที่จอกลางเพื่อเล่นต่อ" rescan />;
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
        <button type="button" style={startButton} onClick={() => setState('qr-video')}>
          เปิดกล้องและส่อง QR
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
  rescan = false,
}: {
  title: string;
  detail?: string;
  success?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  rescan?: boolean; // เปิดกล้องรอใบต่อไป — ใช้กับจอที่เป็น "ปลายทาง" ของภารกิจ
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
      {rescan ? (
        <div style={rescanSlot}>
          <Suspense fallback={<p style={statusDetail}>📷 กำลังเตรียมกล้อง…</p>}>
            <QrRescanner onFound={goToChallenge} />
          </Suspense>
        </div>
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

// กล่องกล้องบนพื้นเข้มของหน้าผลลัพธ์ — จำกัดความกว้างให้เท่ากับข้อความ ไม่ให้กินทั้งจอ
const rescanSlot: CSSProperties = {
  width: 'min(360px, 100%)',
  marginTop: 6,
};

const statusDetail: CSSProperties = {
  maxWidth: 360,
  color: '#D8C9A8',
  fontSize: 16,
  lineHeight: 1.6,
};
