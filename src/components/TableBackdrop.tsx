// ชั้นตกแต่งพื้นหลัง — ผืนแผ่นดินอุดมสมบูรณ์: ทุ่งเขียว + สายน้ำ
// วางไว้ "หลัง" กระดานและการ์ด ให้กระดานดูต่อเนื่องเป็นผืนแผ่นดิน ไม่ลอยบนพื้นโล่ง
// SVG/emoji ล้วน (ออฟไลน์ได้) และไม่รับ event (pointerEvents:none)

// ลายใบไม้/ทุ่งจางๆ เป็น texture พื้นทุ่ง
const leaf = `
<svg xmlns='http://www.w3.org/2000/svg' width='70' height='70' viewBox='0 0 70 70'>
  <g fill='#3E7D34' fill-opacity='0.09'>
    <path d='M18 40 C18 30 26 24 34 24 C34 34 26 40 18 40 Z'/>
    <path d='M52 20 C52 12 46 7 40 7 C40 15 46 20 52 20 Z'/>
    <circle cx='55' cy='50' r='2.2'/>
    <circle cx='12' cy='14' r='2.2'/>
  </g>
</svg>`;
const leafUrl = `url("data:image/svg+xml,${encodeURIComponent(leaf)}")`;

// แหล่งน้ำ (บ่อ/แม่น้ำ) ทรงนุ่ม โปร่งแสง — เน้นฝั่งซ้าย/ล่างให้ต่อกับน้ำในภาพกระดาน
interface Water {
  top: string;
  left: string;
  w: number;
  h: number;
  delay: number;
}
const WATERS: Water[] = [
  { top: '78%', left: '8%', w: 380, h: 240, delay: 0 },
  { top: '30%', left: '-4%', w: 260, h: 320, delay: 1.2 },
  { top: '88%', left: '55%', w: 300, h: 160, delay: 0.6 },
];

// ของประดับธรรมชาติ — ทุ่ง/น้ำ (โผล่เฉพาะพื้นที่ว่างขอบจอ)
interface Prop {
  e: string;
  top: string;
  left: string;
  size: number;
  op: number;
  rot: number;
  delay: number;
}
const PROPS: Prop[] = [
  { e: '🌴', top: '12%', left: '3%', size: 52, op: 0.55, rot: -6, delay: 0 },
  { e: '🌳', top: '70%', left: '2%', size: 48, op: 0.5, rot: 0, delay: 0.7 },
  { e: '🪷', top: '84%', left: '11%', size: 40, op: 0.6, rot: 0, delay: 0.3 },
  { e: '🐟', top: '90%', left: '20%', size: 30, op: 0.45, rot: -10, delay: 1.1 },
  { e: '🌾', top: '46%', left: '2%', size: 40, op: 0.5, rot: 0, delay: 1.5 },
  { e: '🐘', top: '5%', left: '48%', size: 40, op: 0.3, rot: 0, delay: 0.9 },
  { e: '🌳', top: '3%', left: '92%', size: 46, op: 0.4, rot: 0, delay: 1.3 },
  { e: '🪷', top: '92%', left: '93%', size: 42, op: 0.5, rot: 0, delay: 0.4 },
  { e: '🪙', top: '60%', left: '97%', size: 30, op: 0.4, rot: 12, delay: 1.0 },
];

export function TableBackdrop() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {/* แหล่งน้ำ (ใต้ texture ทุ่ง) */}
      {WATERS.map((w, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: w.top,
            left: w.left,
            width: w.w,
            height: w.h,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse at 40% 35%, rgba(150,220,225,.75), rgba(90,175,190,.55) 55%, rgba(70,150,175,.2) 100%)',
            filter: 'blur(14px)',
            animation: `waterPulse 6s ease-in-out ${w.delay}s infinite`,
          }}
        />
      ))}

      {/* พื้นผิวทุ่งจาง */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: leafUrl, backgroundSize: '70px 70px' }} />

      {/* วิกเนตต์ให้โฟกัสกลางจอ (กระดาน) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 52%, rgba(30,60,25,.16) 100%)',
        }}
      />

      {/* ของประดับธรรมชาติ (outer = ตำแหน่ง+หมุน, inner = ลอยขึ้นลง) */}
      {PROPS.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: p.top,
            left: p.left,
            opacity: p.op,
            transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.22))',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              fontSize: p.size,
              animation: `floatProp 4s ease-in-out ${p.delay}s infinite`,
            }}
          >
            {p.e}
          </span>
        </span>
      ))}

      <style>{`
        @keyframes floatProp{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes waterPulse{ 0%,100%{opacity:.85;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.04)} }
      `}</style>
    </div>
  );
}
