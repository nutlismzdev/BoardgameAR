import { getKingPawnImage } from '@/core/kingAssets';

// หมาก standee กษัตริย์ — บังคับขนาด width+height เป็น px ทั้งคู่บน <img> โดยตรง
// (ห้ามใช้ height:100% ในกล่อง grid/flex เพราะ iOS Safari บางเวอร์ชันจะเรนเดอร์ที่ขนาดจริงของไฟล์
//  ทำให้รูปทะลุกล่อง + หลุดตำแหน่งบนกระดาน) · ภาพจริงเป็น portrait สูง (aspect ~0.34)
export function KingPawnToken({
  kingId,
  size,
  label,
}: {
  kingId: string;
  size: number;
  label?: string;
}) {
  return (
    <img
      src={getKingPawnImage(kingId)}
      alt={label ?? 'หมากกษัตริย์'}
      title={label}
      draggable={false}
      style={{
        width: size * 0.5,
        height: size,
        objectFit: 'contain',
        objectPosition: 'center bottom',
        display: 'block',
        filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.38))',
        pointerEvents: 'none',
      }}
    />
  );
}
