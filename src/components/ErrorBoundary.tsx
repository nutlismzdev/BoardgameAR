import { Component, type ReactNode } from 'react';

// ตาข่ายกันจอขาว — ถ้ามี render error ที่ไหนก็ตาม แสดงหน้าขอโทษ + ปุ่มโหลดใหม่
// (ไม่มีตัวนี้ = throw กลาง render ทำให้ทั้งเกมเป็นจอขาว)
interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown) {
    // log ไว้ให้ครู/dev เห็นใน console (ไม่ส่งไปไหน)
    console.error('[BoardGameAR] render error:', err);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          background: 'linear-gradient(160deg, #AEC983, #6BA8C0)',
          color: '#3a2a10',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: 56 }}>🐘💤</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>อุ๊ปส์ เกมสะดุดนิดหน่อย</h1>
        <p style={{ fontSize: 18, fontWeight: 700, maxWidth: 420, lineHeight: 1.5, margin: 0 }}>
          ลองโหลดใหม่อีกครั้งได้เลย — ความคืบหน้ารอบนี้อาจต้องเริ่มใหม่
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            fontFamily: 'inherit',
            fontSize: 20,
            fontWeight: 800,
            color: '#fff',
            background: '#8B0000',
            border: 'none',
            borderRadius: 999,
            padding: '14px 32px',
            minHeight: 56,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(139,0,0,.4)',
          }}
        >
          🔄 โหลดเกมใหม่
        </button>
      </div>
    );
  }
}
