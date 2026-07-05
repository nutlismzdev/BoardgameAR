import { KINGS } from '@/core/content';
import { getKingCoinImage } from '@/core/kingAssets';

// แถวช่องเก็บเหรียญกษัตริย์ 7 พระองค์ (เรียงตามลำดับเวลา)
// ได้แล้ว = ช่องทองสว่าง+เรืองแสง · ยังไม่ได้ = ช่องว่างเส้นประ + เหรียญจาง
// ใช้ซ้ำได้ทั้ง HUD บนกระดาน และหน้าสรุปผล
export function KingCoinRow({
  collected,
  size = 22,
  gap = 4,
}: {
  collected: string[];
  size?: number;
  gap?: number;
}) {
  return (
    <div style={{ display: 'flex', gap, alignItems: 'center' }}>
      {KINGS.map((k) => {
        const has = collected.includes(k.id);
        return (
          <div
            key={k.id}
            title={k.name.split('(')[0].trim()}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              background: has
                ? 'radial-gradient(circle at 35% 30%, #FFF4C4, #E9B93C)'
                : 'rgba(0,0,0,.06)',
              border: has ? '1px solid rgba(255,255,255,.85)' : '1px dashed rgba(90,60,20,.35)',
              boxShadow: has
                ? '0 0 5px rgba(255,193,7,.9), inset 0 1px 1px rgba(255,255,255,.7)'
                : 'inset 0 1px 2px rgba(0,0,0,.12)',
              transition: 'all .3s',
            }}
          >
            <img
              src={getKingCoinImage(k.id)}
              alt=""
              draggable={false}
              style={{
                width: '88%',
                height: '88%',
                objectFit: 'contain',
                display: 'block',
                filter: has ? 'none' : 'grayscale(1) opacity(.28)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
