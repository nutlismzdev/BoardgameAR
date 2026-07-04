import { useState } from 'react';
import { useGame, TILES, LOOP } from '@/core/store';
import boardPoints from '@/data/board-points.json';
import { color, radius, tileIcon, tileColor, tileLabel } from '@/theme/tokens';
import { KingPawnToken } from './KingPawnToken';

interface Pt {
  x: number;
  y: number;
}
const POINTS = boardPoints.points as Pt[];
const IMAGE = boardPoints.image as string;
const ASPECT = '1489 / 1046'; // สัดส่วนภาพกระดาน (กว้าง:สูง)

// กระดานแบบใช้ภาพเป็นพระเอก + วางหมากผู้เล่นทับตามพิกัดช่อง (%)
// รองรับ "โหมดปรับตำแหน่งช่อง" (calibration) สำหรับจับพิกัดให้ตรงภาพจริง
export function BoardImage({ size }: { size: number }) {
  const players = useGame((s) => s.players);
  const currentIdx = useGame((s) => s.currentPlayerIndex);
  const calibrate = useGame((s) => s.settings.calibrate);
  const showTileIcons = useGame((s) => s.settings.showTileIcons);
  const [loaded, setLoaded] = useState(false);

  const currentPos = players[currentIdx]?.position ?? 0;
  // ภาพหมากทั้ง 7 ไฟล์สูงไม่เท่ากัน จึงกำหนด size เป็น "ความสูง" ให้ทุกตัวเท่ากัน
  const pawn = Math.max(26, size * 0.038);

  return (
    <div
      style={{
        width: size,
        maxWidth: '100%',
        maxHeight: '100%',
        aspectRatio: ASPECT,
        position: 'relative',
        // ขอบโค้งบางลง + เงานุ่มให้กระดาน "ลอย" ดูพรีเมียมเหมือนวางบนโต๊ะ
        borderRadius: 10,
        overflow: 'hidden',
        background: '#e9dcc2',
        boxShadow: '0 14px 40px rgba(70,45,15,.35), 0 2px 6px rgba(0,0,0,.2)',
      }}
    >
      {/* Loading skeleton — กันจอว่าง/เลย์เอาต์กระตุกระหว่างโหลดภาพ */}
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color.textMuted,
            fontSize: 18,
          }}
        >
          🏛️ กำลังโหลดกระดาน…
        </div>
      )}

      <img
        src={IMAGE}
        alt="กระดาน 7 มหาราช"
        onLoad={() => setLoaded(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity .3s',
        }}
      />

      {!calibrate &&
        loaded &&
        POINTS.map((pt, i) => {
          const occupants = players.filter((p) => p.position === i);
          const isCurrentTile = i === currentPos;
          const tile = TILES[i];
          const hasIcon = tile && tile.type !== 'blank';
          const showIcon = showTileIcons && hasIcon;
          return (
            <div key={i}>
              {/* เลขช่อง — โชว์เฉพาะช่องที่ไม่มีไอคอน (ช่องเดินเปล่า); ช่องพิเศษโชว์ไอคอนแทน */}
              {!showIcon && i < LOOP && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${pt.x}%`,
                    top: `${pt.y}%`,
                    transform: 'translate(-50%, -50%)',
                    minWidth: pawn * 0.5,
                    height: pawn * 0.5,
                    padding: '0 3px',
                    borderRadius: pawn * 0.25,
                    background: 'rgba(255,255,255,.82)',
                    color: '#6B4E1E',
                    fontSize: pawn * 0.32,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {i}
                </div>
              )}
              {/* ไอคอนบอกชนิดช่อง — ให้รู้ว่าช่องนั้นเป็นเกมอะไร (คำถาม/เหรียญ/ฯลฯ) */}
              {showIcon && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${pt.x}%`,
                    top: `${pt.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: pawn * 0.82,
                    height: pawn * 0.82,
                    borderRadius: '50%',
                    background: '#fff',
                    border: `2.5px solid ${tileColor[tile.type]}`,
                    boxShadow: '0 2px 5px rgba(0,0,0,.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: pawn * 0.44,
                    pointerEvents: 'none',
                  }}
                  title={tileLabel[tile.type]}
                >
                  {tileIcon[tile.type]}
                </div>
              )}
              {/* วงแหวนพัลส์ช่องปัจจุบัน — ช่วยเด็กเห็นว่าตัวเองอยู่ไหน */}
              {isCurrentTile && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${pt.x}%`,
                    top: `${pt.y}%`,
                    width: pawn * 1.5,
                    height: pawn * 1.5,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    border: `3px solid ${color.secondary}`,
                    animation: 'tilePulse 1.2s ease-in-out infinite',
                    pointerEvents: 'none',
                  }}
                />
              )}
              {/* หมากผู้เล่น — standee กษัตริย์ที่เลือกจากหน้าเริ่มเกม */}
              {occupants.length > 0 && (
                <>
                  {/* เงาทอดพื้นบนช่อง (บอกว่าหมากลอยอยู่) */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${pt.x}%`,
                      top: `${pt.y}%`,
                      width: pawn * 0.8,
                      height: pawn * 0.28,
                      transform: 'translate(-50%, -10%)',
                      transition: 'left .18s, top .18s',
                      borderRadius: '50%',
                      background: 'radial-gradient(ellipse, rgba(0,0,0,.4), transparent 70%)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: `${pt.x}%`,
                      top: `${pt.y}%`,
                      transform: 'translate(-50%, -78%)',
                      transition: 'left .18s, top .18s',
                      pointerEvents: 'none',
                      display: 'flex',
                      gap: 3,
                    }}
                  >
                    {occupants.map((p) => (
                      <div key={p.id} style={{ animation: 'pawnBounce 1.6s ease-in-out infinite' }}>
                        <KingPawnToken kingId={p.kingTokenId} size={pawn} label={`${p.name} ${p.token}`} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}

      {calibrate && <Calibrator />}

      <style>{`
        @keyframes pawnBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes tilePulse{0%,100%{opacity:.35;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}}
      `}</style>
    </div>
  );
}

// ── โหมดปรับตำแหน่งช่อง: โชว์เลข 0–N ที่จุดที่บันทึกไว้ + ลากขยับให้ตรงเป๊ะ ──
// โหมด "ลาก" = แก้จุดเดิม · โหมด "เพิ่ม" = แตะเพื่อเพิ่มจุดใหม่ต่อท้าย
function Calibrator() {
  const [pts, setPts] = useState<Pt[]>(() => POINTS.map((p) => ({ ...p })));
  const [drag, setDrag] = useState<number | null>(null);
  const [addMode, setAddMode] = useState(false);

  const toPct = (e: { clientX: number; clientY: number }, el: HTMLDivElement) => {
    const r = el.getBoundingClientRect();
    return {
      x: +Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)).toFixed(2),
      y: +Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)).toFixed(2),
    };
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const p = toPct(e, e.currentTarget);
    setPts((arr) => arr.map((pt, i) => (i === drag ? p : pt)));
  };

  const onClickBg = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!addMode) return;
    if (e.target !== e.currentTarget) return; // แตะพื้นว่างเท่านั้น
    const p = toPct(e, e.currentTarget);
    setPts((arr) => [...arr, p]);
  };

  const json = JSON.stringify({ points: pts }, null, 2);

  return (
    <>
      <div
        onPointerMove={onMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
        onClick={onClickBg}
        style={{
          position: 'absolute',
          inset: 0,
          cursor: addMode ? 'crosshair' : 'default',
          background: 'rgba(0,0,0,.04)',
          touchAction: 'none',
        }}
      >
        {pts.map((pt, i) => (
          <div
            key={i}
            onPointerDown={(e) => {
              if (addMode) return;
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag(i);
            }}
            style={{
              position: 'absolute',
              left: `${pt.x}%`,
              top: `${pt.y}%`,
              transform: 'translate(-50%, -50%)',
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: drag === i ? color.success : color.primary,
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #fff',
              boxShadow: '0 2px 5px rgba(0,0,0,.4)',
              cursor: addMode ? 'crosshair' : 'grab',
              touchAction: 'none',
            }}
          >
            {i}
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          right: 6,
          background: 'rgba(255,255,255,.95)',
          borderRadius: radius.sm,
          padding: 8,
          fontSize: 13,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <strong>{addMode ? 'แตะเพื่อเพิ่มจุด' : 'ลากเลขให้ตรงช่อง'}</strong>
        <span>{pts.length} จุด</span>
        <button
          onClick={() => setAddMode((v) => !v)}
          style={{ ...miniBtn, background: addMode ? color.info : '#fff', color: addMode ? '#fff' : color.text }}
        >
          {addMode ? '✋ โหมดลาก' : '➕ โหมดเพิ่ม'}
        </button>
        <button onClick={() => setPts((p) => p.slice(0, -1))} style={miniBtn}>
          ↩︎ ลบจุดท้าย
        </button>
        <button onClick={() => setPts(POINTS.map((p) => ({ ...p })))} style={miniBtn}>
          ⟲ รีเซ็ตค่าเดิม
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(json)}
          style={{ ...miniBtn, background: color.success, color: '#fff' }}
        >
          📋 คัดลอก JSON
        </button>
      </div>
    </>
  );
}

const miniBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
  padding: '6px 10px',
  borderRadius: radius.sm,
  border: `1px solid ${color.secondary}`,
  background: '#fff',
  cursor: 'pointer',
};
