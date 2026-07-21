import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import QRCode from 'qrcode';
import { AR } from '@/ar/arConfig';
import { getKingArCardImage } from '@/core/kingAssets';
import type { King, Orientation, QuizCard } from '@/core/types';

// ── สเตจ "ส่องการ์ดทองด้วยมือถือ AR" (คั่นระหว่างจั่วการ์ดกับตอบคำถาม) ──
//
// หน้าที่เดียวของจอนี้: สอน "พิธี 2 เครื่อง" ให้ถูกลำดับ
//   ๑ สแกน QR ด้วยมือถืออีกเครื่อง → เปิดเว็บ AR ภายนอก (MyWebAR)
//   ๒ เอามือถือเครื่องนั้นส่องภาพการ์ดบนจอนี้ → ดูเรื่องราว/เบาะแส
//   แล้วกด "เสร็จสิ้น" → เกมค่อยขึ้น QR ของคำถาม (คนละ QR กัน)
//
// จึงวางเป็น "แผ่นป้าย 2 แผ่นเรียงซ้าย→ขวา" ตามลำดับที่ต้องทำจริง คั่นด้วยเส้นทองหัวลูกศร
// เลขลำดับใช้ตัวเลขไทยในตราวงกลม (ชุดเดียวกับตรา "๗" ที่ ar.html ใช้) — ลำดับตรงนี้
// เป็นข้อมูลจริง (ทำผิดลำดับแล้วส่องไม่ได้) ไม่ใช่ของประดับ
//
// **เป็น UI gate ล้วน ไม่แตะ store** (เหมือน CardPicker) — เกมไม่รู้และไม่ต้องรู้ว่าเด็กส่องจริงไหม
// เว็บ AR ภายนอกจึงไม่ต้องเชื่อมกับเกมเลย ไม่มี challenge id วิ่งข้ามไป-กลับ
export function GoldCardReveal({
  king,
  quiz,
  orientation,
  onDone,
  onCancel,
}: {
  king: King;
  quiz: QuizCard;
  orientation: Orientation;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const src = getKingArCardImage(king.id);
  const [imgFailed, setImgFailed] = useState(false);
  const [qr, setQr] = useState('');
  // ขยายการ์ด = "เปิดเว็บ AR แล้ว ขอที่ว่างไว้เล็ง" → ซ่อนแผ่น QR ทิ้งไปเลย
  // (ขั้น ๑ จบแล้ว ไม่ต้องกินพื้นที่ของขั้น ๒ อีก) การ์ดยิ่งใหญ่ = มือถือจับภาพติดง่ายขึ้น
  const [zoom, setZoom] = useState(false);
  const showImage = !!src && !imgFailed;
  const row = orientation === 'landscape';

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(AR.webArUrl, {
      width: 512,
      margin: 4, // quiet zone ตาม ISO/IEC 18004 (อย่างน้อย 4 modules)
      errorCorrectionLevel: 'M',
      color: { dark: '#1A0D04', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr('');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ⚠️ โหมดขยายต้องใช้ absolute + inset:0 ห้ามใช้ maxHeight:'100%'
  // เปอร์เซ็นต์ความสูงจะ resolve ไม่ได้เมื่อพ่อแม่สูงแบบ flex/auto (indefinite height) →
  // เบราว์เซอร์ถอยไปใช้ขนาดจริงของไฟล์ (709×1063) แล้วล้นกรอบจนโดน overflow:hidden ตัด
  // absolute inset:0 เทียบกับพ่อแม่ที่ position:relative จึงได้ความสูงที่แน่นอนเสมอ
  const cardArt = (zoomed: boolean) =>
    showImage ? (
    <img
      src={src}
      alt={`การ์ด AR ${king.name}`}
      style={zoomed ? zoomImage : cardImage}
      onError={() => setImgFailed(true)}
    />
  ) : (
    // ยังไม่มีไฟล์การ์ดของพระองค์นี้ (หรือโหลดไม่ขึ้น) — โชว์คำถามเป็นข้อความแทน
    // เกมต้องเดินต่อได้เสมอ ห้ามค้างเพราะรูปหาย
    <div style={fallbackCard}>
      <div style={fallbackTag}>ภารกิจ ๗ มหาราช</div>
      <p style={fallbackQuestion}>{quiz.question}</p>
      <p style={fallbackNote}>ยังไม่มีภาพการ์ดของพระองค์นี้</p>
    </div>
  );


  return (
    <div style={shell}>
      <style>{REVEAL_CSS}</style>
      <section style={frame}>
        <header style={head}>
          <div style={eyebrow}>การ์ด AR ทอง</div>
          <h2 style={title}>{king.name}</h2>
        </header>

        {zoom ? (
          <div style={zoomStage}>
            <div style={zoomArt}>{cardArt(true)}</div>
            <button type="button" style={zoomOutButton} onClick={() => setZoom(false)}>
              ย่อการ์ดลง
            </button>
          </div>
        ) : (
          <div style={{ ...plates, flexDirection: row ? 'row' : 'column' }}>
            <Plate step="๑" caption="สแกนด้วยมือถือ เพื่อเปิดเว็บ AR">
              {qr ? (
                <img src={qr} alt="QR เปิดเว็บ AR" style={qrImage} />
              ) : (
                <div style={qrPending}>กำลังสร้าง QR…</div>
              )}
            </Plate>

            <div style={{ ...link, transform: row ? undefined : 'rotate(90deg)' }} aria-hidden>
              <span style={linkRule} />
              <span style={linkHead}>▶</span>
            </div>

            <Plate step="๒" caption="ส่องมือถือไปที่การ์ดใบนี้">
              {/* ปุ่มขยายมีเฉพาะตอนมีภาพจริง — ขยายข้อความ fallback ไม่ได้ช่วยอะไร */}
              {showImage ? (
                <button
                  type="button"
                  className="gcr-zoomable"
                  style={cardButton}
                  onClick={() => setZoom(true)}
                  aria-label="ขยายการ์ดให้ใหญ่ขึ้นเพื่อส่อง AR"
                >
                  {cardArt(false)}
                  <span style={zoomBadge}>⤢ ขยาย</span>
                </button>
              ) : (
                cardArt(false)
              )}
            </Plate>
          </div>
        )}

        <footer style={foot}>
          <button type="button" style={doneButton} onClick={onDone}>
            เสร็จสิ้น → ไปตอบคำถาม
          </button>
          {onCancel ? (
            <button type="button" style={skipButton} onClick={onCancel}>
              ข้ามการ์ดนี้
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function Plate({ step, caption, children }: { step: string; caption: string; children: React.ReactNode }) {
  return (
    <figure style={plate}>
      <span style={seal}>{step}</span>
      <div style={plateMedia}>{children}</div>
      <figcaption style={plateCaption}>{caption}</figcaption>
    </figure>
  );
}

const REVEAL_CSS = `
.gcr-zoomable{transition:transform .18s ease}
.gcr-zoomable:active{transform:scale(.98)}
@media (prefers-reduced-motion: reduce){.gcr-zoomable{transition:none}}
`;

const shell: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200, // เหนือการ์ด (100) / ตราประทับ (130) แต่ใต้ AR เต็มจอ (300)
  display: 'grid',
  placeItems: 'center',
  padding: 'clamp(8px, 2vh, 18px)',
  background: 'radial-gradient(circle at 50% 35%, #2A1608 0%, #120801 100%)',
};

const frame: CSSProperties = {
  width: 'min(920px, 100%)',
  maxHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'clamp(10px, 2vh, 18px)',
  padding: 'clamp(12px, 2.4vh, 22px) clamp(14px, 2vw, 26px)',
  // ขอบทองคู่ = กรอบใบบอก/ประกาศ ให้เข้าชุดกับตราวงกลมของเกม
  border: '1px solid rgba(201,162,39,.55)',
  borderRadius: 14,
  background: 'linear-gradient(180deg, rgba(255,249,232,.05), rgba(255,249,232,.015))',
  overflow: 'hidden',
};

const head: CSSProperties = {
  textAlign: 'center',
  flexShrink: 0,
};

const eyebrow: CSSProperties = {
  color: '#C9A227',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '.14em',
};

const title: CSSProperties = {
  margin: '4px 0 0',
  color: '#FFF8E7',
  fontSize: 'clamp(16px, 2.1vw, 22px)',
  lineHeight: 1.3,
  fontWeight: 800,
};

const plates: CSSProperties = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'clamp(8px, 1.6vw, 18px)',
};

const plate: CSSProperties = {
  margin: 0,
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
};

// ตราเลขไทย — ชุดเดียวกับตรา "๗" ที่หน้ามือถือใช้ (วงกลมชาด ขอบทองคู่)
const seal: CSSProperties = {
  width: 30,
  height: 30,
  flexShrink: 0,
  display: 'grid',
  placeItems: 'center',
  color: '#FFF9E8',
  background: '#8B0000',
  border: '2px double #E6C35C',
  borderRadius: '50%',
  fontFamily: 'serif',
  fontSize: 16,
  fontWeight: 800,
};

const plateMedia: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  placeItems: 'center',
};

const plateCaption: CSSProperties = {
  color: '#B9A783',
  fontSize: 'clamp(11px, 1.2vw, 13px)',
  fontWeight: 700,
  textAlign: 'center',
};

// การ์ด "ขนาดอ้างอิง" — บอกว่าจั่วได้ใบไหน ไม่ใช่ครองทั้งจอ
// ต้องการใหญ่กว่านี้เพื่อส่อง AR → แตะที่การ์ด (zoom) ซึ่งขยายเต็มกรอบให้
const cardImage: CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  maxHeight: 'clamp(170px, 30vh, 250px)',
  objectFit: 'contain',
  borderRadius: 8,
  // เงาเรืองทองรอบการ์ด ช่วยให้ขอบตัดกับพื้นหลังเข้ม = มือถือจับขอบภาพได้ง่ายขึ้น
  boxShadow: '0 0 0 1.5px rgba(230,195,92,.5), 0 10px 26px rgba(0,0,0,.55)',
};

const cardButton: CSSProperties = {
  position: 'relative',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  lineHeight: 0,
};

const zoomBadge: CSSProperties = {
  position: 'absolute',
  right: 6,
  bottom: 6,
  padding: '3px 8px',
  color: '#2A1608',
  background: 'rgba(240,206,106,.94)',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  lineHeight: 1.6,
  pointerEvents: 'none',
};

const qrImage: CSSProperties = {
  display: 'block',
  width: 'clamp(140px, 24vh, 200px)',
  height: 'clamp(140px, 24vh, 200px)',
  borderRadius: 8,
  background: '#fff',
};

const qrPending: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 'clamp(140px, 24vh, 200px)',
  height: 'clamp(140px, 24vh, 200px)',
  color: '#8A7350',
  background: 'rgba(255,249,232,.08)',
  border: '1px dashed rgba(201,162,39,.4)',
  borderRadius: 8,
  fontSize: 13,
};

// เส้นทองเชื่อม 2 แผ่น = ลำดับการทำ (สแกนก่อน แล้วค่อยส่อง)
const link: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  color: '#C9A227',
};

const linkRule: CSSProperties = {
  width: 'clamp(14px, 2.4vw, 34px)',
  height: 1,
  background: 'linear-gradient(90deg, rgba(201,162,39,0), #C9A227)',
};

const linkHead: CSSProperties = {
  fontSize: 10,
  lineHeight: 1,
};

// โหมดขยาย — การ์ดกินกรอบทั้งหมด (แผ่น QR ถูกซ่อน เพราะขั้น ๑ ผ่านไปแล้ว)
const zoomStage: CSSProperties = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
};

// position:relative = จุดอ้างอิงของรูปที่ absolute — ตัวนี้คือคนกำหนดขนาดจริงของการ์ดในโหมดขยาย
// ⚠️ ต้องมี minHeight เป็นหน่วยที่แน่นอน (vh) ห้ามพึ่ง flex:1 อย่างเดียว:
// `frame` สูงตามเนื้อหา (ไม่ได้ height:100%) → คอลัมน์ไม่มี free space ให้ flex-grow แจก
// และลูกทั้งหมดเป็น absolute (ไม่นับความสูงเนื้อหา) → กล่องจะยุบเหลือ 0 การ์ดหายทั้งใบ
const zoomArt: CSSProperties = {
  flex: 1,
  minHeight: 'min(56vh, 420px)',
  width: '100%',
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
};

const zoomImage: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  borderRadius: 8,
  filter: 'drop-shadow(0 8px 22px rgba(0,0,0,.55))',
};

const zoomOutButton: CSSProperties = {
  flexShrink: 0,
  padding: '5px 16px',
  color: '#B9A783',
  background: 'transparent',
  border: '1px solid rgba(185,167,131,.35)',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const foot: CSSProperties = {
  width: 'min(420px, 100%)',
  flexShrink: 0,
};

const doneButton: CSSProperties = {
  width: '100%',
  minHeight: 50,
  padding: '12px 18px',
  color: '#2A1608',
  background: 'linear-gradient(180deg, #F0CE6A, #C9A227)',
  border: '1px solid #A8851E',
  borderRadius: 8,
  fontSize: 17,
  fontWeight: 800,
  cursor: 'pointer',
};

const skipButton: CSSProperties = {
  width: '100%',
  minHeight: 34,
  marginTop: 8,
  padding: '6px 14px',
  color: '#9C8C6E',
  background: 'transparent',
  border: 'none',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const fallbackCard: CSSProperties = {
  width: 'min(300px, 100%)',
  padding: '18px 16px',
  textAlign: 'center',
  color: '#2A2118',
  background: '#FFF9E8',
  border: '2px solid #C89B30',
  borderRadius: 8,
};

const fallbackTag: CSSProperties = {
  color: '#8B0000',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 8,
};

const fallbackQuestion: CSSProperties = {
  margin: 0,
  fontSize: 16,
  lineHeight: 1.55,
  fontWeight: 700,
};

const fallbackNote: CSSProperties = {
  margin: '10px 0 0',
  color: '#8A7350',
  fontSize: 12,
};
