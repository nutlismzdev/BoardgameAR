import { getKingPawnImage } from '@/core/kingAssets';

export function KingPawnToken({
  kingId,
  size,
  label,
}: {
  kingId: string;
  size: number;
  label?: string;
}) {
  const tokenHeight = size;
  const tokenWidth = size * 0.62;

  return (
    <div
      title={label}
      style={{
        width: tokenWidth,
        height: tokenHeight,
        position: 'relative',
        display: 'grid',
        placeItems: 'end center',
        filter: 'drop-shadow(0 4px 4px rgba(0,0,0,.38))',
      }}
    >
      <img
        src={getKingPawnImage(kingId)}
        alt={label ?? 'หมากกษัตริย์'}
        draggable={false}
        style={{
          width: 'auto',
          height: '100%',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block',
          transformOrigin: '50% 100%',
        }}
      />
    </div>
  );
}
