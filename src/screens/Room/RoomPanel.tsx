import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import QRCode from 'qrcode';
import { useGame } from '@/core/store';
import { KINGS, getContentVersion, syncContent } from '@/core/content';
import { getKingPawnImage } from '@/core/kingAssets';
import {
  RoomError,
  createRoom,
  fetchRoom,
  joinRoom,
  leaveRoom,
  roomApiAvailable,
  setLineup,
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
  const [sabotage, setSabotage] = useState(true);

  // ฟอร์มเข้าร่วม
  const [code, setCode] = useState(initialCode ?? '');
  const [teamName, setTeamName] = useState('');
  // ขุนศึกที่ทีมเราเลือก (king id ตามลำดับที่จะเล่นในเครื่อง) — ส่งขึ้นห้องให้ทีมอื่นเห็นด้วย
  const [lineup, setLineupLocal] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);

  const isHost = !!session?.isHost;
  const roomCode = session?.code ?? '';
  const myTeamName = session?.teamName ?? '';

  // แตะรูปเพื่อเลือก/ถอดขุนศึก แล้วดันขึ้นห้องทันที (ทีมอื่นเห็นภายในรอบ poll ถัดไป)
  const pickKing = (kingId: string) => {
    const need = state?.room.rules.playersPerTeam ?? 1;
    const next = lineup.includes(kingId)
      ? lineup.filter((id) => id !== kingId)
      : lineup.length < need
      ? [...lineup, kingId]
      : lineup;
    if (next === lineup) return;
    setLineupLocal(next);
    if (session) void setLineup(session.code, session.teamToken, next).catch(() => {});
  };

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
    // นับถอยหลัง 3-2-1 พร้อมกันทุกเครื่องก่อนเข้ากระดาน — จังหวะที่ทำให้รู้สึกว่า "เริ่มท้าชิงแล้ว"
    setCountdown(3);
    const tick = window.setInterval(() => {
      setCountdown((c) => {
        if (c === null) return null;
        if (c > 1) return c - 1;
        window.clearInterval(tick);
        updateSettings({ targetCoins: rules.targetCoins, difficulty: rules.difficulty });
        // ขุนศึกที่เลือกไว้ = หมากของผู้เล่นในเครื่อง (เลือกไม่ครบ setupGame เติมค่าเริ่มต้นให้เอง)
        setupGame(rules.playersPerTeam, lineup.length ? lineup : undefined);
        onClose();
        return null;
      });
    }, 900);
  };

  const runCreate = async () => {
    setError('');
    setBusy(true);
    try {
      // ห้องล็อกเวอร์ชันคลังการ์ด → ต้องซิงก์ให้เป็นเวอร์ชันล่าสุดก่อนสร้าง
      await syncContent();
      const created = await createRoom(hostName, {
        durationSec: durationMin * 60,
        targetCoins,
        playersPerTeam,
        difficulty,
        sabotage,
      });
      // create คืน teamToken ของเจ้าของห้องมาแล้ว ไม่ต้อง join ตามอีกรอบ
      enterRoom({
        code: created.code,
        teamToken: created.teamToken,
        teamName: hostName,
        isHost: true,
        state: created,
        offline: false,
      });
      setState(created);
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
      const joined = await joinRoom(code, teamName, getContentVersion(), lineup);
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
      const next = await startRoom(roomCode, session?.teamToken ?? '');
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

  if (countdown !== null) {
    return (
      <div style={countdownShell}>
        <div style={countdownLabel}>เตรียมตัวท้าชิง</div>
        <div key={countdown} style={countdownNumber}>
          {countdown}
        </div>
        <style>{`@keyframes cdPop{from{opacity:0;transform:scale(.5)}60%{opacity:1;transform:scale(1.08)}to{transform:scale(1)}}`}</style>
      </div>
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
          <Field label="การ์ดป่วน">
            <Segmented
              value={sabotage ? 'on' : 'off'}
              options={['on', 'off'] as const}
              render={(v) => (v === 'on' ? '😈 เปิด' : 'ปิด')}
              onChange={(v) => setSabotage(v === 'on')}
            />
          </Field>
          <p style={note}>
            😈 ให้ทีมที่ตามหลังจ่ายเหรียญเพื่อถ่วงทีมที่นำอยู่ (ยิงได้เฉพาะทีมที่อันดับนำหน้าเท่านั้น)
          </p>
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
          teamName={myTeamName}
          lineup={lineup}
          onPick={pickKing}
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
  teamName,
  lineup,
  onPick,
  onStart,
  onLeave,
}: {
  code: string;
  state: RoomState | null;
  isHost: boolean;
  busy: boolean;
  teamName: string;
  lineup: string[];
  onPick: (kingId: string) => void;
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
  const need = rules?.playersPerTeam ?? 1;
  const ready = lineup.length >= need;
  const rivals = teams.filter((t) => t.name !== teamName);
  const mine = teams.find((t) => t.name === teamName);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* ── รหัสห้อง + QR ── ยุบให้เล็กลงเมื่อเลือกขุนศึกครบแล้ว เพราะพื้นที่ควรไปอยู่ที่จอท้าชิง */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: color.textMuted }}>รหัสห้อง</div>
        <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 8, color: color.primary }}>{code}</div>
        {!ready && qr && (
          <img src={qr} alt="" style={{ width: 150, height: 150, margin: '2px auto', display: 'block' }} />
        )}
        <div style={{ fontSize: 12.5, color: color.textMuted }}>ให้ผู้เล่นอื่นพิมพ์รหัสนี้ หรือสแกน QR</div>
      </div>

      {rules && (
        <div style={rulesBox}>
          ⏱ {Math.round(rules.durationSec / 60)} นาที · 🏆 {rules.targetCoins} เหรียญ · 👥{' '}
          {rules.playersPerTeam} คน/เครื่อง{rules.sabotage ? ' · 😈 การ์ดป่วน' : ''}
        </div>
      )}

      {/* ── เลือกขุนศึก ── แตะรูปเพื่อเลือก/ถอด · เลขมุมบอกลำดับการเล่นในเครื่อง */}
      <section>
        <div style={sectionHead}>
          <span>เลือกขุนศึกของทีม</span>
          <span style={{ color: ready ? '#2E7D32' : color.textMuted, fontWeight: 800 }}>
            {lineup.length}/{need}
          </span>
        </div>
        <div style={kingGrid}>
          {KINGS.map((k) => {
            const at = lineup.indexOf(k.id);
            const picked = at >= 0;
            const full = lineup.length >= need && !picked;
            return (
              <button
                key={k.id}
                onClick={() => onPick(k.id)}
                disabled={full}
                style={kingCell(picked, full)}
                title={k.name}
              >
                <img src={getKingPawnImage(k.id)} alt="" draggable={false} style={kingImg} />
                {picked && <span style={pickBadge}>{at + 1}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── จอท้าชิง ── ทีมเราปะทะผู้ท้าชิง เห็นขุนศึกของกันและกันจริง ๆ */}
      <section>
        <div style={sectionHead}>
          <span>สนามท้าชิง</span>
          <span style={{ color: color.textMuted, fontWeight: 700 }}>{teams.length} ทีม</span>
        </div>
        <div style={arenaWrap}>
          <TeamCard team={mine} name={teamName} need={need} mine />
          {rivals.length > 0 && <div style={vsMark}>VS</div>}
          <div style={{ display: 'grid', gap: 8, flex: 1, minWidth: 0 }}>
            {rivals.map((t) => (
              <TeamCard key={t.name} team={t} name={t.name} need={need} />
            ))}
            {rivals.length === 0 && <div style={waitRival}>⏳ รอผู้ท้าชิง…</div>}
          </div>
        </div>
      </section>

      {isHost ? (
        <button style={primaryBtn} disabled={busy || teams.length < 2} onClick={onStart}>
          {teams.length < 2 ? 'รออีกอย่างน้อย 1 ทีม' : busy ? 'กำลังเริ่ม…' : '⚔️ เริ่มท้าชิง'}
        </button>
      ) : (
        <div style={waitBox}>⏳ รอเจ้าของห้องกดเริ่ม…</div>
      )}
      <button style={ghostBtn} onClick={onLeave}>
        ออกจากห้อง
      </button>
    </div>
  );
}

/** การ์ดทีมในสนามท้าชิง — โชว์ขุนศึกที่เลือกไว้ + สถานะพร้อม/ยังเลือกไม่ครบ */
function TeamCard({
  team,
  name,
  need,
  mine = false,
}: {
  team?: { lineup: string[]; online: boolean };
  name: string;
  need: number;
  mine?: boolean;
}) {
  const picks = team?.lineup ?? [];
  const ready = picks.length >= need;
  return (
    <div style={teamCard(mine)}>
      <div style={teamCardName}>
        {mine ? '🛡️ ' : ''}
        {name}
        {mine && <span style={mineTag}>ทีมเรา</span>}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 5, minHeight: 40 }}>
        {Array.from({ length: need }, (_, i) =>
          picks[i] ? (
            <img key={i} src={getKingPawnImage(picks[i])} alt="" draggable={false} style={slotImg} />
          ) : (
            <span key={i} style={emptySlot}>
              ?
            </span>
          )
        )}
      </div>
      <div style={{ ...readyText, color: ready ? '#2E7D32' : color.textMuted }}>
        {ready ? '● พร้อมรบ' : '○ กำลังเลือกขุนศึก'}
      </div>
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


const waitBox: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  textAlign: 'center',
  color: color.textMuted,
  padding: 10,
};

// ── สนามท้าชิง / เลือกขุนศึก ──
const sectionHead: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 14.5,
  fontWeight: 800,
  color: color.primary,
  marginBottom: 7,
};

const kingGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(58px, 1fr))',
  gap: 7,
};

function kingCell(picked: boolean, full: boolean): CSSProperties {
  return {
    position: 'relative',
    padding: '7px 3px',
    borderRadius: radius.md,
    border: `2px solid ${picked ? color.primary : 'rgba(201,162,39,.45)'}`,
    background: picked ? '#FFF3CC' : full ? '#F2EFE7' : '#fff',
    opacity: full ? 0.45 : 1,
    cursor: full ? 'not-allowed' : 'pointer',
    transition: 'transform .12s, background .15s',
    transform: picked ? 'translateY(-2px)' : 'none',
  };
}

const kingImg: CSSProperties = { width: '100%', height: 42, objectFit: 'contain', display: 'block' };

const pickBadge: CSSProperties = {
  position: 'absolute',
  top: -6,
  right: -6,
  width: 21,
  height: 21,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  background: color.primary,
  color: '#FFF3CF',
  fontSize: 12,
  fontWeight: 900,
  border: '2px solid #fff',
};

const arenaWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 8,
};

const vsMark: CSSProperties = {
  alignSelf: 'center',
  fontFamily: "'Trirong',serif",
  fontSize: 20,
  fontWeight: 900,
  color: '#8B0000',
  flexShrink: 0,
};

function teamCard(mine: boolean): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    padding: '9px 11px',
    borderRadius: radius.md,
    background: mine ? 'linear-gradient(160deg,#FFF8E2,#F6E6BE)' : 'rgba(255,255,255,.75)',
    border: `2px solid ${mine ? color.primary : 'rgba(201,162,39,.4)'}`,
  };
}

const teamCardName: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: color.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const mineTag: CSSProperties = {
  marginLeft: 6,
  padding: '1px 7px',
  borderRadius: 999,
  background: color.primary,
  color: '#FFF3CF',
  fontSize: 10.5,
  fontWeight: 800,
};

const slotImg: CSSProperties = { width: 30, height: 40, objectFit: 'contain' };

const emptySlot: CSSProperties = {
  width: 30,
  height: 40,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 6,
  border: '1.5px dashed rgba(201,162,39,.6)',
  color: 'rgba(140,110,50,.7)',
  fontSize: 15,
  fontWeight: 800,
};

const readyText: CSSProperties = { marginTop: 4, fontSize: 12, fontWeight: 800 };

const waitRival: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: 92,
  borderRadius: radius.md,
  border: '2px dashed rgba(201,162,39,.5)',
  color: color.textMuted,
  fontSize: 14,
  fontWeight: 700,
};

// ── นับถอยหลังก่อนเข้ากระดาน ──
const countdownShell: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  display: 'grid',
  placeItems: 'center',
  alignContent: 'center',
  gap: 6,
  background: 'radial-gradient(120% 120% at 50% 40%, #3A1B0A, #140803)',
};

const countdownLabel: CSSProperties = {
  fontFamily: "'Trirong',serif",
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '.2em',
  color: '#E6C35C',
};

const countdownNumber: CSSProperties = {
  fontFamily: "'Trirong',serif",
  fontSize: 'clamp(90px, 26vw, 170px)',
  fontWeight: 800,
  lineHeight: 1,
  color: '#FFF3CF',
  textShadow: '0 0 40px rgba(233,195,92,.7)',
  animation: 'cdPop .5s cubic-bezier(.2,1.2,.4,1) both',
};
