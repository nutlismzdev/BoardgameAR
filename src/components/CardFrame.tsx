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
  // มาจากด่านจั่วการ์ด (CardPicker) ที่โชว์หลังการ์ด + พลิกหนีมาแล้ว → ข้ามพิธีพลิกซ้ำ
  // เหลือแค่ "พลิกเข้า" รับไม้ต่อ ไม่งั้นเห็นหลังการ์ดสองรอบ (หลัง→หลัง→เนื้อหา)
  skipBackFlip?: boolean;
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
  skipBackFlip = false,
}: Props) {
  const back = getCardBack(kind);
  const canFlip = !!back && !prefersReducedMotion() && !skipBackFlip;
  const [phase, setPhase] = useState<Phase>(canFlip ? 'back' : 'front');
  // พลิกเข้าเมื่อมาจากหลังการ์ดของตัวเอง หรือรับไม้ต่อจากใบที่ picker พลิกหนีมา
  const didFlip = useRef(canFlip || (skipBackFlip && !prefersReducedMotion()));
  const [backReady, setBackReady] = useState(false); // รูปหลังการ์ดโหลด/decode เสร็จหรือยัง

  // preload รูปหลังการ์ด (ไฟล์ใหญ่) ให้พร้อมก่อนเริ่มพลิก — กันการ์ดว่าง/ลอยตอนโหลดไม่ทัน
  useEffect(() => {
    if (!back) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setBackReady(true);
    };
    const img = new Image();
    img.onload = finish;
    img.onerror = finish; // รูปพัง = ไม่ค้าง เดินหน้าต่อ
    img.src = back;
    if (img.complete) finish(); // กรณี cache แล้ว (onload อาจไม่ยิงใน React)
    const safety = setTimeout(finish, 1500); // เพดานกันค้างถ้ารูปช้ามาก
    return () => clearTimeout(safety);
  }, [back]);

  // preload รูปหน้าโหมด art ตั้งแต่ตอนโชว์หลังการ์ด → พร้อมเผยทันทีตอนพลิกเสร็จ (ไม่ pop-in)
  useEffect(() => {
    if (!artFront) return;
    const img = new Image();
    img.src = artFront;
  }, [artFront]);

  useEffect(() => {
    if (phase === 'back') {
      if (!backReady) return; // รอรูปหลังการ์ดพร้อมก่อนค่อยเริ่มพลิก
      const t = setTimeout(() => setPhase('flipping'), 780);
      return () => clearTimeout(t);
    }
    if (phase === 'flipping') {
      const t = setTimeout(() => setPhase('front'), 380);
      return () => clearTimeout(t);
    }
  }, [phase, backReady]);

  const isPortrait = orientation === 'portrait';

  // ── หลังการ์ด (รูปจริง) — โชว์ก่อนพลิก ──
  if (back && (phase === 'back' || phase === 'flipping')) {
    return (
      <div style={{ perspective: 1200, display: 'flex', justifyContent: 'center' }}>
        <img
          src={back}
          alt="หลังการ์ด"
          decoding="async"
          onClick={() => phase === 'back' && backReady && setPhase('flipping')}
          style={{
            display: 'block',
            height: 'min(80vh, 640px)',
            maxWidth: '92vw',
            aspectRatio: artRatio,
            objectFit: 'contain',
            borderRadius: 18,
            background: 'rgba(233,220,194,.6)', // พื้น placeholder — กันการ์ดว่าง/ลอยระหว่างรูปยังโหลด
            boxShadow: elevation.modal,
            cursor: backReady ? 'pointer' : 'default',
            transformOrigin: 'center',
            // เริ่มลอยเชิญแตะ "หลังรูปพร้อม" เท่านั้น (ก่อนพร้อมอยู่นิ่ง ไม่ลอยทั้งที่ว่าง)
            animation:
              phase === 'flipping'
                ? 'cardFlipAway .38s ease-in forwards'
                : backReady
                ? 'cardBackIdle 2.4s ease-in-out infinite'
                : undefined,
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
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            background: 'rgba(233,220,194,.5)', // พื้น placeholder กัน pop-in ตอนรูปยังโหลด
          }}
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
