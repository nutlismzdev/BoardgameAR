import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useGame, clampTargetCoins } from '@/core/store';
import type { Settings } from '@/core/store';
import { AdminPanel } from '@/screens/Admin/AdminPanel';
import { TestResultsPanel } from '@/screens/Admin/TestResultsPanel';
import { adminLoginAvailable, hasAdminToken, login } from '@/core/api';
import { color, radius, elevation } from '@/theme/tokens';
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  isStandalone,
  fullscreenSupported,
} from '@/core/viewportLock';

// โหมดครู (Teacher Mode) — ตั้งค่าให้เหมาะกับชั้นเรียน
//
// 🧭 โครงของจอนี้ = "จัดกลุ่มตามงานที่ครูกำลังทำ" ไม่ใช่เรียงตามชนิดของสวิตช์
//    ไล่จากที่แตะบ่อยสุดลงไปหาน้อยสุด: บทเรียนวันนี้ → แบบทดสอบ → วิธีตอบคำถาม →
//    การแสดงผล → เครื่องมือผู้ดูแล (พับเก็บ)
//    เดิมเป็นสวิตช์เรียงติดกัน 12 ตัวไม่มีหัวข้อ ของที่เกี่ยวกันอยู่คนละที่
//    (เช่น "ตอบบนมือถือ" เป็นตัวที่ 6 แต่ "ปุ่มตอบถูก/ผิดบนจอ QR" ไปอยู่ตัวที่ 12)
//    และปุ่มดูผลแบบทดสอบไปกองท้ายจอปนกับปุ่มจัดการการ์ดซึ่งเป็นคนละงานกัน
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useGame((s) => s.settings);
  const update = useGame((s) => s.updateSettings);
  const inRoom = useGame((s) => !!s.room); // อยู่ในห้องแข่ง = กติกาถูกล็อกจากห้อง
  const [adminOpen, setAdminOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
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
            width: 'min(560px, 94vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 24, color: color.primary, margin: 0 }}>⚙️ โหมดครู</h2>
          <p style={{ color: color.textMuted, margin: '4px 0 0', fontSize: 17 }}>
            ตั้งค่าให้เหมาะกับชั้นเรียน
          </p>

          {/* ── ประตูรหัสครู ── ยังไม่ล็อกอิน = ไม่เห็นสวิตช์อะไรเลย */}
          {!loggedIn ? (
            <div style={{ display: 'grid', gap: 12, margin: '14px 0 4px' }}>
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
                <div role="alert" style={{ fontSize: 15, fontWeight: 700, color: color.danger }}>
                  {authError}
                </div>
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
                <p style={{ ...lockedNote, marginTop: 14 }}>
                  🌐 กำลังอยู่ในห้องแข่ง — ระดับความยากและเป้าเหรียญถูกล็อกให้เท่ากันทุกทีม
                </p>
              )}

              {/* สถานะของเครื่อง ไม่ใช่การตั้งค่า จึงอยู่บนสุดไม่ต้องไปหาในหมวด
                  (สำคัญบนแท็บเล็ตที่เด็กใช้ร่วมกัน — ครูจะได้รู้ว่าต้องออกจากระบบก่อนส่งต่อ) */}
              {gated && (
                <p style={{ margin: '12px 0 0', fontSize: 14, color: color.textMuted }}>
                  🔓 เครื่องนี้เข้าสู่ระบบครูอยู่ — ออกจากระบบได้ในหน้าจัดการเนื้อหาการ์ด
                </p>
              )}

              <Section title="🎓 บทเรียนวันนี้" hint="ปรับให้พอดีกับเวลาที่มีในคาบ">
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
                    ช่องทองต้อง "ลงพอดี" เท่านั้น → ได้เหรียญราว 1 ครั้งต่อ 7-8 เทิร์น */}
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
                  <p style={hintText}>3 เหรียญ ≈ 45 นาที · 7 เหรียญ ≈ 2 ชั่วโมง (ครบทุกพระองค์)</p>
                </Row>

                <Toggle
                  label="⏱️ จับเวลาคำถาม"
                  on={settings.timerEnabled}
                  onToggle={() => update({ timerEnabled: !settings.timerEnabled })}
                />
              </Section>

              <Section title="📋 แบบทดสอบก่อน/หลังเรียน" hint="ชุด 30 ข้อ ทำก่อนและหลังเล่นเกม">
                <Toggle
                  label="เปิดใช้แบบทดสอบ"
                  on={settings.testEnabled}
                  onToggle={() => update({ testEnabled: !settings.testEnabled })}
                />
                {settings.testEnabled && (
                  <>
                    <Row label="📖 การเปิดเฉลยให้นักเรียน">
                      <Segmented
                        options={[
                          { label: 'หลังเรียน', value: 'post' },
                          { label: 'ทุกครั้ง', value: 'always' },
                          { label: 'ไม่เปิด', value: 'never' },
                        ]}
                        value={settings.testShowExplain}
                        onChange={(v) => update({ testShowExplain: v as Settings['testShowExplain'] })}
                      />
                      {/* เตือนตรงนี้เพราะเป็นสวิตช์เดียวที่ทำให้ตัวเลขพัฒนาการเชื่อถือไม่ได้ */}
                      <p style={hintText}>
                        {settings.testShowExplain === 'always'
                          ? '⚠️ หากเปิดเฉลยตั้งแต่รอบก่อนเรียน คะแนนหลังเรียนจะสะท้อนการจดจำเฉลย มิใช่ความรู้ที่ได้จากการเล่นเกม'
                          : 'ไม่แสดงคะแนนและเฉลยในรอบก่อนเรียน เพื่อให้คะแนนหลังเรียนสะท้อนความรู้ที่นักเรียนได้จากการเล่นเกม'}
                      </p>
                    </Row>
                    <Row label="⏳ เวลาทำแบบทดสอบ">
                      <Segmented
                        options={[
                          { label: 'ไม่จับเวลา', value: 0 },
                          { label: '30 นาที', value: 30 },
                          { label: '45 นาที', value: 45 },
                          { label: '60 นาที', value: 60 },
                        ]}
                        value={settings.testTimeLimitMin}
                        onChange={(v) => update({ testTimeLimitMin: v })}
                      />
                    </Row>
                    <Toggle
                      label="🔀 สลับลำดับข้อและตัวเลือกในรอบหลังเรียน"
                      on={settings.testShuffle}
                      onToggle={() => update({ testShuffle: !settings.testShuffle })}
                    />
                    <Toggle
                      label="🧑‍🎓 ส่งชื่อนักเรียนไปยังระบบของโรงเรียน"
                      on={settings.testSendName}
                      onToggle={() => update({ testSendName: !settings.testSendName })}
                    />
                    <Toggle
                      label="🔁 อนุญาตให้ทำแบบทดสอบรอบเดิมซ้ำ"
                      on={settings.testAllowRetake}
                      onToggle={() => update({ testAllowRetake: !settings.testAllowRetake })}
                    />
                    <p style={hintText}>
                      {settings.testAllowRetake
                        ? '⚠️ เปิดอยู่ — นักเรียนทำรอบเดิมซ้ำได้ คะแนนรอบใหม่จะทับของเดิม ควรเปิดเฉพาะตอนมีเหตุจำเป็นแล้วปิดกลับ'
                        : 'ปิดไว้เพื่อให้คะแนนใช้วัดผลได้จริง · เปิดเมื่อมีเหตุ เช่น แท็บเล็ตดับกลางคัน กรอกเลขที่ผิด หรือนักเรียนมาสอบชดเชย'}
                    </p>
                    {/* ดูผลเป็นงานคู่กับการตั้งค่าแบบทดสอบ จึงอยู่ในหมวดเดียวกัน
                        (เดิมอยู่ท้ายจอปนกับปุ่มจัดการการ์ดซึ่งเป็นคนละงานกัน) */}
                    <ActionButton onClick={() => setResultsOpen(true)}>
                      📊 ดูผลแบบทดสอบของนักเรียน
                    </ActionButton>
                  </>
                )}
              </Section>

              <Section title="✍️ วิธีตอบคำถาม" hint="เลือกว่านักเรียนจะตอบด้วยวิธีไหน">
                <Toggle
                  label="📱 ตอบคำถามบนมือถือ (สแกน QR)"
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
                    nested
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
                {/* ⚠️ ห้ามย้ายไปเป็นสวิตช์ลูกของ "ตอบบนมือถือ" — การ์ดทองใช้จอ QR เสมอ
                    ไม่ว่าสวิตช์นั้นจะเปิดหรือปิด (CardModal variant="gold-ar") */}
                <Toggle
                  label="🙋 ปุ่มตอบถูก/ตอบผิดบนจอ QR"
                  on={settings.manualResultButtons}
                  onToggle={() => update({ manualResultButtons: !settings.manualResultButtons })}
                />
                <p style={hintText}>ให้คุณครูกดผลเองได้เมื่อมือถือนักเรียนส่งคำตอบไม่สำเร็จ</p>
              </Section>

              <Section title="🖥️ การแสดงผลและอุปกรณ์">
                {showFullscreenToggle && (
                  <Toggle
                    label="🖥️ เต็มจอแนวนอน"
                    on={fullscreen}
                    onToggle={() => void (fullscreen ? exitFullscreen() : enterFullscreen())}
                  />
                )}
                <Toggle
                  label="🔊 เสียงและการสั่น"
                  on={settings.soundEnabled}
                  onToggle={() => update({ soundEnabled: !settings.soundEnabled })}
                />
                <Toggle
                  label="🎲 แสดงไอคอนบนช่อง"
                  on={settings.showTileIcons}
                  onToggle={() => update({ showTileIcons: !settings.showTileIcons })}
                />
              </Section>

              {/* เครื่องมือผู้ดูแล: พับเก็บเพราะไม่ใช่ของที่ใช้ทุกคาบ และกดผิดแล้วจอเพี้ยน
                  ใช้ <details> ของเบราว์เซอร์ = กดด้วยคีย์บอร์ดได้ ไม่ต้องเพิ่ม state */}
              <details style={advancedBox}>
                <summary style={advancedSummary}>🛠️ สำหรับผู้ดูแลระบบ</summary>
                <div style={{ paddingTop: 4 }}>
                  <Toggle
                    label="🎬 โหมดนำเสนอ (เจอการ์ดทอง AR บ่อยขึ้น)"
                    on={settings.goldBoostMode}
                    onToggle={() => update({ goldBoostMode: !settings.goldBoostMode })}
                  />
                  <Toggle
                    label="🎯 ปรับตำแหน่งช่องบนกระดาน"
                    on={settings.calibrate}
                    onToggle={() => update({ calibrate: !settings.calibrate })}
                  />
                  <ActionButton onClick={() => setAdminOpen(true)}>📚 จัดการเนื้อหาการ์ด</ActionButton>
                </div>
              </details>

              <button
                onClick={onClose}
                style={{
                  fontFamily: 'inherit',
                  marginTop: 18,
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
      {resultsOpen && <TestResultsPanel onClose={() => setResultsOpen(false)} />}
    </>
  );
}

const lockedNote: CSSProperties = {
  margin: '0 0 4px',
  fontSize: 15,
  fontWeight: 700,
  color: '#6B4E1E',
  background: '#FFF6D8',
  border: `1.5px solid ${color.secondary}`,
  borderRadius: radius.md,
  padding: '10px 14px',
};

const hintText: CSSProperties = {
  fontSize: 15,
  color: color.textMuted,
  margin: '8px 0 0',
  lineHeight: 1.5,
};

const advancedBox: CSSProperties = {
  marginTop: 18,
  border: '1.5px solid #E4D7B8',
  borderRadius: radius.md,
  padding: '10px 14px',
};

const advancedSummary: CSSProperties = {
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 700,
  color: color.textMuted,
  padding: '4px 0',
};

/** หัวข้อหมวด — เส้นคั่น + ชื่อหมวด เพื่อให้กวาดตาหาได้ว่าสวิตช์ที่ต้องการอยู่กลุ่มไหน */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 800,
          color: color.primary,
          borderBottom: `2px solid ${color.secondary}`,
          paddingBottom: 6,
        }}
      >
        {title}
      </h3>
      {hint && <p style={{ ...hintText, margin: '6px 0 0' }}>{hint}</p>}
      {children}
    </section>
  );
}

/** ปุ่มพาไปหน้าอื่น (ดูผล/จัดการการ์ด) — หน้าตาต่างจากสวิตช์ให้ชัดว่า "กดแล้วเปิดหน้าใหม่" */
function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'inherit',
        marginTop: 12,
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
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ margin: '16px 0' }}>
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
            aria-pressed={active}
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

/** `nested` = สวิตช์ลูกที่มีผลเฉพาะเมื่อสวิตช์แม่เปิดอยู่ — เยื้องเข้าให้เห็นความสัมพันธ์ */
function Toggle({
  label,
  on,
  onToggle,
  nested = false,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  nested?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      style={{
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: nested ? 'calc(100% - 22px)' : '100%',
        marginLeft: nested ? 22 : 0,
        fontSize: nested ? 17 : 18,
        fontWeight: 600,
        textAlign: 'left',
        color: color.text,
        background: color.bg,
        border: nested ? `1.5px solid ${color.secondary}55` : 'none',
        borderRadius: radius.md,
        padding: '14px 18px',
        minHeight: 56,
        margin: '10px 0',
        cursor: 'pointer',
      }}
    >
      <span style={{ minWidth: 0 }}>{label}</span>
      <span
        style={{
          flexShrink: 0,
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
