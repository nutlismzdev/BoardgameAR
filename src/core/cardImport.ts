// นำเข้าการ์ดจากไฟล์ Excel — สร้างไฟล์เทมเพลต + อ่าน/ตรวจไฟล์ที่ครูกรอกมา
// อ่านฝั่งเบราว์เซอร์ทั้งหมด แล้วส่งเป็น JSON ให้ server/import.php (ดูหมายเหตุ dynamic import ท้ายไฟล์)

import type { ContentType } from './api';
import { KINGS, OVERVIEW_KING_ID, OVERVIEW_KING_LABEL, SUBJECTS } from './content';
import type { Difficulty, KnowledgeCard, QuizCard, QuizChoice, SubjectArea, SubjectQuizCard } from './types';

export type ImportType = ContentType;
export type ImportCard = QuizCard | KnowledgeCard | SubjectQuizCard;

// แถวที่อ่านได้ 1 แถว = การ์ด 1 ใบ + ที่มา (เลขแถวใน Excel) + ข้อผิดพลาดที่เจอ
export interface ParsedRow {
  rowNumber: number; // เลขแถวจริงใน Excel (1-based รวมหัวตาราง) — ใช้บอกครูว่าไปแก้ตรงไหน
  card: ImportCard | null;
  errors: string[];
}

export interface ParsedSheet {
  type: ImportType;
  sheetName: string;
  rows: ParsedRow[];
}

export const TEMPLATE_FILENAME = 'template-7maharaj-cards.xlsx';

// ชื่อชีตในเทมเพลต ↔ ชนิดเนื้อหาใน API (Excel จำกัดชื่อชีตไม่เกิน 31 ตัว ห้าม []:*?/\)
const SHEET_NAME: Record<ImportType, string> = {
  quiz: 'คำถามฟ้า',
  knowledge: 'ความรู้',
  subject: 'กลุ่มสาระ',
  gold: 'ARทอง',
};
const GUIDE_SHEET = 'คู่มือ';

interface ColumnDef {
  key: string;
  header: string; // หัวตารางที่ครูเห็น
  width: number;
  aliases?: string[]; // ชื่อหัวตารางอื่นที่ยอมรับ (เผื่อครูแก้/ใช้ไฟล์เก่า)
}

const CHOICE_LABELS = ['1', '2', '3', '4']; // ป้ายที่โชว์ในเทมเพลต/หัวตาราง/ข้อความ
const CHOICE_THAI = ['ก', 'ข', 'ค', 'ง']; // ยังรับ ก/ข/ค/ง จากไฟล์เก่าได้

const COL_ID: ColumnDef = { key: 'id', header: 'รหัสการ์ด (เว้นว่างได้)', width: 22, aliases: ['id', 'รหัสการ์ด', 'รหัส'] };
const COL_KING: ColumnDef = { key: 'kingId', header: 'พระองค์', width: 30, aliases: ['kingid', 'king', 'มหาราช'] };
const COL_QUESTION: ColumnDef = { key: 'question', header: 'คำถาม', width: 52, aliases: ['question'] };
const COL_CHOICES: ColumnDef[] = CHOICE_LABELS.map((label, i) => ({
  key: `choice${i}`,
  header: `ตัวเลือก ${label}`,
  width: 26,
  // รองรับหัวตารางแบบเก่า (ตัวเลือก ก / choiceก) และ a-d ด้วย
  aliases: [`choice${label}`, `choice${CHOICE_THAI[i]}`, `ตัวเลือก${CHOICE_THAI[i]}`, String.fromCharCode(97 + i)],
}));
const COL_CORRECT: ColumnDef = { key: 'correct', header: 'เฉลย (1/2/3/4)', width: 14, aliases: ['correct', 'เฉลย', 'คำตอบ'] };
const COL_DIFFICULTY: ColumnDef = { key: 'difficulty', header: 'ระดับ (ง่าย/กลาง/ยาก)', width: 18, aliases: ['difficulty', 'ระดับ', 'ความยาก'] };
const COL_REWARD: ColumnDef = { key: 'reward', header: 'เหรียญ', width: 10, aliases: ['reward', 'เหรียญรางวัล'] };
const COL_TIME: ColumnDef = { key: 'timeLimitSec', header: 'เวลา (วินาที)', width: 13, aliases: ['timelimitsec', 'เวลา'] };
const COL_EXPLANATION: ColumnDef = { key: 'explanation', header: 'คำอธิบายเฉลย', width: 52, aliases: ['explanation', 'เฉลยอธิบาย'] };
// การ์ด AR ทอง: คำอธิบายเฉลยไม่บังคับ (เฉลยจริงอยู่ในคลิป/การลากคำตอบ)
const COL_EXPLANATION_OPTIONAL: ColumnDef = { key: 'explanation', header: 'คำอธิบายเฉลย (ไม่บังคับ)', width: 52, aliases: ['explanation', 'เฉลยอธิบาย', 'คำอธิบายเฉลย'] };
const COL_IMAGE: ColumnDef = { key: 'imageUrl', header: 'ลิงก์รูป (ไม่บังคับ)', width: 30, aliases: ['imageurl', 'รูป', 'ลิงก์รูป'] };

const COLUMNS: Record<ImportType, ColumnDef[]> = {
  quiz: [COL_ID, COL_KING, COL_DIFFICULTY, COL_REWARD, COL_TIME, COL_QUESTION, ...COL_CHOICES, COL_CORRECT, COL_EXPLANATION, COL_IMAGE],
  subject: [
    COL_ID,
    COL_KING,
    { key: 'subject', header: 'วิชา', width: 22, aliases: ['subject', 'กลุ่มสาระ', 'สาระ'] },
    COL_DIFFICULTY,
    COL_REWARD,
    COL_TIME,
    COL_QUESTION,
    ...COL_CHOICES,
    COL_CORRECT,
    COL_EXPLANATION,
    COL_IMAGE,
  ],
  gold: [
    COL_ID,
    COL_KING,
    COL_DIFFICULTY,
    COL_REWARD,
    COL_TIME,
    COL_QUESTION,
    ...COL_CHOICES,
    COL_CORRECT,
    COL_EXPLANATION_OPTIONAL,
    COL_IMAGE,
    { key: 'videoUrl', header: 'ลิงก์วิดีโอ AR (ไม่บังคับ)', width: 30, aliases: ['videourl', 'วิดีโอ', 'ลิงก์วิดีโอ'] },
  ],
  // การ์ดความรู้ในเกมใช้แค่ชื่อ+เนื้อหา (ไม่มีคำถามทบทวนแล้ว) เทมเพลตจึงไม่ถามคำถาม
  knowledge: [
    COL_ID,
    COL_KING,
    { key: 'title', header: 'ชื่อการ์ด', width: 30, aliases: ['title', 'ชื่อ'] },
    { key: 'body', header: 'เนื้อหาความรู้', width: 64, aliases: ['body', 'เนื้อหา', 'เกร็ดความรู้'] },
  ],
};

export const IMPORT_TYPES: { type: ImportType; label: string; sheet: string }[] = (
  ['quiz', 'knowledge', 'subject', 'gold'] as ImportType[]
).map((type) => ({ type, label: typeLabel(type), sheet: SHEET_NAME[type] }));

export function typeLabel(type: ImportType): string {
  return type === 'quiz' ? 'คำถามฟ้า' : type === 'knowledge' ? 'การ์ดความรู้' : type === 'subject' ? 'กลุ่มสาระฯ' : 'คำถาม AR ทอง';
}

// ── ตัวช่วยแปลงค่าที่ครูพิมพ์ → ค่าที่ฐานข้อมูลรับ ──────────────────────────

function normalize(value: unknown): string {
  return String(value ?? '')
    .replace(/​/g, '')
    .trim();
}

// เทียบหัวตาราง/ค่าแบบหลวม ๆ: ตัดช่องว่าง วงเล็บ และตัวพิมพ์เล็กใหญ่ทิ้ง
function loose(value: unknown): string {
  return normalize(value)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[\s_./-]/g, '');
}

// คลัง "ภาพรวม 7 มหาราช" — คำถามไม่ผูกพระองค์ ยอมรับได้ทั้งชื่อไทย/รหัส/คำเรียกใกล้เคียง
const OVERVIEW_KEYS = new Set(
  [OVERVIEW_KING_ID, OVERVIEW_KING_LABEL, 'ภาพรวม', 'ภาพรวม7มหาราช', '7มหาราช', 'ทุกพระองค์', 'ทั้ง7พระองค์', 'overview', 'all'].map(loose)
);

function resolveKingId(raw: string): string | null {
  const key = loose(raw);
  if (!key) return null;
  if (OVERVIEW_KEYS.has(key)) return OVERVIEW_KING_ID;
  const king = KINGS.find((k) => loose(k.id) === key || loose(k.name) === key) ?? KINGS.find((k) => loose(k.name).includes(key));
  return king?.id ?? null;
}

// คำพ้อง/ชื่อย่อของวิชา → รหัส (เช่น ภาษาอังกฤษ = ภาษาต่างประเทศ, สังคม = สังคมศึกษา)
const SUBJECT_ALIASES: Record<string, SubjectArea> = {
  ภาษาอังกฤษ: 'foreign_language',
  อังกฤษ: 'foreign_language',
  english: 'foreign_language',
  สังคม: 'social',
  สุขศึกษา: 'health_pe',
  พลศึกษา: 'health_pe',
  การงาน: 'occupation',
  การงานอาชีพและเทคโนโลยี: 'occupation',
};

function resolveSubject(raw: string): SubjectArea | null {
  // ตัดคำนำหน้าอย่าง "บูรณาการ:" / "บูรณาการเพิ่มเติม:" ทิ้ง เอาเฉพาะชื่อวิชาหลัง ":"
  const afterColon = String(raw ?? '').split(':').pop() ?? '';
  const key = loose(afterColon);
  if (!key) return null;
  const found = SUBJECTS.find((s) => loose(s.id) === key || loose(s.label) === key) ?? SUBJECTS.find((s) => loose(s.label).includes(key));
  if (found) return found.id;
  const aliasKey = Object.keys(SUBJECT_ALIASES).find((name) => loose(name) === key);
  return aliasKey ? SUBJECT_ALIASES[aliasKey] : null;
}

function resolveDifficulty(raw: string): Difficulty | null {
  const key = loose(raw);
  if (!key) return 'easy'; // เว้นว่าง = ง่าย
  if (['easy', 'ง่าย', '1'].includes(key)) return 'easy';
  if (['medium', 'กลาง', 'ปานกลาง', '2'].includes(key)) return 'medium';
  if (['hard', 'ยาก', '3'].includes(key)) return 'hard';
  return null;
}

// เฉลยรับได้ทั้ง 1/2/3/4, ก/ข/ค/ง และ a/b/c/d → คืน index ของตัวเลือก
function resolveCorrectIndex(raw: string): number | null {
  const key = loose(raw);
  if (!key) return null;
  const thai = CHOICE_THAI.indexOf(key);
  if (thai >= 0) return thai;
  const latin = 'abcd'.indexOf(key);
  if (latin >= 0) return latin;
  const num = Number(key);
  if (Number.isInteger(num) && num >= 1 && num <= 4) return num - 1;
  return null;
}

function makeId(type: ImportType): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${type}_${Date.now().toString(36)}${rand}`;
}

// ── สร้างไฟล์เทมเพลต ────────────────────────────────────────────────────────

function guideRows(): unknown[][] {
  const rows: unknown[][] = [
    ['คู่มือกรอกไฟล์นำเข้าการ์ด — บอร์ดเกม 7 มหาราช'],
    [],
    ['วิธีใช้'],
    ['1', 'กรอกการ์ดลงชีตตามชนิดที่ต้องการ — 1 แถว = การ์ด 1 ใบ (ห้ามลบ/สลับแถวหัวตาราง)'],
    ['2', 'ช่อง "รหัสการ์ด" เว้นว่างได้ ระบบจะสร้างให้เอง · ถ้ากรอกเองต้องเป็น a-z A-Z 0-9 _ - ยาว 3-80 ตัว (ห้ามภาษาไทย/เว้นวรรค)'],
    ['3', 'ช่อง "พระองค์" และ "วิชา" ให้คัดลอกจากตารางด้านล่าง (พิมพ์ชื่อไทยหรือรหัสก็ได้)'],
    ['4', 'ต้องมีตัวเลือกอย่างน้อย 2 ข้อ และกรอกช่อง "เฉลย" เสมอ'],
    ['5', 'ชีตไหนไม่ใช้ ปล่อยว่างไว้ได้ ระบบจะข้ามให้'],
    ['6', 'รูป/วิดีโอ: ใส่ได้เฉพาะลิงก์เต็ม (ขึ้นต้น https://) — ถ้าจะอัปโหลดไฟล์เอง ให้เว้นว่างแล้วไปแนบทีหลังในหน้าแก้ไขการ์ด'],
    [],
    ['ตารางรหัสพระองค์ (คัดลอกช่อง "ชื่อ" หรือ "รหัส" ก็ได้)'],
    ['ชื่อ', 'รหัส'],
    ...KINGS.map((king) => [king.name, king.id]),
    [OVERVIEW_KING_LABEL, OVERVIEW_KING_ID, 'คำถามภาพรวมทั้ง 7 พระองค์ — จะถูกถามเฉพาะช่องของพระองค์ที่ยังไม่มีคำถามของตัวเอง'],
    [],
    ['ตารางวิชา (ใช้เฉพาะชีต "กลุ่มสาระ")'],
    ['ชื่อวิชา', 'รหัส'],
    ...SUBJECTS.map((subject) => [subject.label, subject.id]),
    [],
    ['ค่าที่ยอมรับในช่องอื่น'],
    ['ระดับ', 'ง่าย / กลาง / ยาก'],
    ['เฉลย', '1 / 2 / 3 / 4 (ใส่เลขข้อที่ถูก · ก / ข / ค / ง ก็ยังใช้ได้)'],
    ['เหรียญ', 'ตัวเลข 0 ขึ้นไป (เว้นว่าง = 50)'],
    ['เวลา (วินาที)', 'ตัวเลข 5 ขึ้นไป (เว้นว่าง = 20)'],
    [],
    ['ตัวอย่างการกรอก (ชีต "คำถามฟ้า")'],
    COLUMNS.quiz.map((col) => col.header),
    [
      '',
      KINGS[0]?.name ?? '',
      'ง่าย',
      50,
      20,
      'พ่อขุนรามคำแหงมหาราชทรงประดิษฐ์สิ่งใดที่คนไทยยังใช้จนถึงปัจจุบัน?',
      'อักษรไทย',
      'เลขโรมัน',
      'ปฏิทินจันทรคติ',
      'ธงชาติ',
      '1',
      "ทรงประดิษฐ์ 'ลายสือไท' เมื่อ พ.ศ. 1826 เป็นต้นแบบของอักษรไทยปัจจุบัน",
      '',
    ],
  ];
  return rows;
}

export async function downloadTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const guide = XLSX.utils.aoa_to_sheet(guideRows());
  guide['!cols'] = [{ wch: 30 }, { wch: 84 }];
  XLSX.utils.book_append_sheet(wb, guide, GUIDE_SHEET);

  for (const { type } of IMPORT_TYPES) {
    const columns = COLUMNS[type];
    const sheet = XLSX.utils.aoa_to_sheet([columns.map((col) => col.header)]);
    sheet['!cols'] = columns.map((col) => ({ wch: col.width }));
    XLSX.utils.book_append_sheet(wb, sheet, SHEET_NAME[type]);
  }

  XLSX.writeFile(wb, TEMPLATE_FILENAME);
}

// ── อ่านไฟล์ที่ครูกรอก ──────────────────────────────────────────────────────

// จับคู่หัวตารางที่อ่านได้ → key ของฟิลด์ (ยอมรับทั้งหัวไทยเต็ม, alias และชื่อฟิลด์อังกฤษ)
function mapHeaders(type: ImportType, headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, index) => {
    const key = loose(cell);
    if (!key) return;
    const col = COLUMNS[type].find(
      (def) => loose(def.header) === key || loose(def.key) === key || (def.aliases ?? []).some((alias) => loose(alias) === key)
    );
    if (col && !(col.key in map)) map[col.key] = index;
  });
  return map;
}

function cell(row: unknown[], map: Record<string, number>, key: string): string {
  const index = map[key];
  return index === undefined ? '' : normalize(row[index]);
}

function parseRow(type: ImportType, row: unknown[], map: Record<string, number>, rowNumber: number): ParsedRow {
  const errors: string[] = [];
  const push = (message: string) => errors.push(message);

  const rawId = cell(row, map, 'id');
  if (rawId && !/^[a-zA-Z0-9_-]{3,80}$/.test(rawId)) {
    push('รหัสการ์ดต้องเป็น a-z A-Z 0-9 _ - ยาว 3-80 ตัว (ห้ามภาษาไทยหรือเว้นวรรค)');
  }
  const id = rawId || makeId(type);

  const kingId = resolveKingId(cell(row, map, 'kingId'));
  if (!kingId) push(`ไม่รู้จักพระองค์ "${cell(row, map, 'kingId') || '(ว่าง)'}" — ดูรายชื่อในชีต "${GUIDE_SHEET}"`);

  if (type === 'knowledge') {
    const title = cell(row, map, 'title');
    const body = cell(row, map, 'body');
    if (!title) push('ต้องกรอกชื่อการ์ด');
    if (!body) push('ต้องกรอกเนื้อหาความรู้');
    const card: KnowledgeCard = { id, kingId: kingId ?? '', title, body, question: '', choices: [] };
    return { rowNumber, card: errors.length ? null : card, errors };
  }

  const question = cell(row, map, 'question');
  if (!question) push('ต้องกรอกคำถาม');

  const explanation = cell(row, map, 'explanation');
  if (!explanation && type !== 'gold') push('ต้องกรอกคำอธิบายเฉลย'); // การ์ด AR ทอง: ไม่บังคับ

  const difficulty = resolveDifficulty(cell(row, map, 'difficulty'));
  if (!difficulty) push(`ระดับต้องเป็น ง่าย / กลาง / ยาก (พบ "${cell(row, map, 'difficulty')}")`);

  const rawReward = cell(row, map, 'reward');
  const reward = rawReward === '' ? 50 : Number(rawReward);
  if (!Number.isFinite(reward) || reward < 0) push(`เหรียญต้องเป็นตัวเลข 0 ขึ้นไป (พบ "${rawReward}")`);

  const rawTime = cell(row, map, 'timeLimitSec');
  const timeLimitSec = rawTime === '' ? 20 : Number(rawTime);
  if (!Number.isFinite(timeLimitSec) || timeLimitSec < 5) push(`เวลาต้องเป็นตัวเลข 5 วินาทีขึ้นไป (พบ "${rawTime}")`);

  const texts = COL_CHOICES.map((col) => cell(row, map, col.key));
  const filled = texts.filter(Boolean);
  if (filled.length < 2) push('ต้องมีตัวเลือกอย่างน้อย 2 ข้อ');

  const correctIndex = resolveCorrectIndex(cell(row, map, 'correct'));
  if (correctIndex === null) push(`ช่องเฉลยต้องเป็น 1 / 2 / 3 / 4 (พบ "${cell(row, map, 'correct')}")`);
  else if (!texts[correctIndex]) push(`เฉลยชี้ไปที่ตัวเลือก "${CHOICE_LABELS[correctIndex]}" ซึ่งยังไม่ได้กรอก`);

  // ตัดตัวเลือกที่ว่างทิ้ง แต่ต้องคำนวณตำแหน่งเฉลยใหม่ก่อน ไม่งั้นเฉลยเลื่อนผิดข้อ
  const choices: QuizChoice[] = texts
    .map((text, index) => ({ text, correct: index === correctIndex }))
    .filter((choice) => choice.text !== '');

  const imageUrl = cell(row, map, 'imageUrl');
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) push('ลิงก์รูปต้องขึ้นต้นด้วย http:// หรือ https:// (ถ้าจะอัปโหลดไฟล์เอง ให้เว้นว่างไว้)');

  const base: QuizCard = {
    id,
    kingId: kingId ?? '',
    difficulty: difficulty ?? 'easy',
    reward,
    timeLimitSec,
    question,
    choices,
    explanation,
    imageUrl,
  };

  if (type === 'subject') {
    const subject = resolveSubject(cell(row, map, 'subject'));
    if (!subject) push(`ไม่รู้จักวิชา "${cell(row, map, 'subject') || '(ว่าง)'}" — ดูรายชื่อในชีต "${GUIDE_SHEET}"`);
    const card: SubjectQuizCard = { ...base, subject: subject ?? 'social' };
    return { rowNumber, card: errors.length ? null : card, errors };
  }

  if (type === 'gold') {
    const videoUrl = cell(row, map, 'videoUrl');
    if (videoUrl && !/^https?:\/\//i.test(videoUrl)) push('ลิงก์วิดีโอต้องขึ้นต้นด้วย http:// หรือ https:// (ถ้าจะอัปโหลดไฟล์เอง ให้เว้นว่างไว้)');
    return { rowNumber, card: errors.length ? null : { ...base, videoUrl }, errors };
  }

  return { rowNumber, card: errors.length ? null : base, errors };
}

export async function parseWorkbook(file: File): Promise<ParsedSheet[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });

  const sheets: ParsedSheet[] = [];
  for (const { type } of IMPORT_TYPES) {
    const name = wb.SheetNames.find((sheetName) => loose(sheetName) === loose(SHEET_NAME[type]));
    if (!name) continue;
    // raw:false = ให้ SheetJS แปลงตัวเลข/วันที่เป็นข้อความตามที่เห็นในชีต (กันเลขไทย/รูปแบบเพี้ยน)
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: '' });
    if (!grid.length) continue;

    const map = mapHeaders(type, grid[0] ?? []);
    if (map.kingId === undefined) continue; // ไม่มีหัวตารางที่รู้จัก = ไม่ใช่ชีตข้อมูล

    const rows: ParsedRow[] = [];
    const seen = new Map<string, number>();
    grid.slice(1).forEach((row, index) => {
      const rowNumber = index + 2; // +1 ข้ามหัวตาราง, +1 เพราะ Excel เริ่มนับที่ 1
      if (row.every((value) => normalize(value) === '')) return; // ข้ามแถวว่าง

      const parsed = parseRow(type, row, map, rowNumber);
      // รหัสซ้ำกันเองในไฟล์ = แถวหลังจะทับแถวหน้าเงียบ ๆ ต้องดักไว้ก่อนส่งขึ้น server
      const rawId = cell(row, map, 'id');
      if (rawId) {
        const first = seen.get(rawId);
        if (first !== undefined) {
          parsed.errors.push(`รหัสการ์ด "${rawId}" ซ้ำกับแถว ${first} ในไฟล์เดียวกัน`);
          parsed.card = null;
        } else {
          seen.set(rawId, rowNumber);
        }
      }
      rows.push(parsed);
    });

    if (rows.length) sheets.push({ type, sheetName: name, rows });
  }

  return sheets;
}
