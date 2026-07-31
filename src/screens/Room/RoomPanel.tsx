import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import QRCode from 'qrcode';
import { useGame } from '@/core/store';
import { getContentVersion, syncContent } from '@/core/content';
import { hasAdminToken, login } from '@/core/api';
import {
  RoomError,
  createRoom,
  fetchRoom,
  joinRoom,
  leaveRoom,
  roomApiAvailable,
  startRoom,
  type RoomState,
} from '@/core/roomApi';
import { color, radius, elevation } from '@/theme/tokens';

// ── ห้องแข่งออนไลน์: สร้างห้อง → ให้ผู้เล่นอื่นใส่รหัส → เริ่มพร้อมกัน ──
// แต่ละทีมเล่นกระดานของตัวเอง แล้วเห็นอันดับของกันและกันสด ๆ (ดู ROOM-PLAN.md)
// แผงนี้ทำงานตอน phase === 'setup' เท่านั้น พอห้องเริ่มก็ setupGame() แล้วปิดตัวเอง
const LOBBY_POLL_MS = 2500;

type Step = 'menu' | 'create' | 'join' | 'lobby';

export function RoomPanel({ onClose, initialCode }: { onClose: () => void; initialCode?: string }) {
  const enterRoom = useGame((s) => s.enterRoom);
  const updateRoomState = useGame((s) => s.updateRoomState);
  const leaveRoomSession = useGame((s) => s.leaveRoomSession);
  const updateSettings = useGame((s) => s.updateSettings);
  const setupGame = useGame((s) => s.setupGame);
  const session = useGame((s) => s.room);

  const [step, setStep] = useState<Step>(() => (initialCode ? 'join' : 'menu'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState<RoomState | null>(null);

  // ฟอร์มสร้างห้อง
  const [hostName, setHostName] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [targetCoins, setTargetCoins] = useState(7);
  const [playersPerTeam, setPlayersPerTeam] = useState(2);
  const [difficulty, setDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [password, setPassword] = useState('');
  const [needLogin, setNeedLogin] = useState(!hasAdminToken());

  // ฟอร์มเข้าร่วม
  const [code, setCode] = useState(initialCode ?? '');
  const [teamName, setTeamName] = useState('');

  const isHost = !!session?.isHost;
  const roomCode = session?.code ?? '';

  // ── ล็อบบี้: poll จนกว่าเจ้าของห้องจะกดเริ่ม ──
  useEffect(() => {
    if (step !== 'lobby' || !roomCode) return;
    let alive = true;
    const tick = async () => {
      try {
        const next = await fetchRoom(roomCode);
        if (!alive) return;
        setState(next);
        updateRoomState(next);
        if (next.room.status === 'running') beginMatch(next);
      } catch {
        /* เน็ตสะดุด — รอบหน้าลองใหม่ ไม่ต้องเด้ง error ให้ตกใจ */
      }
    };
    void tick();
    const iv = window.setInterval(tick, LOBBY_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, roomCode]);

  // เริ่มแมตช์: ตั้งค่าเกมให้ตรงกับกติกาห้อง แล้วเข้ากระดาน
  // ⚠️ ต้องตั้ง settings ก่อน setupGame — จำนวนผู้เล่นและเป้าเหรียญมาจากห้อง ไม่ใช่หน้า Home
  const startedRef = useRef(false);
  const beginMatch = (next: RoomState) => {
    if (startedRef.current) return; // poll กับ start กดพร้อมกันได้ — ให้เริ่มครั้งเดียว
    startedRef.current = true;
    const rules = next.room.rules;
    updateSettings({ targetCoins: rules.targetCoins, difficulty: rules.difficulty });
    setupGame(rules.playersPerTeam);
    onClose();
  };

  const runCreate = async () => {
    setError('');
    setBusy(true);
    try {
      if (needLogin) {
        await login(password);
        setNeedLogin(false);
      }
      // ห้องล็อกเวอร์ชันคลังการ์ด → ต้องซิงก์ให้เป็นเวอร์ชันล่าสุดก่อนสร้าง
      await syncContent();
      const { code: newCode } = await createRoom(hostName, {
        durationSec: durationMin * 60,
        targetCoins,
        playersPerTeam,
        difficulty,
      });
      const joined = await joinRoom(newCode, hostName, getContentVersion());
      enterRoom({
        code: newCode,
        teamToken: joined.teamToken,
        teamName: hostName,
        isHost: true,
        state: joined,
        offline: false,
      });
      setState(joined);
      setStep('lobby');
    } catch (e) {
      setError(e instanceof RoomError ? e.message : 'สร้างห้องไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const runJoin = async () => {
    setError('');
    setBusy(true);
    try {
      await syncContent(); // คลังคำถามต้องตรงกับห้อง ไม่งั้น server ปฏิเสธ
      const joined = await joinRoom(code, teamName, getContentVersion());
      enterRoom({
        code: joined.room.code,
        teamToken: joined.teamToken,
        teamName,
        isHost: false,
        state: joined,
        offline: false,
      });
      setState(joined);
      setStep('lobby');
    } catch (e) {
      setError(e instanceof RoomError ? e.message : 'เข้าร่วมห้องไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const runStart = async () => {
    setError('');
    setBusy(true);
    try {
      const next = await startRoom(roomCode);
      setState(next);
      beginMatch(next);
    } catch (e) {
      setError(e instanceof RoomError ? e.message : 'เริ่มแข่งไม่สำเร็จ');
      setBusy(false);
    }
  };

  const runLeave = async () => {
    if (session) {
      try {
        await leaveRoom(session.code, session.teamToken);
      } catch {
        /* ออกไม่สำเร็จก็ปล่อย — แถวจะถูกล้างตอนห้องหมดอายุ */
      }
    }
    leaveRoomSession();
    onClose();
  };

  if (!roomApiAvailable()) {
    return (
      <Shell onClose={onClose} title="ห้องแข่งออนไลน์">
        <p style={note}>
          โหมดนี้ต้องต่อกับเซิร์ฟเวอร์ (ยังไม่ได้ตั้งค่า <code>VITE_API_BASE</code>) — เล่นในเครื่องได้ตามปกติ
        </p>
      </Shell>
    );
  }

  return (
    <Shell onClose={step === 'lobby' ? undefined : onClose} title="ห้องแข่งออนไลน์">
      {error && <div style={errorBox}>{error}</div>}

      {step === 'menu' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <button style={primaryBtn} onClick={() => setStep('create')}>
            ➕ สร้างห้องใหม่
          </button>
          <button style={ghostBtn} onClick={() => setStep('join')}>
            🔑 เข้าร่วมด้วยรหัสห้อง
          </button>
          <p style={note}>
            แต่ละทีมเล่นกระดานของตัวเอง แล้วเห็นอันดับของกันและกันสด ๆ · หมดเวลาแล้วทีมที่เก็บเหรียญกษัตริย์ได้มากที่สุดชนะ
          </p>
        </div>
      )}

      {step === 'create' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {needLogin && (
            <Field label="รหัสครู">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={input}
                placeholder="รหัสสำหรับเข้าหลังบ้าน"
              />
            </Field>
          )}
          <Field label="ชื่อทีมของเรา">
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              style={input}
              maxLength={40}
              placeholder="เช่น ทีมสิงห์ทอง"
            />
          </Field>
          <Row>
            <Field label="เวลาแข่ง">
              <Segmented
                value={durationMin}
                options={[15, 20, 30, 45]}
                render={(v) => `${v} นาที`}
                onChange={setDurationMin}
              />
            </Field>
          </Row>
          <Row>
            <Field label="เหรียญที่ต้องเก็บ">
              <Segmented value={targetCoins} options={[3, 5, 7]} render={String} onChange={setTargetCoins} />
            </Field>
            <Field label="ผู้เล่นต่อเครื่อง">
              <Segmented value={playersPerTeam} options={[1, 2, 3, 4]} render={String} onChange={setPlayersPerTeam} />
            </Field>
          </Row>
          <Field label="ระดับความยากคำถาม">
            <Segmented
              value={difficulty}
              options={['all', 'easy', 'medium', 'hard'] as const}
              render={(v) => ({ all: 'ทั้งหมด', easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก' })[v]}
              onChange={setDifficulty}
            />
          </Field>
          <p style={note}>
            ⚖️ ทุกทีมต้องมีผู้เล่นต่อเครื่องเท่ากัน ไม่งั้นทีมที่คนเยอะกว่าจะได้ทอยเต๋าบ่อยกว่า · คะแนนทีม = เหรียญรวมของทุกคนในเครื่อง
          </p>
          <button style={primaryBtn} disabled={busy || !hostName.trim()} onClick={() => void runCreate()}>
            {busy ? 'กำลังสร้าง…' : 'สร้างห้อง'}
          </button>
          <button style={ghostBtn} onClick={() => setStep('menu')}>
            ← ย้อนกลับ
          </button>
        </div>
      )}

      {step === 'join' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="รหัสห้อง">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ ...input, fontSize: 30, letterSpacing: 6, textAlign: 'center', fontWeight: 800 }}
              maxLength={8}
              placeholder="ABC123"
              autoCapitalize="characters"
            />
          </Field>
          <Field label="ชื่อทีมของเรา">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              style={input}
              maxLength={40}
              placeholder="เช่น ทีมพญานาค"
            />
          </Field>
          <p style={note}>🔒 ใช้ชื่อทีม ไม่ต้องใส่ชื่อจริงของผู้เล่น</p>
          <button style={primaryBtn} disabled={busy || !code.trim() || !teamName.trim()} onClick={() => void runJoin()}>
            {busy ? 'กำลังเข้าร่วม…' : 'เข้าร่วมห้อง'}
          </button>
          <button style={ghostBtn} onClick={() => setStep('menu')}>
            ← ย้อนกลับ
          </button>
        </div>
      )}

      {step === 'lobby' && (
        <Lobby
          code={roomCode}
          state={state}
          isHost={isHost}
          busy={busy}
          onStart={() => void runStart()}
          onLeave={() => void runLeave()}
        />
      )}
    </Shell>
  );
}

function Lobby({
  code,
  state,
  isHost,
  busy,
  onStart,
  onLeave,
}: {
  code: string;
  state: RoomState | null;
  isHost: boolean;
  busy: boolean;
  onStart: () => void;
  onLeave: () => void;
}) {
  const [qr, setQr] = useState('');
  // ลิงก์เชิญ — เปิดแล้วเด้งเข้าหน้าใส่รหัสพร้อมกรอกให้เลย (Home อ่าน ?room= ตอนโหลด)
  const inviteUrl = useMemo(
    () => `${window.location.origin}${window.location.pathname}?room=${code}`,
    [code]
  );
  useEffect(() => {
    QRCode.toDataURL(inviteUrl, { width: 420, margin: 3, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(''));
  }, [inviteUrl]);

  const teams = state?.teams ?? [];
  const rules = state?.room.rules;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: color.textMuted }}>รหัสห้อง</div>
        <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: 8, color: color.primary }}>{code}</div>
        {qr && <img src={qr} alt="" style={{ width: 168, height: 168, margin: '4px auto', display: 'block' }} />}
        <div style={{ fontSize: 13, color: color.textMuted }}>ให้ผู้เล่นอื่นพิมพ์รหัสนี้ หรือสแกน QR</div>
      </div>

      {rules && (
        <div style={rulesBox}>
          ⏱ {Math.round(rules.durationSec / 60)} นาที · 🏆 {rules.targetCoins} เหรียญ · 👥{' '}
          {rules.playersPerTeam} คน/เครื่อง
        </div>
      )}

      <div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>ทีมในห้อง ({teams.length})</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {teams.map((t) => (
            <div key={t.name} style={teamRow}>
              <span>{t.online ? '🟢' : '⚪'} {t.name}</span>
            </div>
          ))}
          {teams.length === 0 && <div style={note}>ยังไม่มีใครเข้าร่วม…</div>}
        </div>
      </div>

      {isHost ? (
        <button style={primaryBtn} disabled={busy || teams.length < 2} onClick={onStart}>
          {teams.length < 2 ? 'รออีกอย่างน้อย 1 ทีม' : busy ? 'กำลังเริ่ม…' : '▶ เริ่มแข่ง'}
        </button>
      ) : (
        <div style={waitBox}>⏳ รอเจ้าของห้องกดเริ่มแข่ง…</div>
      )}
      <button style={ghostBtn} onClick={onLeave}>
        ออกจากห้อง
      </button>
    </div>
  );
}

// ── ชิ้นส่วน UI ──
function Shell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div style={overlay}>
      <div style={panel}>
        <h2 style={{ margin: '0 0 4px', fontSize: 23, color: color.primary }}>🌐 {title}</h2>
        {children}
        {onClose && (
          <button style={{ ...ghostBtn, marginTop: 4 }} onClick={onClose}>
            ปิด
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 5, flex: 1 }}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>;
}

function Segmented<T extends string | number>({
  value,
  options,
  render,
  onChange,
}: {
  value: T;
  options: T[];
  render: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button
          key={String(o)}
          onClick={() => onChange(o)}
          style={{
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 700,
            padding: '8px 14px',
            minHeight: 42,
            borderRadius: radius.pill,
            border: `2px solid ${color.secondary}`,
            background: o === value ? color.secondary : color.surface,
            color: o === value ? '#fff' : color.text,
            cursor: 'pointer',
          }}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 160,
  padding: 18,
};

const panel: CSSProperties = {
  width: 'min(480px, 96vw)',
  maxHeight: '92vh',
  overflowY: 'auto',
  background: color.surface,
  borderRadius: radius.lg,
  boxShadow: elevation.modal,
  padding: 22,
  display: 'grid',
  gap: 12,
};

const input: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 18,
  padding: '12px 14px',
  minHeight: 48,
  borderRadius: radius.md,
  border: `2px solid ${color.secondary}`,
  background: '#fff',
  color: color.text,
};

const primaryBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 19,
  fontWeight: 800,
  color: '#fff',
  background: color.primary,
  border: 'none',
  borderRadius: radius.pill,
  padding: 15,
  minHeight: 54,
  cursor: 'pointer',
};

const ghostBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 700,
  color: color.primary,
  background: 'transparent',
  border: `1.5px solid ${color.secondary}`,
  borderRadius: radius.pill,
  padding: 12,
  minHeight: 46,
  cursor: 'pointer',
};

const note: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  color: color.textMuted,
};

const errorBox: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#8B0000',
  background: '#FDECEC',
  border: '1.5px solid #E5A5A5',
  borderRadius: radius.md,
  padding: '10px 14px',
};

const rulesBox: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  textAlign: 'center',
  color: '#6B4E1E',
  background: '#FFF6D8',
  border: `1.5px solid ${color.secondary}`,
  borderRadius: radius.md,
  padding: '10px 12px',
};

const teamRow: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  background: color.bg,
  borderRadius: radius.md,
  padding: '10px 14px',
};

const waitBox: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  textAlign: 'center',
  color: color.textMuted,
  padding: 10,
};
