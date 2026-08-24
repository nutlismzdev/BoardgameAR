// สกัดข้อสอบก่อนเรียน/หลังเรียนจากไฟล์ Word ของครู → src/data/pretest.json
//
//   node scripts/parse-pretest.mjs [path/to/file.docx]
//
// ทำไมต้องมีสคริปต์ (ไม่พิมพ์ JSON เอง): ครูแก้ข้อสอบใน Word ต่อได้ แล้วรันซ้ำได้เลย
// อ่าน zip เองด้วย zlib ที่ Node มีให้ — ไม่ต้องเพิ่ม dependency ให้โปรเจกต์เกม
//
// ⚠️ กับดักของไฟล์จริง: กล่องข้อความ/รูปใน Word ทิ้ง "เลข anchor" ไว้ติดหัวบรรทัด
//    เช่น `-7620010033007. เพราะเหตุใด...` (ข้อ 7) และ `-84455196850ก. เพื่อเป็น...` (ข้อ 26)
//    ถ้าไม่ลอกออกก่อน ข้อ 7 จะกลายเป็นข้อ 7620010033007 และตัวเลือก ก. ของข้อ 26 จะหายไปเงียบ ๆ

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, 'docs/pretest.docx');
const OUT = resolve(ROOT, 'src/data/pretest.json');

const TOTAL = 30;
const LETTERS = ['ก', 'ข', 'ค', 'ง'];

// ข้อ 1–30 เรียงตามลำดับเวลาพอดี → map เลขข้อเป็นพระองค์ได้ตรง ๆ
// (ใช้ทำแถบไทม์ไลน์ในจอทำข้อสอบ + สรุป "พระองค์ไหนควรทบทวน" ให้ครู)
const KING_RANGES = [
  [1, 4, 'king_ramkhamhaeng'],
  [5, 8, 'king_naresuan'],
  [9, 13, 'king_taksin'],
  [14, 17, 'king_rama1'],
  [18, 21, 'king_narai'],
  [22, 25, 'king_rama4'],
  [26, 30, 'king_rama5'],
];
const kingOf = (no) => KING_RANGES.find(([a, b]) => no >= a && no <= b)?.[2] ?? 'king_overview';

// ── เฉลยในไฟล์ Word ที่ "ขัดกับคำอธิบายของตัวเอง" ──────────────────────────
// ตัวตรวจท้ายสคริปต์ (คำอธิบาย vs ตัวเลือกที่เฉลยชี้) เป็นคนจับได้ แล้วตรวจด้วยตาซ้ำอีกรอบ
// แก้ตรงนี้แทนการแก้ JSON เพราะรันสคริปต์ซ้ำเมื่อไหร่ของที่แก้ต้องไม่หาย และต้อง "เห็นได้"
// ⚠️ ถ้าครูแก้ไฟล์ Word ต้นฉบับแล้ว ให้ลบรายการนั้นทิ้ง — สคริปต์จะเตือนเองถ้าไฟล์ตรงกันแล้ว
const KEY_FIXES = {
  8: {
    letter: 'ข',
    why: 'คำอธิบายบอกว่าสังคโลกสิ้นสุดเพราะกวาดต้อนช่างปั้นไปพิษณุโลก = ตัวเลือก ข แต่ไฟล์เฉลย ค (ดินเหนียวหมด)',
  },
  19: {
    letter: 'ก',
    why: 'คำอธิบายบอกเหตุผลเรื่องเรือรบตะวันตกที่ปากอ่าว = ตัวเลือก ก แต่ไฟล์เฉลย ข (หนีน้ำท่วม)',
  },
};

// ── อ่านไฟล์เดียวออกจาก zip (docx = zip) ────────────────────────────────
function readZipEntry(buf, wanted) {
  // หา End of Central Directory แล้วไล่ central directory หา entry ที่ต้องการ
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ไม่ใช่ไฟล์ zip/docx ที่อ่านได้');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('central directory เสีย');
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const localOffset = buf.readUInt32LE(p + 42);
    if (name === wanted) {
      const method = buf.readUInt16LE(localOffset + 8);
      const compSize = buf.readUInt32LE(p + 20);
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + compSize);
      return method === 0 ? raw : inflateRawSync(raw);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`ไม่พบ ${wanted} ในไฟล์`);
}

// ── XML ของ Word → บรรทัดข้อความ ────────────────────────────────────────
function docxToLines(xml) {
  return xml
    .replaceAll('</w:p>', '\n')
    .replaceAll('<w:tab/>', '\t')
    .replaceAll('<w:br/>', '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.replace(/ /g, ' ').trimEnd())
    .filter((l) => l.trim() !== '');
}

/** ลอก "เลข anchor" ของกล่องข้อความ/รูปที่ Word ทิ้งไว้หน้าบรรทัด (4 หลักขึ้นไป) */
function stripAnchor(line) {
  return line.replace(/^-?\d{4,}(?=[ก-๙])/, '').trimStart();
}

/** หัวบรรทัด "N." โดยรู้ว่าข้อถัดไปควรเป็นเลขอะไร — ใช้แกะเคส anchor ติดเลขข้อ */
function questionNumber(line, expected) {
  const m = line.match(/^(-?\d+)\.\s*(.*)$/);
  if (!m) return null;
  const digits = m[1].replace('-', '');
  if (digits === String(expected)) return { no: expected, rest: m[2].trim() };
  // `-7620010033007.` → anchor + เลขข้อจริงต่อท้าย
  if (digits.length > 2 && digits.endsWith(String(expected))) return { no: expected, rest: m[2].trim() };
  return null;
}

// ── แกะโจทย์ + ตัวเลือก ──────────────────────────────────────────────────
function parseQuestions(lines) {
  const out = [];
  let cur = null;
  for (const raw of lines) {
    const line = stripAnchor(raw);
    const head = questionNumber(line, out.length + 1);
    if (head) {
      cur = { no: head.no, question: head.rest, choices: [] };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    // ตัวเลือกอาจอยู่บรรทัดละข้อ หรือสองข้อคั่นด้วย tab ("ก. …\tข. …")
    const parts = line.split('\t').map((s) => stripAnchor(s.trim())).filter(Boolean);
    let matched = false;
    for (const part of parts) {
      const cm = part.match(/^([ก-ง])\.\s*(.+)$/);
      if (cm && LETTERS.includes(cm[1])) {
        cur.choices.push({ letter: cm[1], text: cm[2].trim() });
        matched = true;
      }
    }
    // บรรทัดต่อของโจทย์ (โจทย์ยาวถูกตัดขึ้นบรรทัดใหม่) — ต่อได้เฉพาะก่อนเจอตัวเลือกแรก
    if (!matched && cur.choices.length === 0) cur.question += ' ' + line.trim();
  }
  return out;
}

// ── แกะเฉลย + คำอธิบาย (ตาราง "ข้อ / คำตอบ / คำอธิบาย") ──────────────────
function parseKey(lines) {
  const key = new Map();
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const line = stripAnchor(lines[i]).trim();
    const asNo = /^\d{1,2}$/.test(line) ? Number(line) : null;
    const next = i + 1 < lines.length ? stripAnchor(lines[i + 1]).trim() : '';
    if (asNo && asNo >= 1 && asNo <= TOTAL && LETTERS.includes(next)) {
      cur = { letter: next, explanation: '' };
      key.set(asNo, cur);
      i++; // ข้ามบรรทัดตัวอักษรเฉลย
      continue;
    }
    if (cur) cur.explanation = (cur.explanation ? cur.explanation + ' ' : '') + line;
  }
  return key;
}

// ── รัน ──────────────────────────────────────────────────────────────────
const buf = readFileSync(SRC);
const lines = docxToLines(readZipEntry(buf, 'word/document.xml').toString('utf8'));

const splitAt = lines.findIndex((l) => l.includes('เฉลยแบบทดสอบ'));
if (splitAt < 0) throw new Error('หาหัวข้อ "เฉลยแบบทดสอบ" ไม่เจอ — ไฟล์อาจไม่มีเฉลย');

const header = lines.slice(0, splitAt);
const questions = parseQuestions(lines.slice(0, splitAt));
const key = parseKey(lines.slice(splitAt));

const pick = (needle) => header.map(stripAnchor).find((l) => l.includes(needle))?.trim() ?? '';

// ── ตรวจงานตัวเอง: ไม่ครบ = หยุด ห้ามเขียนไฟล์ครึ่ง ๆ กลาง ๆ ──────────────
const problems = [];
if (questions.length !== TOTAL) problems.push(`ได้โจทย์ ${questions.length} ข้อ (ต้องได้ ${TOTAL})`);
for (const q of questions) {
  if (q.choices.length !== 4) problems.push(`ข้อ ${q.no}: ได้ตัวเลือก ${q.choices.length} ข้อ`);
  const letters = q.choices.map((c) => c.letter).join('');
  if (q.choices.length === 4 && letters !== 'กขคง') problems.push(`ข้อ ${q.no}: ตัวเลือกเรียงผิด (${letters})`);
}
for (let n = 1; n <= TOTAL; n++) {
  const k = key.get(n);
  if (!k) problems.push(`ข้อ ${n}: ไม่มีเฉลย`);
  else if (!k.explanation.trim()) problems.push(`ข้อ ${n}: ไม่มีคำอธิบาย`);
}
if (problems.length) {
  console.error('❌ แกะไฟล์ไม่ครบ:\n' + problems.map((p) => '   · ' + p).join('\n'));
  process.exit(1);
}

const applied = [];
const data = {
  meta: {
    source: 'docs/pretest.docx',
    school: pick('โรงเรียน'),
    title: pick('แบบทดสอบก่อนเรียน') || 'แบบทดสอบก่อนเรียน (Pre-test)',
    year: (pick('ปีการศึกษา').match(/ปีการศึกษา\s*(\S+)/) ?? [])[1] ?? '',
    grade: pick('ชั้นประถม'),
    subject: pick('สาระการเรียนรู้'),
    total: TOTAL,
    timeLimitMin: 60,
  },
  questions: questions.map((q) => {
    const k = key.get(q.no);
    const fix = KEY_FIXES[q.no];
    const useFix = fix && fix.letter !== k.letter;
    if (fix && !useFix) applied.push(`ข้อ ${q.no}: ไฟล์ต้นฉบับแก้เฉลยตรงแล้ว — ลบออกจาก KEY_FIXES ได้`);
    else if (useFix) applied.push(`ข้อ ${q.no}: ${k.letter} → ${fix.letter} · ${fix.why}`);
    return {
      no: q.no,
      kingId: kingOf(q.no),
      question: q.question.replace(/\s+/g, ' ').trim(),
      choices: q.choices.map((c) => c.text.replace(/\s+/g, ' ').trim()),
      answer: LETTERS.indexOf(useFix ? fix.letter : k.letter),
      explanation: k.explanation.replace(/\s+/g, ' ').trim(),
      ...(useFix ? { keyFixed: k.letter } : null),
    };
  }),
};

writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');

// ── รายงานให้ครูตรวจ (ไม่ใช่ error — แค่ชวนดู) ────────────────────────────
const dist = {};
for (const q of data.questions) {
  const l = LETTERS[q.answer];
  dist[l] = (dist[l] ?? 0) + 1;
}

// เฉลยที่คำอธิบายไม่มีคำร่วมกับตัวเลือกที่ชี้เลย = น่าสงสัยว่าเฉลยเลื่อนข้อ
const suspicious = data.questions.filter((q) => {
  const words = q.choices[q.answer]
    .replace(/[""''(),.]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  if (!words.length) return false;
  return !words.some((w) => q.explanation.includes(w));
});

console.log(`✅ เขียน ${OUT}`);
console.log(`   ${data.questions.length} ข้อ · การกระจายเฉลย ${LETTERS.map((l) => `${l}=${dist[l] ?? 0}`).join(' ')}`);

if (applied.length) {
  console.log('\n   ✍️  แก้เฉลยที่ขัดกับคำอธิบายในไฟล์ต้นฉบับ (ดู KEY_FIXES ในสคริปต์):');
  applied.forEach((a) => console.log(`      · ${a}`));
}

const top = LETTERS.reduce((a, b) => ((dist[a] ?? 0) >= (dist[b] ?? 0) ? a : b));
const unused = LETTERS.filter((l) => !dist[l]);
if ((dist[top] ?? 0) / TOTAL > 0.4 || unused.length) {
  console.log('\n   ⚠️  ข้อสังเกตเรื่องการวางเฉลย (ให้ครูดู ไม่ใช่ข้อผิดพลาด):');
  if ((dist[top] ?? 0) / TOTAL > 0.4) {
    console.log(`      · เฉลยกระจุกที่ข้อ ${top} ${dist[top]}/${TOTAL} ข้อ — เด็กจับทางได้จะกาเดารวด`);
  }
  if (unused.length) console.log(`      · ไม่มีข้อไหนเฉลยเป็น ${unused.join('/')} เลย`);
  console.log('      · แบบทดสอบหลังเรียนในแอปสลับตัวเลือกให้แล้ว แต่ฉบับกระดาษ/ก่อนเรียนยังเป็นตามไฟล์');
}

if (suspicious.length) {
  console.log(
    `\n   ℹ️  ${suspicious.length} ข้อที่คำอธิบายไม่มีคำตรงกับตัวเลือกที่เฉลยชี้ (ส่วนใหญ่แค่เขียนคนละสำนวน แต่ควรกวาดตาดู): ${suspicious
      .map((q) => q.no)
      .join(', ')}`
  );
}
