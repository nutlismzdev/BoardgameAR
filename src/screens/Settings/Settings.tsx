import { useEffect, useState } from 'react';
import { useGame, clampTargetCoins } from '@/core/store';
import type { Settings } from '@/core/store';
import { AdminPanel } from '@/screens/Admin/AdminPanel';
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
  const [adminOpen, setAdminOpen] = useState(false);

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
          />
        </Row>

        {/* เป้าหมายเหรียญกษัตริย์ = ตัวคุมความยาวเกมที่ตรงที่สุด
            ช่องทองต้อง "ลงพอดี" เท่านั้น → ได้เหรียญราว 1 ครั้งต่อ 7-8 เทิร์น
            3 เหรียญ ≈ 45 นาที (จบในคาบ) · 7 เหรียญ ≈ 1.8 ชม. (เกินคาบ) */}
        <Row label="🏆 เก็บเหรียญกษัตริย์กี่เหรียญถึงชนะ">
          <Segmented
            options={[
              { label: '3 (≈45 นาที)', value: 3 },
              { label: '4', value: 4 },
              { label: '5', value: 5 },
              { label: '7 (ครบทุกพระองค์)', value: 7 },
            ]}
            value={clampTargetCoins(settings.targetCoins)}
            onChange={(v) => update({ targetCoins: v })}
          />
          <p style={{ fontSize: 15, color: color.textMuted, margin: '8px 0 0', lineHeight: 1.5 }}>
            ยิ่งตั้งสูง เกมยิ่งยาว — เลือกให้พอดีกับเวลาที่เหลือในคาบ
          </p>
        </Row>

        {/* toggles */}
        {showFullscreenToggle && (
          <Toggle
            label="🖥️ เต็มจอ + ล็อกแนวนอน (กันจอซูมเพี้ยน)"
            on={fullscreen}
            onToggle={() => void (fullscreen ? exitFullscreen() : enterFullscreen())}
          />
        )}
        <Toggle
          label="⏱️ ตัวจับเวลาคำถาม"
          on={settings.timerEnabled}
          onToggle={() => update({ timerEnabled: !settings.timerEnabled })}
        />
        <Toggle
          label="🔊 เพลงพื้นหลัง + เสียง + การสั่น"
          on={settings.soundEnabled}
          onToggle={() => update({ soundEnabled: !settings.soundEnabled })}
        />
        <Toggle
          label="📱 ตอบคำถามผ่านมือถือ"
          on={settings.qrAnswerMode}
          onToggle={() => update({ qrAnswerMode: !settings.qrAnswerMode })}
        />
        <Toggle
          label="📷 เปิดกล้อง AR (ช่องทอง)"
          on={settings.arEnabled}
          onToggle={() => update({ arEnabled: !settings.arEnabled })}
        />
        <Toggle
          label="🃏 โหมดส่องการ์ดจริง (AR image-target) — ต้องมีไฟล์การ์ด"
          on={settings.arCardMode}
          onToggle={() => update({ arCardMode: !settings.arCardMode })}
        />
        <Toggle
          label="🎲 แสดงไอคอนบอกชนิดช่อง"
          on={settings.showTileIcons}
          onToggle={() => update({ showTileIcons: !settings.showTileIcons })}
        />
        <Toggle
          label="🎯 โหมดปรับตำแหน่งช่อง (ผู้ดูแล)"
          on={settings.calibrate}
          onToggle={() => update({ calibrate: !settings.calibrate })}
        />

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
            📚 จัดการเนื้อหาการ์ด (หลังบ้าน)
          </button>

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
        </div>
      </div>
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </>
  );
}

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
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
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
              cursor: 'pointer',
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
