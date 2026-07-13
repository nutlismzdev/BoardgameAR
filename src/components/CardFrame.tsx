import { useEffect, useRef, useState } from 'react';
import { getCardBack } from '@/core/cardAssets';
import { elevation } from '@/theme/tokens';
import type { Orientation } from '@/core/types';

// เฟรมการ์ดตอนลงกระดาน — 2 โหมด:
//  • themed : กรอบทอง + แถบป้ายสีตามชนิด + เนื้อหา DOM (คำถาม/สาระ/ทอง/ทำโทษ/โบนัส) → กดได้ครบ ยืดตามเนื้อหา
//  • art    : ใช้ "รูปหน้าการ์ดจริง" เป็นพื้น แล้ววางเนื้อหาทับในกรอบ (ใช้กับการ์ดความรู้ที่ไม่มีช่องคำตอบ)
// ถ้ามี "หลังการ์ด" (getCardBack) และผู้ใช้ไม่ปิดแอนิเมชัน → โชว์หลังการ์ดก่อนแล้ว "พลิก" เผยหน้า (แตะข้ามได้)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface Props {
  kind: string;
  title: string;
  subtitle?: string;
  bannerFrom: string; // สีแถบป้าย (ไล่เฉด) — เริ่ม
  bannerTo: string; //   — จบ
  icon: string;
  orientation: Orientation;
  children: React.ReactNode;
  artFront?: string | null; // โหมด art: รูปหน้าการ์ดจริง
  artRatio?: string; // สัดส่วนรูปโหมด art (default การ์ดคำถาม/สาระ/AR)
  contentInset?: { top: number; right: number; bottom: number; left: number }; // % ที่วางเนื้อหาทับรูป
}

type Phase = 'back' | 'flipping' | 'front';

export function CardFrame({
  kind,
  title,
  subtitle,
  bannerFrom,
  bannerTo,
  icon,
  orientation,
  children,
  artFront,
  artRatio = '1060 / 1484',
  contentInset = { top: 19, right: 10, bottom: 7, left: 10 },
}: Props) {
  const back = getCardBack(kind);
  const canFlip = !!back && !prefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(canFlip ? 'back' : 'front');
  const didFlip = useRef(canFlip); // ให้หน้าการ์ดแอนิเมชัน "พลิกเข้า" เฉพาะเมื่อมาจากหลังการ์ด

  useEffect(() => {
    if (phase === 'back') {
      const t = setTimeout(() => setPhase('flipping'), 780);
      return () => clearTimeout(t);
    }
    if (phase === 'flipping') {
      const t = setTimeout(() => setPhase('front'), 380);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const isPortrait = orientation === 'portrait';

  // ── หลังการ์ด (รูปจริง) — โชว์ก่อนพลิก ──
  if (back && (phase === 'back' || phase === 'flipping')) {
    return (
      <div style={{ perspective: 1200, display: 'flex', justifyContent: 'center' }}>
        <img
          src={back}
          alt="หลังการ์ด"
          onClick={() => phase === 'back' && setPhase('flipping')}
          style={{
            display: 'block',
            height: 'min(80vh, 640px)',
            maxWidth: '92vw',
            aspectRatio: artRatio,
            objectFit: 'contain',
            borderRadius: 18,
            boxShadow: elevation.modal,
            cursor: 'pointer',
            transformOrigin: 'center',
            animation:
              phase === 'flipping'
                ? 'cardFlipAway .38s ease-in forwards'
                : 'cardBackIdle 2.4s ease-in-out infinite',
          }}
        />
        <style>{FLIP_KEYFRAMES}</style>
      </div>
    );
  }

  // ── โหมด art: รูปหน้าการ์ดจริง + วางเนื้อหาทับ (การ์ดความรู้) ──
  if (artFront) {
    return (
      <div
        style={{
          position: 'relative',
          height: 'min(82vh, 660px)',
          maxWidth: '92vw',
          aspectRatio: artRatio,
          animation: didFlip.current ? 'cardFlipIn .4s ease-out both' : undefined,
        }}
      >
        <img
          src={artFront}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        <div
          style={{
            position: 'absolute',
            top: `${contentInset.top}%`,
            left: `${contentInset.left}%`,
            right: `${contentInset.right}%`,
            bottom: `${contentInset.bottom}%`,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </div>
        <style>{FLIP_KEYFRAMES}</style>
      </div>
    );
  }

  // ── โหมด themed: กรอบทอง + แถบป้ายสี + เนื้อหา DOM ──
  return (
    <div
      style={{
        // ขอบทองไล่เฉด (เลียนกรอบการ์ดจริง) — ใช้ padding เป็นความหนาขอบ
        background: 'linear-gradient(135deg,#F7DE93,#C9A227 42%,#8C6A15 52%,#E9C567 62%,#F7DE93)',
        padding: 5,
        borderRadius: isPortrait ? '22px 22px 0 0' : 22,
        boxShadow: elevation.modal,
        width: isPortrait ? '100%' : 'min(560px, 92vw)',
        maxHeight: '88vh',
        display: 'flex',
        overflow: 'hidden',
        animation: didFlip.current ? 'cardFlipIn .4s ease-out both' : undefined,
        transformOrigin: 'center',
      }}
    >
      <div
        style={{
          flex: 1,
          background: 'linear-gradient(180deg,#FFFDF7,#FBF3E4)',
          borderRadius: isPortrait ? '18px 18px 0 0' : 18,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* แถบป้ายชื่อการ์ด (banner) — โทนสีตามชนิด, เขียนชื่อจริง (ไม่พึ่งตัวหนังสือในรูป) */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            background: `linear-gradient(135deg, ${bannerFrom}, ${bannerTo})`,
            color: '#fff',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            borderBottom: '2px solid rgba(201,162,39,.9)',
            boxShadow: '0 2px 6px rgba(0,0,0,.18)',
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: 19, fontWeight: 800, letterSpacing: 0.2 }}>{title}</strong>
            {subtitle && (
              <span style={{ fontSize: 13, opacity: 0.92, fontWeight: 600 }}>{subtitle}</span>
            )}
          </div>
        </div>
        <div style={{ padding: '18px 20px 22px' }}>{children}</div>
      </div>
      <style>{FLIP_KEYFRAMES}</style>
    </div>
  );
}

const FLIP_KEYFRAMES = `
  @keyframes cardBackIdle{0%,100%{transform:translateY(0) rotateY(0)}50%{transform:translateY(-6px) rotateY(6deg)}}
  @keyframes cardFlipAway{from{transform:rotateY(0);opacity:1}to{transform:rotateY(-92deg);opacity:.15}}
  @keyframes cardFlipIn{from{transform:rotateY(88deg);opacity:.15}to{transform:rotateY(0);opacity:1}}
`;
