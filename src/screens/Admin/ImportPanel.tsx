// หน้านำเข้าการ์ดจากไฟล์ Excel — ดาวน์โหลดเทมเพลต → เลือกไฟล์ → พรีวิว/ตรวจ → ยืนยันนำเข้า
// ตัวอ่าน xlsx ถูก dynamic import ใน cardImport.ts จึงแยกเป็น chunk ต่างหาก ไม่ถ่วง bundle ของเกม

import { useState } from 'react';
import { importCards, type ImportSummary } from '@/core/api';
import {
  downloadTemplate,
  parseWorkbook,
  typeLabel,
  TEMPLATE_FILENAME,
  type ImportType,
  type ParsedSheet,
} from '@/core/cardImport';
import { color, elevation, radius } from '@/theme/tokens';
import { dangerButton, muted, primaryButton, secondaryButton, Status, uploadButton } from './adminStyles';

type Mode = 'upsert' | 'replace';

export function ImportPanel({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (types: ImportType[]) => Promise<void> | void;
}) {
  const [sheets, setSheets] = useState<ParsedSheet[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<Mode>('upsert');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ type: ImportType; summary: ImportSummary }[] | null>(null);

  const readyRows = (sheets ?? []).flatMap((sheet) => sheet.rows.filter((row) => row.card));
  const badRows = (sheets ?? []).flatMap((sheet) => sheet.rows.filter((row) => !row.card).map((row) => ({ sheet, row })));

  async function handleTemplate() {
    setError('');
    try {
      await downloadTemplate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างไฟล์เทมเพลตไม่สำเร็จ');
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setError('');
    setResult(null);
    setSheets(null);
    setFileName(file.name);
    try {
      const parsed = await parseWorkbook(file);
      if (!parsed.length) {
        setError(`ไม่พบชีตข้อมูลที่รู้จักในไฟล์นี้ — กรุณาใช้ไฟล์เทมเพลต (${TEMPLATE_FILENAME}) แล้วอย่าเปลี่ยนชื่อชีตหรือหัวตาราง`);
        return;
      }
      setSheets(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อ่านไฟล์ไม่สำเร็จ — รองรับเฉพาะ .xlsx / .xls');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!sheets) return;
    const usable = sheets
      .map((sheet) => ({ type: sheet.type, rows: sheet.rows.map((row) => row.card).filter(Boolean) }))
      .filter((sheet) => sheet.rows.length);
    if (!usable.length) return;

    if (mode === 'replace') {
      const names = usable.map((sheet) => typeLabel(sheet.type)).join(', ');
      if (!confirm(`โหมด "ล้างของเดิม" จะลบการ์ดเดิมทั้งหมดของ ${names} ทิ้งก่อน แล้วใส่เฉพาะที่อยู่ในไฟล์นี้\n\nยืนยันหรือไม่?`)) {
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      const summaries: { type: ImportType; summary: ImportSummary }[] = [];
      for (const sheet of usable) {
        const summary = await importCards(sheet.type, sheet.rows as never[], mode);
        summaries.push({ type: sheet.type, summary });
      }
      setResult(summaries);
      setSheets(null);
      await onImported(summaries.map((item) => item.type));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'นำเข้าไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay}>
      <div style={shell}>
        <header style={topbar}>
          <div>
            <h3 style={{ margin: 0, color: color.primary, fontSize: 24 }}>นำเข้าการ์ดจาก Excel</h3>
            <p style={{ margin: '4px 0 0', ...muted }}>กรอกการ์ดหลายใบในไฟล์เดียว แล้วอัปเข้าคลังทีเดียว</p>
          </div>
          <button onClick={onClose} style={secondaryButton}>
            ปิด
          </button>
        </header>

        <div style={body}>
          <section style={stepBox}>
            <strong>1. ดาวน์โหลดไฟล์เทมเพลต</strong>
            <p style={{ margin: 0, ...muted }}>
              ในไฟล์มี 4 ชีตตามชนิดการ์ด และชีต "คู่มือ" ที่มีตารางรหัสพระองค์/วิชาให้คัดลอก — กรอกเฉพาะชีตที่ต้องการ
            </p>
            <button onClick={() => void handleTemplate()} style={secondaryButton}>
              ⬇️ ดาวน์โหลดเทมเพลต (.xlsx)
            </button>
          </section>

          <section style={stepBox}>
            <strong>2. เลือกไฟล์ที่กรอกแล้ว</strong>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={uploadButton}>
                {busy && !sheets ? 'กำลังอ่านไฟล์...' : 'เลือกไฟล์ Excel'}
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={busy}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = '';
                    if (file) void handleFile(file);
                  }}
                />
              </label>
              {fileName && <span style={muted}>📄 {fileName}</span>}
            </div>
          </section>

          {error && <Status tone="error" text={error} />}

          {result && (
            <section style={stepBox}>
              <Status tone="success" text="นำเข้าเรียบร้อย" />
              {result.map(({ type, summary }) => (
                <p key={type} style={{ margin: 0 }}>
                  <strong>{typeLabel(type)}</strong> — เพิ่มใหม่ {summary.inserted} ใบ · อัปเดตทับ {summary.updated} ใบ
                </p>
              ))}
            </section>
          )}

          {sheets && (
            <>
              <section style={stepBox}>
                <strong>3. ตรวจผลการอ่านไฟล์</strong>
                <div style={summaryGrid}>
                  {sheets.map((sheet) => {
                    const ok = sheet.rows.filter((row) => row.card).length;
                    const bad = sheet.rows.length - ok;
                    return (
                      <div key={sheet.type} style={summaryCard}>
                        <span style={{ fontWeight: 800 }}>{typeLabel(sheet.type)}</span>
                        <span style={{ color: color.success, fontWeight: 800 }}>พร้อมนำเข้า {ok} ใบ</span>
                        {bad > 0 && <span style={{ color: color.danger, fontWeight: 800 }}>ติดปัญหา {bad} แถว</span>}
                      </div>
                    );
                  })}
                </div>

                {badRows.length > 0 && (
                  <div style={issueBox}>
                    <strong style={{ color: color.danger }}>แถวที่ยังนำเข้าไม่ได้ ({badRows.length})</strong>
                    <p style={{ margin: 0, ...muted }}>แถวเหล่านี้จะถูกข้าม — แก้ในไฟล์ Excel แล้วเลือกไฟล์ใหม่อีกครั้งได้</p>
                    <div style={issueList}>
                      {badRows.map(({ sheet, row }) => (
                        <div key={`${sheet.type}-${row.rowNumber}`} style={issueRow}>
                          <span style={{ fontWeight: 800 }}>
                            ชีต "{sheet.sheetName}" แถว {row.rowNumber}
                          </span>
                          <ul style={{ margin: '4px 0 0', paddingInlineStart: 20 }}>
                            {row.errors.map((message, index) => (
                              <li key={index}>{message}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section style={stepBox}>
                <strong>4. เลือกวิธีนำเข้า</strong>
                <label style={modeRow}>
                  <input type="radio" checked={mode === 'upsert'} onChange={() => setMode('upsert')} style={radio} />
                  <span>
                    <strong>เพิ่ม / อัปเดตทับ</strong>
                    <span style={{ display: 'block', ...muted }}>
                      รหัสการ์ดที่มีอยู่แล้วจะถูกเขียนทับด้วยข้อมูลใหม่ · รหัสใหม่จะถูกเพิ่มเข้าไป · การ์ดเดิมที่ไม่อยู่ในไฟล์ยังอยู่ครบ
                    </span>
                  </span>
                </label>
                <label style={modeRow}>
                  <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} style={radio} />
                  <span>
                    <strong style={{ color: color.danger }}>ล้างของเดิมแล้วแทนที่ทั้งชนิด</strong>
                    <span style={{ display: 'block', ...muted }}>
                      ลบการ์ดเดิมทั้งหมดของชนิดที่อยู่ในไฟล์ แล้วใส่เฉพาะที่ไฟล์นี้มี — กู้คืนไม่ได้
                    </span>
                  </span>
                </label>
              </section>
            </>
          )}
        </div>

        <footer style={footer}>
          {sheets && (
            <span style={muted}>
              พร้อมนำเข้า <strong style={{ color: color.text }}>{readyRows.length}</strong> ใบ
              {badRows.length > 0 && ` · ข้าม ${badRows.length} แถว`}
            </span>
          )}
          <div style={{ display: 'flex', gap: 10, marginInlineStart: 'auto' }}>
            <button onClick={onClose} style={secondaryButton}>
              ยกเลิก
            </button>
            <button
              onClick={() => void handleImport()}
              disabled={busy || !readyRows.length}
              style={{
                ...(mode === 'replace' ? dangerButton : primaryButton),
                opacity: busy || !readyRows.length ? 0.5 : 1,
              }}
            >
              {busy ? 'กำลังนำเข้า...' : `นำเข้า ${readyRows.length} ใบ`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.55)',
  zIndex: 320,
  padding: 16,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const shell: React.CSSProperties = {
  width: 'min(880px, 96vw)',
  maxHeight: '92vh',
  background: color.surface,
  borderRadius: radius.lg,
  boxShadow: elevation.modal,
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  overflow: 'hidden',
};

const topbar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  padding: '16px 20px',
  borderBottom: '1px solid #E7D8BF',
};

const body: React.CSSProperties = { display: 'grid', gap: 14, padding: 20, overflow: 'auto', minHeight: 0, alignContent: 'start' };

const stepBox: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  justifyItems: 'start',
  padding: 16,
  background: '#FBF7EF',
  border: '1px solid #E7D8BF',
  borderRadius: radius.sm,
};

const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
  width: '100%',
};

const summaryCard: React.CSSProperties = {
  display: 'grid',
  gap: 3,
  padding: 12,
  background: '#fff',
  border: '1px solid #E7D8BF',
  borderRadius: radius.sm,
  fontSize: 15,
};

const issueBox: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  width: '100%',
  boxSizing: 'border-box',
  padding: 12,
  background: '#FFEBEE',
  borderRadius: radius.sm,
};

const issueList: React.CSSProperties = { display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' };

const issueRow: React.CSSProperties = {
  padding: 10,
  background: '#fff',
  borderRadius: radius.sm,
  fontSize: 15,
  lineHeight: 1.5,
};

const modeRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '24px 1fr', gap: 10, alignItems: 'start', cursor: 'pointer' };
const radio: React.CSSProperties = { width: 20, height: 20, marginTop: 3 };

const footer: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  padding: '14px 20px',
  borderTop: '1px solid #E7D8BF',
  background: color.surface,
};
