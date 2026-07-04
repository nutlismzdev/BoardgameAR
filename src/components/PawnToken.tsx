// หมากผู้เล่นแบบ "ลูกเต๋า 3D" (ลูกบาศก์เห็น 3 หน้า) ด้วย CSS 3D transform
// ออกแบบให้เด่นชัดไม่กลืนกับกระดาน + ขนาดพอดีช่องเดิน

// ตำแหน่งจุด (pip) ในตาราง 3x3 สำหรับแต่ละแต้ม 1–6
const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Face({
  value,
  color,
  edge,
  transform,
  bg,
}: {
  value: number;
  color: string;
  edge: number;
  transform: string;
  bg: string;
}) {
  const pips = PIP_LAYOUT[Math.min(6, Math.max(1, value))];
  const pip = edge * 0.15;
  return (
    <div
      style={{
        position: 'absolute',
        width: edge,
        height: edge,
        transform,
        background: bg,
        border: `2px solid ${color}`,
        borderRadius: edge * 0.16,
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        placeItems: 'center',
        padding: edge * 0.12,
      }}
    >
      {Array.from({ length: 9 }).map((_, idx) => {
        const on = pips.some(([pr, pc]) => pr === Math.floor(idx / 3) && pc === idx % 3);
        return (
          <span
            key={idx}
            style={{
              width: pip,
              height: pip,
              borderRadius: '50%',
              background: on ? color : 'transparent',
              boxShadow: on ? 'inset 0 1px 1px rgba(0,0,0,.4)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

export function PawnToken({
  size,
  color,
  value,
}: {
  size: number;
  color: string;
  value: number;
}) {
  const e = size; // ความยาวขอบลูกบาศก์
  const half = e / 2;

  return (
    <div style={{ width: e, height: e, perspective: e * 5 }}>
      <div
        style={{
          position: 'relative',
          width: e,
          height: e,
          transformStyle: 'preserve-3d',
          // เอียงให้เห็น 3 หน้า (บน–หน้า–ข้าง)
          transform: `rotateX(-24deg) rotateY(32deg)`,
          filter: 'drop-shadow(0 4px 5px rgba(0,0,0,.5))',
        }}
      >
        {/* หน้าหน้า (หันเข้าหาผู้เล่นมากสุด) — โชว์แต้มที่ทอยได้จริง */}
        <Face value={value} color={color} edge={e} bg="#ffffff"
          transform={`translateZ(${half}px)`} />
        {/* หน้าบน (โทนกลาง) — โชว์แต้มจริงด้วย ให้เห็นได้ทั้งสองมุม */}
        <Face value={value} color={color} edge={e} bg="#f2f2f2"
          transform={`rotateX(90deg) translateZ(${half}px)`} />
        {/* หน้าขวา (เข้มสุด ให้ดูมีมิติ — จุดตกแต่ง) */}
        <Face value={2} color={color} edge={e} bg="#dcdcdc"
          transform={`rotateY(90deg) translateZ(${half}px)`} />
      </div>
    </div>
  );
}
