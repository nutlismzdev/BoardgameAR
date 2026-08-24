// 📊 ผลแบบทดสอบก่อน/หลังเรียน — จอของครู (อยู่หลังรหัสครู)
//
// 2 ระดับ: รายชื่อทั้งห้อง → กดที่นักเรียน → รายละเอียดครบทั้ง 30 ข้อของคนนั้น
// ข้อมูลมาจาก server/test.php (GET ต้องมี token) **รวมกับผลที่อยู่ในเครื่องนี้**
// เพราะโรงเรียนที่ยังไม่ได้ตั้ง VITE_API_BASE ก็ต้องดูผลของแท็บเล็ตเครื่องนี้ได้

import { useEffect, useMemo, useState } from 'react';
import { TestAuthError, fetchResults, testApiAvailable } from '@/core/testApi';
import { login } from '@/core/api';
import type { TestResultRow } from '@/core/testApi';
import { useTest } from '@/core/testStore';
import {
  TEST_QUESTIONS,
  TEST_TOTAL,
  UNANSWERED,
  compareAttempts,
  isCorrect,
  scoreAttempt,
} from '@/core/pretest';
import { color, radius, elevation } from '@/theme/tokens';
import { Status, muted, primaryButton, secondaryButton } from './adminStyles';
import {
  EraStrip,
  TEST_STYLE,
  colorOfKing,
  formatDuration,
  formatDateTime,
  hexA,
  labelOfKing,
  shade,
} from '@/screens/Test/testUi';

const CHOICE_LETTERS = ['ก', 'ข', 'ค', 'ง'];

interface StudentRow {
  key: string;
  no: string;
  room: string;
  name: string;
  pre: TestResultRow | null;
  post: TestResultRow | null;
}

type SortKey = 'roster' | 'post' | 'gain';

export function TestResultsPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<TestResultRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [room, setRoom] = useState('all');
  const [sort, setSort] = useState<SortKey>('roster');
  const [openKey, setOpenKey] = useState<string | null>(null);
  // เคยเรียกข้อมูลจากระบบโรงเรียนสำเร็จแล้วหรือยัง — ตัวชี้ว่า "ใครเป็นเจ้าของความจริง"
  // ⚠️ ตั้งเป็น true แล้วไม่ปลดกลับ: ถ้ารีเฟรชรอบหลังพลาด (token หมดอายุ/เน็ตสะดุด)
  // ต้องคาแสดงรายการเดิมจากระบบโรงเรียนไว้ + ขึ้นข้อความบอกว่ารีเฟรชไม่สำเร็จ
  // ห้ามสลับไปโชว์ผลในเครื่องแทน เพราะครูจะนึกว่าข้อมูลในระบบเปลี่ยนไปเอง
  const [serverOk, setServerOk] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // ต้องใส่รหัสครูก่อนถึงจะดึงผลได้ — เปิดช่องกรอกในจอนี้เลย
  // (เดิมขึ้นแค่ข้อความ "กรุณาเข้าสู่ระบบ" แต่ไม่มีที่ให้กรอก ครูต้องเดาเองว่าต้องย้อนไปหน้าไหน)
  const [needLogin, setNeedLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // ผลที่ทำบนเครื่องนี้ — มีชื่อจริงเสมอแม้ครูจะปิดสวิตช์ส่งชื่อขึ้นส่วนกลาง
  const localResults = useTest((s) => s.results);
  const pendingCount = useTest((s) => s.queue.length);
  const clearLocalResults = useTest((s) => s.clearLocalResults);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    if (!testApiAvailable()) {
      setError('ขณะนี้ยังไม่ได้เชื่อมต่อกับระบบของโรงเรียน จึงแสดงเฉพาะผลที่ทำบนแท็บเล็ตเครื่องนี้');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setRows(await fetchResults());
      setServerOk(true);
      setNeedLogin(false);
    } catch (err) {
      setNeedLogin(err instanceof TestAuthError);
      setError(
        (err instanceof Error ? err.message : 'ไม่สามารถเรียกดูผลจากระบบของโรงเรียนได้') +
          (serverOk
            ? ' ข้อมูลด้านล่างเป็นรายการล่าสุดที่เรียกมาได้'
            : ' ขณะนี้แสดงเฉพาะผลที่ทำบนแท็บเล็ตเครื่องนี้')
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * ⚠️ เมื่อเรียกข้อมูลจากระบบโรงเรียนได้ **ระบบโรงเรียนคือเจ้าของรายการทั้งหมด**
   * ผลที่ค้างอยู่ในเครื่องใช้ได้แค่ "เติมชื่อ" ให้แถวที่มีอยู่จริงเท่านั้น
   *
   * เดิมเอาผลในเครื่องมารวมเป็นรายการด้วย → คุณครูลบแถวในฐานข้อมูลแล้วชื่อยังค้างบนจอ
   * เพราะสำเนาในแท็บเล็ตไม่ได้ถูกลบไปด้วย (ดูปุ่ม "ล้างผลที่บันทึกไว้ในเครื่องนี้")
   * ผลในเครื่องจะกลายเป็นรายการหลักเฉพาะตอนเรียกระบบโรงเรียนไม่ได้เท่านั้น
   */
  const merged = useMemo<TestResultRow[]>(() => {
    const localById = new Map(localResults.map((r) => [`${r.mode}|${r.studentKey}`, r]));
    if (serverOk) {
      return rows.map((r) => ({
        ...r,
        studentName: r.studentName || localById.get(`${r.mode}|${r.studentKey}`)?.studentName || '',
      }));
    }
    return localResults.map((r) => ({ ...r, attempts: 1, updatedAt: r.submittedAt }));
  }, [rows, localResults, serverOk]);

  const students = useMemo<StudentRow[]>(() => {
    const map = new Map<string, StudentRow>();
    for (const r of merged) {
      const cur =
        map.get(r.studentKey) ??
        { key: r.studentKey, no: r.studentNo, room: r.studentRoom, name: '', pre: null, post: null };
      if (r.studentName) cur.name = r.studentName;
      if (r.mode === 'pre') cur.pre = r;
      else cur.post = r;
      map.set(r.studentKey, cur);
    }
    return [...map.values()];
  }, [merged]);

  const rooms = useMemo(
    () => [...new Set(students.map((s) => s.room))].sort((a, b) => a.localeCompare(b, 'th')),
    [students]
  );

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const gainOf = (s: StudentRow) => (s.pre && s.post ? s.post.score - s.pre.score : -Infinity);
    return students
      .filter((s) => room === 'all' || s.room === room)
      .filter((s) => !keyword || `${s.name} ${s.no} ${s.room}`.toLowerCase().includes(keyword))
      .sort((a, b) => {
        if (sort === 'post') return (b.post?.score ?? -1) - (a.post?.score ?? -1);
        if (sort === 'gain') return gainOf(b) - gainOf(a);
        return a.room.localeCompare(b.room, 'th') || (Number(a.no) || 0) - (Number(b.no) || 0);
      });
  }, [students, search, room, sort]);

  useEffect(() => {
    setPage(1);
  }, [search, room, sort, pageSize]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount); // ลบคนออกจนหน้าปัจจุบันหายไป ต้องไม่ค้างจอว่าง
  const paged = visible.slice((safePage - 1) * pageSize, safePage * pageSize);

  const localCount = localResults.length;
  const withBoth = visible.filter((s) => s.pre && s.post);
  const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
  const avgPre = avg(withBoth.map((s) => s.pre!.score));
  const avgPost = avg(withBoth.map((s) => s.post!.score));

  // ทั้งห้องอ่อนพระองค์ไหน (ใช้ผลหลังเรียน) — ตัวชี้ว่าต้องสอนซ้ำเรื่องไหน
  const classByKing = useMemo(() => {
    const posts = visible.map((s) => s.post).filter(Boolean) as TestResultRow[];
    if (!posts.length) return [];
    const acc = new Map<string, { correct: number; total: number }>();
    for (const r of posts) {
      for (const q of TEST_QUESTIONS) {
        const cur = acc.get(q.kingId) ?? { correct: 0, total: 0 };
        cur.total++;
        if (isCorrect(q.no, r.answers[q.no - 1] ?? UNANSWERED)) cur.correct++;
        acc.set(q.kingId, cur);
      }
    }
    return [...acc.entries()]
      .map(([kingId, v]) => ({ kingId, ...v, pct: v.total ? v.correct / v.total : 0 }))
      .sort((a, b) => a.pct - b.pct);
  }, [visible]);

  const itemStats = useMemo(() => {
    const posts = visible.map((s) => s.post).filter(Boolean) as TestResultRow[];
    if (!posts.length) return [];
    return TEST_QUESTIONS.map((q) => {
      let wrong = 0;
      let answered = 0;
      for (const r of posts) {
        const picked = r.answers[q.no - 1] ?? UNANSWERED;
        if (picked === UNANSWERED) continue;
        answered++;
        if (!isCorrect(q.no, picked)) wrong++;
      }
      return { no: q.no, kingId: q.kingId, question: q.question, wrong, answered };
    })
      .filter((s) => s.wrong > 0)
      .sort((a, b) => b.wrong / (b.answered || 1) - a.wrong / (a.answered || 1))
      .slice(0, 8);
  }, [visible]);

  const exportCsv = () => {
    const head = [
      'ชั้น',
      'เลขที่',
      'ชื่อ-นามสกุล',
      'คะแนนก่อนเรียน',
      'คะแนนหลังเรียน',
      'พัฒนาการ',
      'เวลาที่ใช้ก่อนเรียน (วินาที)',
      'เวลาที่ใช้หลังเรียน (วินาที)',
      'จำนวนครั้งที่ทำ',
    ];
    const lines = visible.map((s) => [
      s.room,
      s.no,
      s.name,
      s.pre ? s.pre.score : '',
      s.post ? s.post.score : '',
      s.pre && s.post ? s.post.score - s.pre.score : '',
      s.pre ? s.pre.durationSec : '',
      s.post ? s.post.durationSec : '',
      Math.max(s.pre?.attempts ?? 0, s.post?.attempts ?? 0),
    ]);
    const csv = [head, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    // ﻿ = BOM — ไม่มีแล้ว Excel ภาษาไทยจะเปิดเป็นตัวยึกยือทันที
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ผลแบบทดสอบ-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const opened = openKey ? students.find((s) => s.key === openKey) ?? null : null;

  return (
    <div style={overlay}>
      <style>{TEST_STYLE}</style>
      <div style={panel}>
        {opened ? (
          <StudentDetail student={opened} onBack={() => setOpenKey(null)} onClose={onClose} />
        ) : (
          <>
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 21, color: color.primary, textWrap: 'balance' }}>
                📊 ผลแบบทดสอบก่อน/หลังเรียน
              </h2>
              <div style={{ flex: 1 }} />
              <button className="t-tap" onClick={() => void load()} disabled={busy} style={secondaryButton}>
                {busy ? 'กำลังเรียกข้อมูล…' : 'เรียกข้อมูลล่าสุด'}
              </button>
              <button className="t-tap" onClick={exportCsv} disabled={!visible.length} style={secondaryButton}>
                ⬇ บันทึกเป็นไฟล์ตารางคะแนน
              </button>
              <button className="t-tap" onClick={onClose} style={primaryButton}>
                ปิด
              </button>
            </header>

            {error && <Status tone="error" text={error} />}

            {needLogin && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAuthBusy(true);
                  try {
                    await login(password);
                    setPassword('');
                    await load();
                  } catch {
                    setError('รหัสไม่ถูกต้อง');
                  } finally {
                    setAuthBusy(false);
                  }
                }}
                style={loginBar}
              >
                <span style={{ fontWeight: 700 }}>🔒 ใส่รหัสคุณครูเพื่อดูผลของทั้งห้อง</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสครู"
                  autoComplete="current-password"
                  style={{ ...filterInput, flex: '1 1 160px', maxWidth: 240 }}
                />
                <button type="submit" disabled={authBusy || !password} style={primaryButton}>
                  {authBusy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
                </button>
              </form>
            )}

            <div style={sourceBar}>
              <span>
                {serverOk
                  ? `เชื่อมต่อระบบของโรงเรียนแล้ว · ได้ข้อมูล ${rows.length} รายการ (${students.length} คน)`
                  : 'ยังไม่ได้ข้อมูลจากระบบของโรงเรียน · กำลังแสดงผลที่บันทึกไว้ในแท็บเล็ตเครื่องนี้'}
                {localCount > 0 && ` · เครื่องนี้เก็บผลไว้ ${localCount} รายการ`}
                {pendingCount > 0 && ` · รอส่งอีก ${pendingCount} รายการ`}
              </span>
              <div style={{ flex: 1 }} />
              {confirmClear ? (
                <>
                  <span style={{ color: color.danger, fontWeight: 700 }}>
                    ยืนยันลบผลทั้งหมดที่บันทึกไว้ในเครื่องนี้ (ไม่กระทบผลในระบบของโรงเรียน)
                  </span>
                  <button className="t-tap" onClick={() => setConfirmClear(false)} style={secondaryButton}>
                    ยกเลิก
                  </button>
                  <button
                    className="t-tap"
                    onClick={() => {
                      clearLocalResults();
                      setConfirmClear(false);
                    }}
                    style={{ ...secondaryButton, borderColor: color.danger, color: color.danger }}
                  >
                    ยืนยันล้างข้อมูล
                  </button>
                </>
              ) : (
                (localCount > 0 || pendingCount > 0) && (
                  <button className="t-tap" onClick={() => setConfirmClear(true)} style={secondaryButton}>
                    ล้างผลที่บันทึกไว้ในเครื่องนี้
                  </button>
                )
              )}
            </div>

            {/* ตัวกรอง */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={filterField}>
                <span style={filterLabel}>ค้นหา</span>
                <input
                  className="t-input"
                  style={filterInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ชื่อ-นามสกุล หรือ เลขที่"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label style={filterField}>
                <span style={filterLabel}>ชั้น</span>
                <select className="t-input" style={filterInput} value={room} onChange={(e) => setRoom(e.target.value)}>
                  <option value="all">ทุกชั้น</option>
                  {rooms.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label style={filterField}>
                <span style={filterLabel}>เรียงตาม</span>
                <select
                  className="t-input"
                  style={filterInput}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                >
                  <option value="roster">เลขที่</option>
                  <option value="post">คะแนนหลังเรียน</option>
                  <option value="gain">พัฒนาการ</option>
                </select>
              </label>
              <span style={{ ...muted, paddingBottom: 10 }}>{visible.length} คน</span>
            </div>

            {/* ⚠️ ต้องมี "พื้นที่เลื่อนเดียว" ครอบตั้งแต่สรุปลงไปจนท้ายจอ
                เดิมตารางกิน `flex: 1` ส่วนสองหมวดล่างเป็น flex item พี่น้องกัน แล้ว `panel`
                ก็ไม่ได้ตั้ง overflow ไว้ → พอจอเตี้ย (แท็บเล็ต 1024×640 เหลือพื้นที่ ~549px
                แต่เนื้อหารวม ~700px) ส่วนเกินจะล้นออกนอกการ์ดขาวโดยไม่มีที่ไหนเลื่อนได้เลย
                "ภาพรวมรายพระองค์" กับ "ข้อที่ตอบผิดมากที่สุด" จึงโดนตัดหาย กดไม่ถึง */}
            <div className="t-scroll t-stack" style={resultsBody}>
            {!!withBoth.length && (
              <div style={summary}>
                <Stat label="ทำครบทั้งก่อนและหลังเรียน" value={`${withBoth.length} คน`} />
                <Stat label="เฉลี่ยก่อนเรียน" value={`${avgPre.toFixed(1)} / ${TEST_TOTAL}`} />
                <Stat label="เฉลี่ยหลังเรียน" value={`${avgPost.toFixed(1)} / ${TEST_TOTAL}`} />
                <Stat
                  label="พัฒนาการเฉลี่ย"
                  value={`${avgPost - avgPre >= 0 ? '+' : ''}${(avgPost - avgPre).toFixed(1)} คะแนน`}
                  tone={avgPost - avgPre >= 0 ? color.success : color.danger}
                />
              </div>
            )}

            {/* เลื่อนแนวนอนอย่างเดียว — แนวตั้งปล่อยให้พื้นที่เลื่อนหลักด้านนอกจัดการ
                (ซ้อนพื้นที่เลื่อนแนวตั้ง 2 ชั้นบนจอสัมผัส = นิ้วลากแล้วไม่รู้ว่าอันไหนจะขยับ) */}
            <div style={{ overflowX: 'auto' }}>
              <table style={table}>
                <caption style={srOnly}>ตารางผลการทำแบบทดสอบรายบุคคล เลือกที่รายชื่อเพื่อดูรายละเอียด</caption>
                <thead>
                  <tr>
                    {['ชั้น', 'เลขที่', 'ชื่อ', 'ก่อนเรียน', 'หลังเรียน', 'พัฒนาการ', ''].map((h, i) => (
                      <th key={i} scope="col" style={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((s) => {
                    const diff = s.pre && s.post ? s.post.score - s.pre.score : null;
                    const repeated = Math.max(s.pre?.attempts ?? 0, s.post?.attempts ?? 0) > 1;
                    return (
                      <tr key={s.key} style={{ cursor: 'pointer' }} onClick={() => setOpenKey(s.key)}>
                        <td style={td}>{s.room}</td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{s.no}</td>
                        <td style={td}>
                          {s.name || <span style={muted}>ไม่ได้ระบุชื่อ</span>}
                          {repeated && <span style={{ ...muted, marginLeft: 6 }}>ทำซ้ำ</span>}
                        </td>
                        <td style={scoreTd}>{s.pre ? `${s.pre.score}/${s.pre.total}` : '—'}</td>
                        <td style={scoreTd}>{s.post ? `${s.post.score}/${s.post.total}` : '—'}</td>
                        <td
                          style={{
                            ...scoreTd,
                            fontWeight: 800,
                            color: diff === null ? color.textMuted : diff >= 0 ? color.success : color.danger,
                          }}
                        >
                          {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${diff}`}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <button
                            className="t-tap"
                            style={linkButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenKey(s.key);
                            }}
                          >
                            ดูรายละเอียด →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!visible.length && !busy && (
                    <tr>
                      <td colSpan={7} style={{ ...td, textAlign: 'center', color: color.textMuted }}>
                        {students.length
                          ? 'ไม่พบนักเรียนตามเงื่อนไขที่เลือก'
                          : 'ยังไม่มีผลการทำแบบทดสอบ'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {visible.length > 0 && (
              <nav style={pager} aria-label="เปลี่ยนหน้ารายชื่อ">
                <span style={{ ...muted, fontVariantNumeric: 'tabular-nums' }}>
                  แสดง {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, visible.length)} จาก{' '}
                  {visible.length} คน
                </span>
                <div style={{ flex: 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...muted }}>
                  ต่อหน้า
                  <select
                    className="t-input"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    style={{ ...filterInput, width: 'auto', minHeight: 38, padding: '6px 10px' }}
                  >
                    {[20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="t-tap"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  aria-label="หน้าก่อนหน้า"
                  style={{ ...secondaryButton, opacity: safePage <= 1 ? 0.45 : 1 }}
                >
                  ←
                </button>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {safePage} / {pageCount}
                </span>
                <button
                  className="t-tap"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount}
                  aria-label="หน้าถัดไป"
                  style={{ ...secondaryButton, opacity: safePage >= pageCount ? 0.45 : 1 }}
                >
                  →
                </button>
              </nav>
            )}

            {/* พับเก็บไว้ก่อน — ของหลักคือตารางรายชื่อ สองหมวดนี้เป็นข้อมูลประกอบที่ครูเปิดดูเป็นครั้งคราว
                แต่หัวข้อต้องบอก "ของสำคัญที่สุดข้างใน" ไว้ด้วย ไม่งั้นเป็นกล่องปิดตาที่ครูไม่รู้ว่าควรเปิดไหม */}
            {!!classByKing.length && (
              <details className="t-fold" style={foldBox}>
                <summary style={foldSummary}>
                  <span style={foldTitle}>ภาพรวมผลการเรียนรู้รายพระองค์ (หลังเรียน)</span>
                  <span style={foldHint}>
                    ต้องทบทวนที่สุด: {labelOfKing(classByKing[0].kingId)}{' '}
                    {Math.round(classByKing[0].pct * 100)}%
                  </span>
                </summary>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10 }}>
                  {classByKing.map((k) => (
                    <span key={k.kingId} style={kingPill(k.kingId)}>
                      {labelOfKing(k.kingId)} {Math.round(k.pct * 100)}%
                    </span>
                  ))}
                </div>
              </details>
            )}

            {!!itemStats.length && (
              <details className="t-fold" style={foldBox}>
                <summary style={foldSummary}>
                  <span style={foldTitle}>ข้อที่นักเรียนตอบผิดมากที่สุด</span>
                  <span style={foldHint}>{itemStats.length} ข้อที่ควรทบทวนในชั้นเรียน</span>
                </summary>
                <div style={{ display: 'grid', gap: 6, paddingTop: 10 }}>
                  {itemStats.map((s) => (
                    <div key={s.no} style={itemRow}>
                      <span style={{ ...pill, background: colorOfKing(s.kingId) }}>{labelOfKing(s.kingId)}</span>
                      <span style={{ fontWeight: 800, minWidth: 22 }}>{s.no}.</span>
                      {/* ต้องกว้างพอจะอ่านออก ไม่งั้นโดนบีบเหลือ 2-3 ตัวอักษรต่อบรรทัดบนจอแคบ
                          → ให้ขึ้นบรรทัดใหม่ทั้งแถวแทนการบีบ (flex-basis 220px) */}
                      <span style={{ flex: '1 1 220px', fontSize: 14, minWidth: 0, lineHeight: 1.45 }}>
                        {s.question}
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontWeight: 800,
                          color: color.danger,
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        ตอบผิด {s.wrong} จาก {s.answered} คน
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── รายละเอียดรายคน ───────────────────────────────────────────────────────
function StudentDetail({
  student,
  onBack,
  onClose,
}: {
  student: StudentRow;
  onBack: () => void;
  onClose: () => void;
}) {
  const [wrongOnly, setWrongOnly] = useState(false);
  const pre = student.pre;
  const post = student.post;
  const preScore = pre ? scoreAttempt(pre.answers) : null;
  const postScore = post ? scoreAttempt(post.answers) : null;
  const gain = preScore && postScore ? compareAttempts(preScore, postScore) : null;

  const answerOf = (row: TestResultRow | null, no: number) => row?.answers[no - 1] ?? UNANSWERED;

  const questions = TEST_QUESTIONS.filter((q) => {
    if (!wrongOnly) return true;
    const p = answerOf(post ?? pre, q.no);
    return p !== q.answer;
  });

  return (
    <>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="t-tap" onClick={onBack} style={secondaryButton}>
          ← กลับสู่รายชื่อนักเรียน
        </button>
        <h2 style={{ margin: 0, fontSize: 20, color: color.primary, textWrap: 'balance' }}>
          {student.name || 'ไม่ได้ระบุชื่อ'}
          <span style={{ ...muted, fontWeight: 400, marginLeft: 8 }}>
            เลขที่ {student.no} · {student.room}
          </span>
        </h2>
        <div style={{ flex: 1 }} />
        <button className="t-tap" onClick={onClose} style={primaryButton}>
          ปิด
        </button>
      </header>

      <div className="t-scroll t-stack" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {/* สรุปสองรอบ */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <RoundCard title="ก่อนเรียน" row={pre} />
          <RoundCard title="หลังเรียน" row={post} />
          {gain && (
            <div style={{ ...roundCard, borderColor: color.secondary, minWidth: 190 }}>
              <span style={filterLabel}>พัฒนาการ</span>
              <strong
                style={{
                  fontSize: 30,
                  color: gain.diff >= 0 ? color.success : color.danger,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {gain.diff >= 0 ? '+' : ''}
                {gain.diff}
              </strong>
              <span style={muted}>
                {gain.pre} → {gain.post} คะแนน
                {gain.normalized !== null &&
                  ` · ทำคะแนนส่วนที่เคยตอบไม่ได้ เพิ่มขึ้น ${Math.round(gain.normalized * 100)}%`}
              </span>
            </div>
          )}
        </div>

        {/* ไทม์ไลน์ถูก/ผิด */}
        <section style={{ display: 'grid', gap: 10, background: '#FBF3E4', borderRadius: radius.md, padding: 14 }}>
          <h3 style={sectionTitle}>ผลการตอบรายข้อ เรียงตามลำดับรัชสมัย</h3>
          {pre && (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={filterLabel}>ก่อนเรียน</span>
              <EraStrip
                state={(no) => stateOf(answerOf(pre, no), no)}
                showLabels={false}
                ariaLabel="ผลรายข้อก่อนเรียน"
              />
            </div>
          )}
          {post && (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={filterLabel}>หลังเรียน</span>
              <EraStrip state={(no) => stateOf(answerOf(post, no), no)} ariaLabel="ผลรายข้อหลังเรียน" />
            </div>
          )}
        </section>

        {/* รายพระองค์ — ใช้การไหลปกติ ไม่ใช่ grid
            เพราะกล่องครอบตารางเป็น scroll container ที่ยุบเหลือ 0 ได้ (ดูกฎ .t-stack ใน testUi.tsx) */}
        {(preScore || postScore) && (
          <section className="t-stack">
            <h3 style={sectionTitle}>คะแนนรายพระองค์</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={table}>
                <thead>
                  <tr>
                    {['พระองค์', 'ก่อนเรียน', 'หลังเรียน', 'เปลี่ยนแปลง'].map((h) => (
                      <th key={h} scope="col" style={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(postScore ?? preScore)!.byKing.map((k) => {
                    const p = preScore?.byKing.find((x) => x.kingId === k.kingId);
                    const q = postScore?.byKing.find((x) => x.kingId === k.kingId);
                    const d = p && q ? q.correct - p.correct : null;
                    return (
                      <tr key={k.kingId}>
                        <td style={td}>
                          <span style={kingPill(k.kingId)}>{labelOfKing(k.kingId)}</span>
                        </td>
                        <td style={scoreTd}>{p ? `${p.correct}/${p.total}` : '—'}</td>
                        <td style={scoreTd}>{q ? `${q.correct}/${q.total}` : '—'}</td>
                        <td
                          style={{
                            ...scoreTd,
                            fontWeight: 800,
                            color: d === null ? color.textMuted : d >= 0 ? color.success : color.danger,
                          }}
                        >
                          {d === null ? '—' : `${d >= 0 ? '+' : ''}${d}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* รายข้อ */}
        <section style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h3 style={sectionTitle}>คำตอบรายข้อ ({questions.length} ข้อ)</h3>
            <div style={{ flex: 1 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={wrongOnly} onChange={(e) => setWrongOnly(e.target.checked)} />
              แสดงเฉพาะข้อที่ยังตอบผิด
            </label>
          </div>

          {questions.map((q) => {
            const p = answerOf(pre, q.no);
            const s = answerOf(post, q.no);
            const latest = post ? s : p;
            return (
              <article key={q.no} style={{ ...questionCard, borderLeftColor: latest === q.answer ? color.success : color.danger }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, color: color.secondary, minWidth: 26 }}>{q.no}.</span>
                  <span style={kingPill(q.kingId)}>{labelOfKing(q.kingId)}</span>
                  <span style={{ flex: '1 1 240px', fontWeight: 700, minWidth: 0, lineHeight: 1.45 }}>{q.question}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingLeft: 34 }}>
                  <AnswerChip label="ก่อนเรียน" picked={p} answer={q.answer} choices={q.choices} shown={!!pre} />
                  <AnswerChip label="หลังเรียน" picked={s} answer={q.answer} choices={q.choices} shown={!!post} />
                </div>
                <div style={{ paddingLeft: 34, fontSize: 14.5, color: color.success, fontWeight: 700 }}>
                  คำตอบที่ถูกต้อง: {CHOICE_LETTERS[q.answer]}. {q.choices[q.answer]}
                </div>
                <details style={{ paddingLeft: 34 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 14, color: color.textMuted }}>คำอธิบาย</summary>
                  <p style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.6, color: '#5A4A2E' }}>{q.explanation}</p>
                </details>
              </article>
            );
          })}
        </section>
      </div>
    </>
  );
}

function stateOf(picked: number, no: number) {
  if (picked === UNANSWERED) return 'empty' as const;
  return isCorrect(no, picked) ? ('correct' as const) : ('wrong' as const);
}

function AnswerChip({
  label,
  picked,
  answer,
  choices,
  shown,
}: {
  label: string;
  picked: number;
  answer: number;
  choices: string[];
  shown: boolean;
}) {
  if (!shown) {
    return (
      <span style={{ ...chip, borderColor: '#DED3BC', color: color.textMuted }}>
        {label}: ยังไม่ได้ทำ
      </span>
    );
  }
  if (picked === UNANSWERED) {
    return <span style={{ ...chip, borderColor: color.danger, color: color.danger }}>{label}: ไม่ได้ตอบ</span>;
  }
  const ok = picked === answer;
  return (
    <span style={{ ...chip, borderColor: ok ? color.success : color.danger, color: ok ? '#1B5E20' : color.danger }}>
      {label}: {ok ? '✓' : '✕'} {CHOICE_LETTERS[picked]}. {choices[picked]}
    </span>
  );
}

function RoundCard({ title, row }: { title: string; row: TestResultRow | null }) {
  return (
    <div style={roundCard}>
      <span style={filterLabel}>{title}</span>
      {row ? (
        <>
          <strong style={{ fontSize: 30, color: color.text, fontVariantNumeric: 'tabular-nums' }}>
            {row.score}
            <span style={{ fontSize: 16, color: color.textMuted }}> / {row.total}</span>
          </strong>
          <span style={muted}>ใช้เวลา {formatDuration(row.durationSec)}</span>
          <span style={muted}>ส่งเมื่อ {formatDateTime(row.submittedAt)}</span>
          {row.attempts > 1 && (
            <span style={{ ...muted, color: color.danger }}>ทำซ้ำ {row.attempts} ครั้ง</span>
          )}
        </>
      ) : (
        <span style={{ ...muted, paddingTop: 8 }}>ยังไม่ได้ทำแบบทดสอบ</span>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <span style={filterLabel}>{label}</span>
      <strong style={{ fontSize: 18, color: tone ?? color.text, fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.55)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 220,
  padding: 'max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom))',
};

const panel: React.CSSProperties = {
  width: 'min(1040px, 100%)',
  // maxHeight (ไม่ใช่ height) — มีนักเรียน 3 คนก็ไม่ต้องเปิดการ์ดสูงเต็มจอทิ้งที่ว่างไว้
  // พอเนื้อหาเกินเพดาน กล่อง `resultsBody` (flex:1 + minHeight:0) จะรับหน้าที่เลื่อนเอง
  maxHeight: 'min(92vh, 100%)',
  background: color.surface,
  borderRadius: radius.lg,
  boxShadow: elevation.modal,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  fontFamily: "'Sarabun', sans-serif",
  color: color.text,
  minHeight: 0,
};

const sourceBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  fontSize: 13,
  color: color.textMuted,
  background: '#FBF3E4',
  borderRadius: radius.sm,
  padding: '8px 12px',
};

/** พื้นที่เลื่อนหลักของจอรายชื่อ — ทุกอย่างใต้แถบตัวกรองอยู่ในนี้ที่เดียว */
const resultsBody: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  // ❗ ห้ามใช้ display:grid/flex ตรงนี้ — ดูเหตุผลที่กฎ `.t-stack` ใน testUi.tsx
  // (กล่องครอบตารางเป็น scroll container ซึ่งยุบเหลือ 0 ได้ในกริด = ตารางหายทั้งก้อน)
};

const summary: React.CSSProperties = {
  display: 'flex',
  gap: '10px 24px',
  flexWrap: 'wrap',
  background: '#FBF3E4',
  borderRadius: radius.md,
  padding: '12px 16px',
};

const pager: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  fontSize: 13.5,
};

const foldBox: React.CSSProperties = {
  border: '1.5px solid #E4D7B8',
  borderRadius: radius.md,
  padding: '4px 12px 10px',
};

const foldSummary: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  padding: '10px 2px',
  minHeight: 44, // เป้าสัมผัสต้องกดง่ายบนแท็บเล็ต
};

const foldTitle: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: color.text };

/** สรุปสั้น ๆ ที่เห็นได้ทั้งที่ยังพับอยู่ — ครูจะได้ตัดสินใจได้ว่าต้องเปิดดูไหม */
const foldHint: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: 13,
  color: color.textMuted,
  fontWeight: 700,
};

const loginBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  background: '#FFF6D8',
  border: `1.5px solid ${color.secondary}`,
  borderRadius: radius.md,
  padding: '12px 14px',
};

const filterField: React.CSSProperties = { display: 'grid', gap: 4, flex: '1 1 150px', minWidth: 0 };
const filterLabel: React.CSSProperties = { fontSize: 12.5, color: color.textMuted, fontWeight: 700 };
const filterInput: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 16,
  padding: '9px 11px',
  minHeight: 42,
  borderRadius: radius.sm,
  border: `1.5px solid ${color.secondary}`,
  background: '#fff',
  color: color.text,
  width: '100%',
  outline: 'none',
};

const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14.5 };
// ⚠️ ไม่ใช้ `position: sticky` แล้ว — ตารางถูกครอบด้วยกล่องที่เลื่อนแนวนอน
// (`overflow-x: auto` ทำให้แกน y กลายเป็น auto ตามสเปกด้วย) หัวตารางจึงจะไป "ติด"
// กับกล่องนั้นซึ่งไม่เคยเลื่อนแนวตั้ง = ได้หัวตารางที่ไม่ติดจริงแต่กินความซับซ้อนฟรี ๆ
// ถ้าอยากได้หัวติดจริงต้องให้ตารางมีพื้นที่เลื่อนแนวตั้งของตัวเอง ซึ่งจะกลายเป็น
// พื้นที่เลื่อนซ้อนกัน 2 ชั้นบนจอสัมผัส (นิ้วลากแล้วไม่รู้ว่าอันไหนจะขยับ)
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '9px 10px',
  borderBottom: `2px solid ${color.secondary}`,
  background: color.surface,
  fontSize: 13.5,
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #EFE6D2' };
const scoreTd: React.CSSProperties = { ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 800, color: color.text };

const itemRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  // ห่อบรรทัดได้ — จอแคบต้องให้โจทย์ยาวขึ้นบรรทัดใหม่ ไม่ใช่โดนบีบจนอ่านไม่ออก
  flexWrap: 'wrap',
  gap: 9,
  padding: '8px 10px',
  background: '#FBF3E4',
  borderRadius: radius.sm,
};

const pill: React.CSSProperties = {
  color: '#fff',
  fontSize: 11.5,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
};

const kingPill = (kingId: string): React.CSSProperties => ({
  display: 'inline-block',
  fontSize: 12,
  fontWeight: 700,
  padding: '2px 9px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  background: hexA(colorOfKing(kingId), 0.14),
  border: `1.5px solid ${hexA(colorOfKing(kingId), 0.5)}`,
  color: shade(colorOfKing(kingId)),
});

const roundCard: React.CSSProperties = {
  display: 'grid',
  gap: 3,
  alignContent: 'start',
  flex: '1 1 200px',
  minWidth: 0,
  border: `1.5px solid #E4D7B8`,
  borderRadius: radius.md,
  padding: 14,
};

const questionCard: React.CSSProperties = {
  display: 'grid',
  gap: 7,
  border: '1px solid #EFE6D2',
  borderLeft: `5px solid ${color.secondary}`,
  borderRadius: radius.sm,
  padding: '11px 13px',
};

const chip: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 999,
  border: '1.5px solid',
  maxWidth: '100%',
  overflowWrap: 'anywhere',
};

const linkButton: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13.5,
  fontWeight: 700,
  color: color.primary,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '6px 4px',
  whiteSpace: 'nowrap',
};

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};
