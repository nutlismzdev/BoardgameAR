import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { decodeChallenge } from '@/core/qrChallenge';
import type { QuizItem } from '@/core/qrChallenge';
import {
  challengeApiAvailable,
  fetchChallenge,
  fetchChallengeResult,
  postChallengeResult,
} from '@/core/challengeApi';

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
  // ข้อนี้ถูกตัดสินที่จอกลางไปแล้ว (ครูกดผลเอง / ผู้เล่นอื่นตอบ / กดย้อนกลับมาที่ข้อเก่า)
  const [closed, setClosed] = useState(false);
  // ไอเทมที่กดใช้ในข้อนี้ — ส่งกลับให้แท็บเล็ตหักจำนวนจริงใน store (มือถือไม่ได้ถือคลังเอง)
  const [usedItems, setUsedItems] = useState<QuizItem[]>([]);
  // ตัวเลือกที่ถูก 50:50 ตัดทิ้ง (คำนวณบนมือถือได้เพราะ payload มี index เฉลยอยู่แล้ว)
  const [hidden, setHidden] = useState<number[]>([]);
  const [skipped, setSkipped] = useState(false);
  const itemsLeft = challenge?.it;
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

  // ── เฝ้าดูว่าข้อนี้ยัง "เปิดรับคำตอบ" อยู่ไหม ──
  // มือถือเดิมมีแต่ขาส่งออก ไม่เคยฟังกลับ → ถ้าจอกลางตัดสินข้อนี้ไปแล้ว (ครูกดผลเอง
  // เพราะรอนาน / เด็กกดย้อนกลับมาที่ข้อเก่า) หน้าจอนี้ยังโชว์ปุ่มตอบค้างไว้เหมือนเดิม
  // เด็กกดตอบได้ทั้งที่เกมผ่านไปแล้ว แล้วผลก็ถูกทิ้ง (server เก็บผลแรกไว้) = งงกันทั้งห้อง
  // server รู้อยู่แล้วผ่าน `answered` แค่ไม่เคยมีใครถาม → ถามทุก 2 วิ แล้วล็อกจอเมื่อจบ
  // เช็กรอบแรกทันทีที่เปิดหน้า จึงกันเคส "กด back กลับมาข้อที่ตอบไปแล้ว" ไปในตัว
  useEffect(() => {
    if (!auto || !challenge?.i || picked !== null || closed) return;
    const id = challenge.i;
    let alive = true;
    const check = async () => {
      try {
        const r = await fetchChallengeResult(id);
        if (alive && r.answered) setClosed(true);
      } catch {
        /* เน็ตสะดุด — ลองใหม่รอบถัดไป ไม่ล็อกจอเพราะเดาไม่ได้ว่าจบหรือยัง */
      }
    };
    void check();
    const iv = window.setInterval(check, 2000);
    return () => {
      alive = false;
      window.clearInterval(iv);
    };
  }, [auto, challenge?.i, picked, closed]);

  // เริ่มนับเมื่อกล้องเปิดหน้าคำถามสำเร็จ ใช้ deadline จริงเพื่อไม่ให้เวลาเพี้ยนเมื่อ browser อยู่เบื้องหลัง
  // หยุดนับเมื่อข้อถูกปิดไปแล้ว ไม่งั้นหมดเวลาแล้วยิงผล "ตอบผิด" ใส่ข้อที่จบไปแล้ว
  useEffect(() => {
    if (!challenge || !timerOn || picked !== null || closed) return;
    const deadline = Date.now() + challenge.s! * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) setPicked(-1);
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [challenge, picked, timerOn, closed]);

  // ตอบแล้ว → ส่งผลขึ้น server อัตโนมัติ (ครั้งเดียว, ปุ่มถูก disable หลังตอบ)
  // ส่ง usedItems ไปด้วยเพื่อให้แท็บเล็ตหักไอเทม · อ่านผ่าน ref ไม่ใส่ใน deps
  // ไม่งั้น setUsedItems ตอนกดข้ามคำถามจะทำให้ effect ยิงซ้ำเป็นรอบสอง
  const usedItemsRef = useRef(usedItems);
  usedItemsRef.current = usedItems;
  useEffect(() => {
    if (picked === null || !auto || !challenge?.i) return;
    setSent('sending');
    // ข้ามคำถาม = ไม่ใช่ทั้งถูกและผิด — ส่ง correct=false แล้วให้แท็บเล็ตอ่านจาก items ว่าเป็นการข้าม
    postChallengeResult(challenge.i, picked === challenge.a, usedItemsRef.current)
      .then(() => setSent('ok'))
      .catch(() => setSent('fail'));
  }, [auto, challenge?.a, challenge?.i, picked]);

  // กดใช้ไอเทม — บันทึกว่าใช้แล้ว (ส่งกลับตอนจบข้อ) แล้วทำผลของไอเทมบนเครื่องนี้เลย
  const useFiftyFifty = () => {
    if (!challenge || usedItems.includes('fiftyFifty')) return;
    const wrong = challenge.c.map((_, i) => i).filter((i) => i !== challenge.a);
    setHidden(wrong.sort(() => Math.random() - 0.5).slice(0, 2));
    setUsedItems((prev) => [...prev, 'fiftyFifty']);
  };
  const useSkip = () => {
    if (!challenge || usedItems.includes('skip')) return;
    setSkipped(true);
    setUsedItems((prev) => [...prev, 'skip']);
    setPicked((prev) => (prev === null ? -1 : prev)); // -1 = ไม่ได้เลือกข้อไหน
  };

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

  // ── ตอบแล้ว → ปิดคำถามเก่าทิ้งทั้งหมด เหลือแค่ "ผล + กล้องรอใบต่อไป" ──
  // คำถาม/ตัวเลือกไม่มีประโยชน์แล้วหลังตอบ แถมกินที่จนกล้องตกใต้จอ (เคยล้น 197px)
  // ตัดทิ้งเลยดีกว่าเลื่อนหนี — กล้องได้เป็นพระเอกเต็มจอเดียว ไม่ต้องสกรอลล์
  if (answered) {
    return (
      <div style={shell}>
        <div style={card}>
          <div
            style={{ ...resultBanner, background: skipped ? '#6B4E1E' : correct ? '#2E7D32' : '#B02020' }}
          >
            <span style={{ fontSize: 30 }}>{skipped ? '⏭️' : correct ? '🎉' : '💪'}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {skipped
                  ? 'ข้ามคำถามแล้ว'
                  : correct
                  ? 'ถูกต้อง! เก่งมาก'
                  : picked === -1
                  ? 'หมดเวลาตอบ'
                  : 'ยังไม่ถูกนะ'}
              </div>
              {/* ตอบผิด/ข้าม ต้องบอกเฉลยตรงนี้ — เดิมดูจากตัวเลือกที่ไฮไลต์เขียว แต่ตอนนี้ซ่อนไปแล้ว */}
              <div style={{ fontSize: 14, opacity: 0.95 }}>
                {skipped
                  ? `ได้ครึ่งรางวัล · คำตอบที่ถูกคือ: ${challenge.c[challenge.a]}`
                  : correct
                  ? `ได้เหรียญ 🪙 ${challenge.r}`
                  : `คำตอบที่ถูกคือ: ${challenge.c[challenge.a]}`}
              </div>
            </div>
          </div>

          {challenge.x && (
            <p style={{ fontSize: 15, color: '#6B5E4E', lineHeight: 1.5, margin: 0 }}>💡 {challenge.x}</p>
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

          {/* กล้องรอใบต่อไป — รอส่งผลเสร็จก่อน ไม่งั้นแย่งแบนด์วิดท์/จังหวะสับสน */}
          {sent !== 'sending' && (
            <Suspense fallback={<div style={scannerLoading}>📷 กำลังเตรียมกล้อง…</div>}>
              <QrRescanner onFound={goToChallenge} />
            </Suspense>
          )}
        </div>
      </div>
    );
  }

  // ── ข้อนี้จบไปแล้วที่จอกลาง → ล็อกจอ ไม่ให้กดตอบย้อนหลัง ──
  // ต้องอยู่ "ก่อน" บล็อกคำถาม ไม่งั้นปุ่มตัวเลือกยังเรนเดอร์ออกมาให้กดได้
  if (closed) {
    return (
      <div style={shell}>
        <div style={card}>
          <div style={{ ...resultBanner, background: '#6B5E4E' }}>
            <span style={{ fontSize: 30 }}>⌛</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>ข้อนี้จบไปแล้ว</div>
              <div style={{ fontSize: 14, opacity: 0.95 }}>จอกลางบันทึกผลของข้อนี้เรียบร้อยแล้ว</div>
            </div>
          </div>
          <p style={{ fontSize: 15, color: '#6B5E4E', lineHeight: 1.5, margin: 0, textAlign: 'center' }}>
            เล็งกล้องไปที่ QR ใบใหม่บนจอกลางเพื่อเล่นต่อ
          </p>
          <Suspense fallback={<div style={scannerLoading}>📷 กำลังเตรียมกล้อง…</div>}>
            <QrRescanner onFound={goToChallenge} />
          </Suspense>
        </div>
      </div>
    );
  }

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

        {timerOn && (
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

        {/* บล็อกนี้เรนเดอร์เฉพาะ "ก่อนตอบ" (ตอบแล้ว return ไปทางอื่นตั้งแต่ด้านบน)
            จึงไม่ต้องมีสถานะไฮไลต์เฉลย/disabled อีกแล้ว */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
          {challenge.c.map((text, i) =>
            // 50:50 ตัดตัวเลือกผิดออก 2 ข้อ — เว้นที่ว่างไว้ให้ layout ไม่กระโดด
            hidden.includes(i) ? (
              <div key={i} style={{ minHeight: 58, opacity: 0.2 }} />
            ) : (
              <button
                key={i}
                type="button"
                // ตาแรกชนะ — แตะรัว 2 ปุ่มก่อน React รีเรนเดอร์ เดิมจะนับปุ่มหลังทับปุ่มแรก
                onClick={() => setPicked((prev) => (prev === null ? i : prev))}
                style={{
                  ...choiceBtn,
                  background: '#FBF3E4',
                  color: '#2A2118',
                  border: '2px solid #C9A227',
                  cursor: 'pointer',
                }}
              >
                <b style={{ marginRight: 8 }}>{String.fromCharCode(65 + i)}.</b>
                {text}
              </button>
            )
          )}
        </div>

        {/* ── ไอเทมช่วยเล่น ──
            โหมด QR คำถามอยู่บนมือถือ แต่ปุ่มไอเทมเคยอยู่แต่ใน UI ควิซบนแท็บเล็ต
            → 50:50/ข้ามคำถาม ซื้อจากร้านได้แต่ไม่มีทางกดใช้ (กับดักดูดเหรียญ)
            คลังไอเทมยังอยู่ที่ store บนแท็บเล็ต มือถือแค่ "ขอใช้" แล้วรายงานกลับตอนส่งผล
            gate ด้วย `auto`: ไม่มี backend = ไม่มีช่องรายงานกลับ ถ้ายังโชว์ปุ่มจะกดใช้ฟรีไม่จำกัด
            (ครูกดผลเองบนแท็บเล็ตส่ง items ว่างเสมอ) */}
        {auto && itemsLeft && (itemsLeft.f > 0 || itemsLeft.s > 0) && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {itemsLeft.f > 0 && !usedItems.includes('fiftyFifty') && (
              <button type="button" onClick={useFiftyFifty} style={itemBtn}>
                ✂️ 50:50 ({itemsLeft.f})
              </button>
            )}
            {itemsLeft.s > 0 && (
              <button type="button" onClick={useSkip} style={itemBtn}>
                ⏭️ ข้ามคำถาม ({itemsLeft.s})
              </button>
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

const itemBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 800,
  color: '#1565C0',
  background: '#E3F2FD',
  border: '2px solid #1565C0',
  borderRadius: 999,
  padding: '10px 18px',
  minHeight: 46,
  cursor: 'pointer',
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
