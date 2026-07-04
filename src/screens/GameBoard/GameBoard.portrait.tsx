import { color } from '@/theme/tokens';

// ── แนวตั้ง = หน้านัดให้หมุนเป็นแนวนอน ──
// ภาพกระดานเป็นแนวนอน เกมจะเด่นและเล่นสนุกสุดในแนวนอน (state ในเกมยังคงอยู่ครบ)
export function GameBoardPortrait() {
  return (
    <div
      style={{
        height: '100dvh',
        background: color.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 16,
        padding: 32,
      }}
    >
      <div style={{ fontSize: 96, animation: 'rotateHint 2.4s ease-in-out infinite' }}>📱</div>
      <h2 style={{ fontSize: 28, color: color.primary, margin: 0 }}>หมุนแท็บเล็ตเป็นแนวนอน</h2>
      <p style={{ fontSize: 18, color: color.textMuted, maxWidth: 360, margin: 0 }}>
        เกมนี้เล่นสนุกที่สุดในแนวนอน 🏛️ กระดาน 7 มหาราชจะเต็มจอ เห็นทุกช่องชัดเจน
      </p>
      <style>{`
        @keyframes rotateHint{
          0%,40%{transform:rotate(0deg)}
          60%,100%{transform:rotate(90deg)}
        }
      `}</style>
    </div>
  );
}
