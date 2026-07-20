import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import QRCode from 'qrcode';
import { buildChallengeUrl, buildCompactChallengeUrl } from '@/core/qrChallenge';
import type { QrChallenge, QuizItem } from '@/core/qrChallenge';
import { challengeApiAvailable, fetchChallengeResult, registerChallenge } from '@/core/challengeApi';
import { color, radius } from '@/theme/tokens';

// ── ฝั่ง tablet กลาง: คำถามไม่ปรากฏบนจอกลาง โชว์เป็น "ตราส่วนตัว" (QR) ให้สแกนไปตอบบนมือถือ ──
// โหมดอัตโนมัติ: poll ผลจาก server → เดินเกมต่อเอง · ถ้าไม่มี backend/เน็ตหลุด → กดผลเองได้
export function QrChallengePanel({
  challenge,
  onResult,
  onCancel,
  variant = 'quiz',
}: {
  challenge: QrChallenge;
  // `items` = ไอเทมที่ผู้เล่นกดใช้บนมือถือ (ว่างเสมอเมื่อครูกดผลเองบนแท็บเล็ต)
  onResult: (correct: boolean, items: QuizItem[]) => void;
  onCancel?: () => void;
  variant?: 'quiz' | 'gold-ar';
}) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const auto = challengeApiAvailable() && !!challenge.i;
  const resolvedRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // คำถามใหม่ = เริ่มรับผลใหม่ได้ (กันค้างสถานะ resolved ข้ามการ์ด เผื่อ component ถูก reuse)
  useEffect(() => {
    resolvedRef.current = false;
  }, [challenge.i]);

  // สร้าง QR
  useEffect(() => {
    let cancelled = false;
    setErr('');
    setDataUrl('');

    const generate = async () => {
      const page = variant === 'gold-ar' ? 'ar.html' : 'answer.html';
      let url = buildChallengeUrl(challenge, undefined, page);
      if (auto && challenge.i) {
        try {
          await registerChallenge(challenge);
          url = buildCompactChallengeUrl(challenge.i, undefined, page);
        } catch {
          // Backend ใช้ไม่ได้ชั่วคราว: QR แบบฝัง payload ยังตอบและแจ้งผลเองได้
        }
      }
      return QRCode.toDataURL(url, {
        width: 640,
        // ISO/IEC 18004 กำหนด quiet zone รอบ QR อย่างน้อย 4 modules
        margin: 4,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });
    };

    void generate()
      .then((nextDataUrl) => {
        if (!cancelled) setDataUrl(nextDataUrl);
      })
      .catch((e) => {
        if (cancelled) return;
        setDataUrl('');
        setErr(String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [auto, challenge, variant]);

  // โหมดอัตโนมัติ: poll ผลตอบจากมือถือผ่าน server
  useEffect(() => {
    if (!auto || !challenge.i) return;
    const id = challenge.i;
    let alive = true;
    const tick = async () => {
      if (!alive || resolvedRef.current) return;
      try {
        const r = await fetchChallengeResult(id);
        if (!alive || resolvedRef.current || !r.answered) return;
        resolvedRef.current = true;
        onResultRef.current(r.correct, r.items);
      } catch {
        /* เน็ตหลุดชั่วคราว — ลองใหม่รอบถัดไป */
      }
    };
    const iv = setInterval(tick, 1300);
    void tick();
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [auto, challenge.i]);

  const manual = (correct: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onResult(correct, []); // ครูกดเอง = ไม่มีไอเทมถูกใช้
  };

  return (
    <div style={wrap}>
      <div style={eyebrow}>
        <span aria-hidden>{variant === 'gold-ar' ? '🪙' : '🔒'}</span>{' '}
        {variant === 'gold-ar' ? 'ภารกิจ AR การ์ดทอง' : 'คำถามส่วนตัว'}
      </div>

      {/* ตราประทับ: QR ในกรอบทอง + มุมกรอบแบบเอกสารราชการ/viewfinder */}
      <div style={seal} className="qr-seal">
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />
        <div style={qrBox}>
          {dataUrl ? (
            <img src={dataUrl} alt="รหัสสำหรับสแกน" style={{ width: '100%', height: '100%', display: 'block' }} />
          ) : err ? (
            <span style={errText}>สร้างรหัสไม่สำเร็จ · {err}</span>
          ) : (
            <span style={{ color: color.textMuted, fontSize: 15 }}>กำลังเตรียม…</span>
          )}
        </div>
      </div>

      <p style={caption}>
        {variant === 'gold-ar'
          ? 'สแกนด้วยกล้องมือถือ แล้วส่องการ์ดทองเพื่อเริ่มบทเรียน AR'
          : 'สแกนด้วยมือถือเพื่อดูคำถามบนเครื่องของคุณ'}
      </p>

      {auto ? (
        <>
          {/* รอผลอัตโนมัติจากมือถือ */}
          <div style={waiting} className="qr-wait">
            <span style={dot} className="qr-dot" />
            รอคำตอบจากมือถือ…
          </div>
          {/* fallback เผื่อเน็ตหลุด/ผลไม่ขึ้น */}
          <div style={fallbackWrap}>
            <span style={fallbackLabel}>ยังไม่ขึ้น? เลือกผลเอง</span>
            <div style={btnRow}>
              <button style={ghostBtn(color.success)} onClick={() => manual(true)}>
                ตอบถูก
              </button>
              <button style={ghostBtn(color.danger)} onClick={() => manual(false)}>
                ตอบผิด
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ไม่มี backend → กดผลเองเป็นหลัก */}
          <div style={divider}>
            <span style={dividerLabel}>เมื่อตอบเสร็จ</span>
          </div>
          <div style={btnRow}>
            <button style={{ ...solidBtn, background: color.success }} onClick={() => manual(true)}>
              ตอบถูก
            </button>
            <button style={{ ...solidBtn, background: color.danger }} onClick={() => manual(false)}>
              ตอบผิด
            </button>
          </div>
        </>
      )}

      {variant === 'gold-ar' && onCancel ? (
        <button type="button" style={cancelBtn} onClick={onCancel}>
          ยกเลิกภารกิจนี้
        </button>
      ) : null}

      <style>{`
        @keyframes qrSealIn { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: none } }
        @keyframes qrDotPulse { 0%,100% { opacity: .35; transform: scale(.8) } 50% { opacity: 1; transform: scale(1) } }
        .qr-seal { animation: qrSealIn .4s cubic-bezier(.2,1.1,.4,1) both; }
        .qr-dot { animation: qrDotPulse 1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .qr-seal, .qr-dot { animation: none; } }
      `}</style>
    </div>
  );
}

// มุมกรอบทอง 4 มุม — ให้ความรู้สึกเอกสารราชการ + กรอบเล็งสแกน
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const v = pos[0] === 't' ? { top: -3 } : { bottom: -3 };
  const h = pos[1] === 'l' ? { left: -3 } : { right: -3 };
  const b = `3px solid ${color.secondary}`;
  const side: CSSProperties = {
    ...(pos[0] === 't' ? { borderTop: b } : { borderBottom: b }),
    ...(pos[1] === 'l' ? { borderLeft: b } : { borderRight: b }),
  };
  return (
    <span
      aria-hidden
      style={{ position: 'absolute', width: 22, height: 22, borderRadius: 4, ...v, ...h, ...side, pointerEvents: 'none' }}
    />
  );
}

const wrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'clamp(10px, 2.2vh, 16px)',
};

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 'clamp(14px, 1.6vh, 16px)',
  fontWeight: 800,
  letterSpacing: '.02em',
  color: color.primary,
  background: '#FFF6D8',
  border: `1.5px solid ${color.secondary}`,
  borderRadius: radius.pill,
  padding: '6px 16px',
};

const seal: CSSProperties = {
  position: 'relative',
  padding: 'clamp(12px, 1.8vh, 18px)',
  borderRadius: 14,
  background: 'linear-gradient(150deg, #FFF9E8, #F0DFB4)',
  boxShadow: `0 10px 28px rgba(120,86,20,.26), inset 0 0 0 1px rgba(255,255,255,.7)`,
};

const qrBox: CSSProperties = {
  width: 'clamp(220px, 42vh, 340px)',
  aspectRatio: '1 / 1',
  background: '#fff',
  borderRadius: 0,
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
};

const caption: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(14px, 1.7vh, 17px)',
  fontWeight: 600,
  color: color.text,
  textAlign: 'center',
  maxWidth: 340,
};

const waiting: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  fontSize: 'clamp(15px, 1.8vh, 18px)',
  fontWeight: 800,
  color: color.primary,
};

const dot: CSSProperties = {
  width: 11,
  height: 11,
  borderRadius: '50%',
  background: color.secondary,
  display: 'inline-block',
};

const fallbackWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  maxWidth: 360,
};

const fallbackLabel: CSSProperties = { fontSize: 13, fontWeight: 600, color: color.textMuted };

const divider: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 360,
  textAlign: 'center',
  borderTop: `1.5px dashed ${color.secondary}88`,
  marginTop: 2,
};

const dividerLabel: CSSProperties = {
  position: 'relative',
  top: -12,
  background: color.surface,
  padding: '0 12px',
  fontSize: 14,
  fontWeight: 700,
  color: color.textMuted,
};

const btnRow: CSSProperties = { display: 'flex', gap: 12, width: '100%', maxWidth: 360 };

const solidBtn: CSSProperties = {
  fontFamily: 'inherit',
  flex: 1,
  fontSize: 'clamp(17px, 2vh, 20px)',
  fontWeight: 800,
  color: '#fff',
  border: 'none',
  borderRadius: radius.pill,
  padding: 'clamp(12px, 1.6vh, 16px) 0',
  minHeight: 52,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,.16)',
};

// ปุ่ม fallback — เบากว่า ปุ่มหลัก (เป็นทางเลือกสำรอง ไม่ใช่ทางหลัก)
function ghostBtn(c: string): CSSProperties {
  return {
    fontFamily: 'inherit',
    flex: 1,
    fontSize: 15,
    fontWeight: 700,
    color: c,
    background: 'transparent',
    border: `1.5px solid ${c}`,
    borderRadius: radius.pill,
    padding: '9px 0',
    minHeight: 40,
    cursor: 'pointer',
  };
}

const errText: CSSProperties = { color: color.danger, fontSize: 12.5, padding: 10, textAlign: 'center' };

const cancelBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 700,
  color: color.textMuted,
  background: 'transparent',
  border: 'none',
  padding: '7px 12px',
  cursor: 'pointer',
};
