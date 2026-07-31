import { useEffect, useState } from 'react';
import { useGame, clampTargetCoins } from '@/core/store';
import type { Settings } from '@/core/store';
import { AdminPanel } from '@/screens/Admin/AdminPanel';
import { adminLoginAvailable, hasAdminToken, login } from '@/core/api';
import { color, radius, elevation } from '@/theme/tokens';
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  isStandalone,
  fullscreenSupported,
} from '@/core/viewportLock';

// โหมดครู (Teacher Mode) — ตั้งค่าเกมก่อนเริ่ม
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useGame((s) => s.settings);
  const update = useGame((s) => s.updateSettings);
  const inRoom = useGame((s) => !!s.room); // อยู่ในห้องแข่ง = กติกาถูกล็อกจากห้อง
  const [adminOpen, setAdminOpen] = useState(false);
  // ── โหมดครูถูกล็อกไว้หลังรหัส ──
  // เดิมสวิตช์ทั้งหมดเปิดโล่ง เด็กที่หยิบแท็บเล็ตไปกดปิดตัวจับเวลา/ลดเป้าเหรียญ/เปิดโหมดนำเสนอได้เอง
  // ⚠️ ล็อกได้เฉพาะตอนมี backend ให้ล็อกอิน — ไม่งั้นครูจะเข้าตั้งค่าไม่ได้เลยตลอดกาล
  const gated = adminLoginAvailable();
  const [loggedIn, setLoggedIn] = useState(() => !gated || hasAdminToken());
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const doLogin = async () => {
    setAuthError('');
    setAuthBusy(true);
    try {
      await login(password);
      setLoggedIn(true);
    } catch {
      setAuthError('รหัสไม่ถูกต้อง');
    } finally {
      setAuthBusy(false);
    }
  };

  // เต็มจอเป็นสถานะของเครื่อง ไม่ใช่ settings ที่ persist — อ่านจากเบราว์เซอร์ตรง ๆ
  // (ผู้ใช้กด Esc / ปัดออกเองได้ ต้องตามให้ทัน) · ติดตั้งเป็น PWA แล้วเต็มจออยู่แล้ว ไม่ต้องโชว์
  const [fullscreen, setFullscreen] = useState(isFullscreen);
  useEffect(() => {
    const sync = () => setFullscreen(isFullscreen());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const showFullscreenToggle = fullscreenSupported() && !isStandalone();

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 150,
          padding: 20,
        }}
      >
        <div
          style={{
            background: color.surface,
            borderRadius: radius.lg,
            boxShadow: elevation.modal,
            width: 'min(520px, 94vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 24, color: color.primary, marginTop: 0 }}>⚙️ โหมดครู</h2>
          <p style={{ color: color.textMuted, marginTop: -8, fontSize: 17 }}>
            ตั้งค่าให้เหมาะกับชั้นเรียน
          </p>

        {/* ── ประตูรหัสครู ── ยังไม่ล็อกอิน = ไม่เห็นสวิตช์อะไรเลย */}
        {!loggedIn ? (
          <div style={{ display: 'grid', gap: 12, margin: '10px 0 4px' }}>
            <div style={lockedNote}>🔒 ต้องใส่รหัสครูก่อนจึงจะเห็นและแก้การตั้งค่าได้</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void doLogin()}
              placeholder="รหัสครู"
              style={{
                fontFamily: 'inherit',
                fontSize: 18,
                padding: '12px 14px',
                minHeight: 50,
                borderRadius: radius.md,
                border: `2px solid ${color.secondary}`,
                background: '#fff',
                color: color.text,
              }}
            />
            {authError && (
              <div style={{ fontSize: 15, fontWeight: 700, color: color.danger }}>{authError}</div>
            )}
            <button
              onClick={() => void doLogin()}
              disabled={authBusy || !password}
              style={{
                fontFamily: 'inherit',
                fontSize: 19,
                fontWeight: 700,
                color: '#fff',
                background: color.primary,
                border: 'none',
                borderRadius: radius.pill,
                padding: 15,
                minHeight: 54,
                cursor: authBusy || !password ? 'not-allowed' : 'pointer',
                opacity: authBusy || !password ? 0.6 : 1,
              }}
            >
              {authBusy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
            </button>
            <button
              onClick={onClose}
              style={{
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 700,
                color: color.textMuted,
                background: 'transparent',
                border: 'none',
                padding: 10,
                cursor: 'pointer',
              }}
            >
              ปิด
            </button>
          </div>
        ) : (
        <>

        {/* กติกาที่ห้องแข่งล็อกไว้ต้องเท่ากันทุกทีม ไม่งั้นแข่งกันไม่ยุติธรรม */}
        {inRoom && (
          <p style={lockedNote}>🌐 กำลังอยู่ในห้องแข่ง — ระดับความยากและเป้าเหรียญถูกล็อกให้เท่ากันทุกทีม</p>
        )}

        {/* ระดับความยาก */}
        <Row label="ระดับความยากคำถาม">
          <Segmented
            options={[
              { label: 'ทั้งหมด', value: 'all' },
              { label: 'ง่าย', value: 'easy' },
              { label: 'กลาง', value: 'medium' },
              { label: 'ยาก', value: 'hard' },
            ]}
            value={settings.difficulty}
            onChange={(v) => update({ difficulty: v as Settings['difficulty'] })}
            disabled={inRoom}
          />
        </Row>

        {/* เป้าหมายเหรียญกษัตริย์ = ตัวคุมความยาวเกมที่ตรงที่สุด
            ช่องทองต้อง "ลงพอดี" เท่านั้น → ได้เหรียญราว 1 ครั้งต่อ 7-8 เทิร์น
            3 เหรียญ ≈ 45 นาที (จบในคาบ) · 7 เหรียญ ≈ 1.8 ชม. (เกินคาบ) */}
        <Row label="🏆 เหรียญที่ต้องเก็บเพื่อชนะ">
          <Segmented
            options={[
              { label: '3', value: 3 },
              { label: '4', value: 4 },
              { label: '5', value: 5 },
              { label: '7', value: 7 },
            ]}
            value={clampTargetCoins(settings.targetCoins)}
            onChange={(v) => update({ targetCoins: v })}
            disabled={inRoom}
          />
          <p style={{ fontSize: 15, color: color.textMuted, margin: '8px 0 0', lineHeight: 1.5 }}>
            3 เหรียญ ≈ 45 นาที · 7 เหรียญ ≈ 2 ชั่วโมง (ครบทุกพระองค์)
          </p>
        </Row>

        {/* ป้ายสวิตช์: สั้น เป็นไทยล้วน ไม่มีคำอธิบายในวงเล็บ
            (รายละเอียด เช่น ขนาดที่ต้องโหลดของตัวตรวจจับมือ อยู่ใน CLAUDE.md ไม่ใช่บนจอครู) */}
        {showFullscreenToggle && (
          <Toggle
            label="🖥️ เต็มจอแนวนอน"
            on={fullscreen}
            onToggle={() => void (fullscreen ? exitFullscreen() : enterFullscreen())}
          />
        )}
        <Toggle
          label="⏱️ จับเวลาคำถาม"
          on={settings.timerEnabled}
          onToggle={() => update({ timerEnabled: !settings.timerEnabled })}
        />
        <Toggle
          label="🔊 เสียงและการสั่น"
          on={settings.soundEnabled}
          onToggle={() => update({ soundEnabled: !settings.soundEnabled })}
        />
        <Toggle
          label="📱 ตอบคำถามบนมือถือ"
          on={settings.qrAnswerMode}
          onToggle={() => update({ qrAnswerMode: !settings.qrAnswerMode })}
        />
        <Toggle
          label="🖐️ ตอบแบบลากคำตอบ"
          on={settings.dragAnswerMode}
          onToggle={() => update({ dragAnswerMode: !settings.dragAnswerMode })}
        />
        {settings.dragAnswerMode && (
          <Toggle
            label="✌️ จีบนิ้วผ่านกล้อง"
            on={settings.handAnswerMode}
            onToggle={() => update({ handAnswerMode: !settings.handAnswerMode })}
          />
        )}
        <Toggle
          label="📷 เปิดกล้องช่องทอง"
          on={settings.arEnabled}
          onToggle={() => update({ arEnabled: !settings.arEnabled })}
        />
        <Toggle
          label="🃏 ส่องการ์ดจริง"
          on={settings.arCardMode}
          onToggle={() => update({ arCardMode: !settings.arCardMode })}
        />
        <Toggle
          label="🎬 โหมดนำเสนอ (เจอการ์ดทอง AR บ่อยขึ้น)"
          on={settings.goldBoostMode}
          onToggle={() => update({ goldBoostMode: !settings.goldBoostMode })}
        />
        <Toggle
          label="🙋 ปุ่มตอบถูก/ตอบผิดบนจอ QR"
          on={settings.manualResultButtons}
          onToggle={() => update({ manualResultButtons: !settings.manualResultButtons })}
        />
        <Toggle
          label="🎲 แสดงไอคอนบนช่อง"
          on={settings.showTileIcons}
          onToggle={() => update({ showTileIcons: !settings.showTileIcons })}
        />
        <Toggle
          label="🎯 ปรับตำแหน่งช่อง"
          on={settings.calibrate}
          onToggle={() => update({ calibrate: !settings.calibrate })}
        />

        </>
        )}

        {loggedIn && (
          <>
          <button
            onClick={() => setAdminOpen(true)}
            style={{
              fontFamily: 'inherit',
              marginTop: 16,
              width: '100%',
              fontSize: 18,
              fontWeight: 700,
              color: color.primary,
              background: '#FFF6D8',
              border: `2px solid ${color.secondary}`,
              borderRadius: radius.pill,
              padding: 14,
              minHeight: 54,
              cursor: 'pointer',
            }}
          >
            📚 จัดการเนื้อหาการ์ด{loggedIn ? '' : ' 🔒'}
          </button>
          {/* บอกให้ชัดว่าปุ่มนี้ต้องใช้รหัส และตอนนี้เครื่องนี้ล็อกอินค้างอยู่หรือเปล่า
              (สำคัญบนแท็บเล็ตที่เด็กใช้ร่วมกัน — ครูจะได้รู้ว่าต้องออกจากระบบก่อนส่งต่อ) */}
          <p style={{ margin: '6px 0 0', fontSize: 14, color: color.textMuted, textAlign: 'center' }}>
            🔓 เครื่องนี้เข้าสู่ระบบครูอยู่ — ออกจากระบบได้ในหน้าหลังบ้าน
          </p>

          <button
            onClick={onClose}
            style={{
              fontFamily: 'inherit',
              marginTop: 12,
              width: '100%',
              fontSize: 19,
              fontWeight: 700,
              color: '#fff',
              background: color.primary,
              border: 'none',
              borderRadius: radius.pill,
              padding: 16,
              minHeight: 56,
              cursor: 'pointer',
            }}
          >
            เสร็จสิ้น
          </button>
          </>
        )}
        </div>
      </div>
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </>
  );
}

const lockedNote: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: 15,
  fontWeight: 700,
  color: '#6B4E1E',
  background: '#FFF6D8',
  border: `1.5px solid ${color.secondary}`,
  borderRadius: radius.md,
  padding: '10px 14px',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '18px 0' }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', opacity: disabled ? 0.5 : 1 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            style={{
              fontFamily: 'inherit',
              fontSize: 18,
              fontWeight: 600,
              padding: '10px 18px',
              minHeight: 48,
              borderRadius: radius.pill,
              border: `2px solid ${color.secondary}`,
              background: active ? color.secondary : color.surface,
              color: active ? '#fff' : color.text,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        fontSize: 18,
        fontWeight: 600,
        color: color.text,
        background: color.bg,
        border: 'none',
        borderRadius: radius.md,
        padding: '14px 18px',
        minHeight: 56,
        margin: '10px 0',
        cursor: 'pointer',
      }}
    >
      <span>{label}</span>
      <span
        style={{
          width: 52,
          height: 30,
          borderRadius: radius.pill,
          background: on ? color.success : '#ccc',
          position: 'relative',
          transition: 'background .2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 25 : 3,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left .2s',
          }}
        />
      </span>
    </button>
  );
}
