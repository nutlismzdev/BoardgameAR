// ตรวจ logic ของแบบทดสอบแบบเร็ว ๆ:  node scripts/check-pretest.mjs
//
// โปรเจกต์นี้ไม่มี test runner แต่ "การสลับข้อ/สลับตัวเลือกแล้วจับคำตอบกลับ" เป็นจุดที่
// ถ้าพังจะพังแบบเงียบ ๆ (คะแนนผิดโดยไม่มี error) และกว่าจะรู้ก็ตอนครูเอาไปใช้จริงแล้ว
// สคริปต์นี้ bundle src/core/pretest.ts ด้วย esbuild (ติดมากับ vite) แล้วรันของจริง

import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = process.cwd();
const out = path.join(os.tmpdir(), 'bg7-pretest.bundle.mjs');
await build({
  entryPoints: [path.join(root, 'src/core/pretest.ts')],
  bundle: true, format: 'esm', outfile: out, logLevel: 'error',
  alias: { '@': path.join(root, 'src') },
});
const m = await import(pathToFileURL(out).href);

const LETTERS = ['ก', 'ข', 'ค', 'ง'];
const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };

// 1. ก่อนเรียน = ลำดับเดิมตรงกับกระดาษ
const pre = m.buildAttempt('pre', 'ป.5/1|12', true);
ok(pre.length === 30, 'pre length');
ok(pre.every((it, i) => it.no === i + 1), 'ก่อนเรียนต้องเรียงข้อ 1→30 ตามกระดาษ');
ok(pre.every((it) => it.choiceMap.every((c, i) => c === i)), 'ก่อนเรียนต้องไม่สลับตัวเลือก');

// 2. หลังเรียน = สลับ และ deterministic (resume แล้วต้องได้ชุดเดิมเป๊ะ)
const a = m.buildAttempt('post', 'ป.5/1|12', true);
const b = m.buildAttempt('post', 'ป.5/1|12', true);
ok(JSON.stringify(a) === JSON.stringify(b), 'ชุดหลังเรียนต้อง deterministic (กลับมาทำต่อได้)');
ok(a.some((it, i) => it.no !== i + 1), 'หลังเรียนต้องสลับลำดับข้อ');
ok(a.some((it) => it.choiceMap.some((c, i) => c !== i)), 'หลังเรียนต้องสลับตัวเลือก');
ok(new Set(a.map((i) => i.no)).size === 30, 'สลับแล้วต้องครบ 30 ข้อไม่ซ้ำ');

// แต่ละคนต้องได้ชุดต่างกัน (กันชะโงกดูของเพื่อน)
const c = m.buildAttempt('post', 'ป.5/1|13', true);
ok(JSON.stringify(a) !== JSON.stringify(c), 'นักเรียนคนละคนต้องได้ลำดับต่างกัน');

// 3. ตัวเลือกที่สลับต้องยังชี้ข้อความเดิมเสมอ
for (const it of a) {
  const src = m.TEST_QUESTIONS[it.no - 1];
  ok(it.question === src.question, `ข้อ ${it.no}: โจทย์ต้องตรงกัน`);
  ok(it.choices.length === src.choices.length, `ข้อ ${it.no}: จำนวนตัวเลือก`);
  it.choices.forEach((text, i) => ok(text === src.choices[it.choiceMap[i]], `ข้อ ${it.no}: ตัวเลือกที่ ${i} ต้องตรงกับ choiceMap`));
  ok(new Set(it.choiceMap).size === src.choices.length, `ข้อ ${it.no}: choiceMap ต้องไม่ซ้ำ`);
}

// 4. ตอบให้ถูกทุกข้อผ่านทางที่ UI ใช้จริง (แตะตัวเลือกที่โชว์ → เก็บ index ต้นฉบับ)
const answers = m.emptyAnswers();
for (const it of a) {
  const src = m.TEST_QUESTIONS[it.no - 1];
  const shown = it.choiceMap.indexOf(src.answer);   // ตำแหน่งที่เด็กเห็น "คำตอบถูก"
  answers[it.no - 1] = it.choiceMap[shown];          // สิ่งที่ store.answer() บันทึก
}
const perfect = m.scoreAttempt(answers);
ok(perfect.score === 30, `ตอบถูกหมดต้องได้ 30 (ได้ ${perfect.score})`);
ok(perfect.byKing.reduce((n, k) => n + k.total, 0) === 30, 'byKing รวมต้องได้ 30');
ok(perfect.byKing.length === 7, `byKing ต้องมี 7 พระองค์ (ได้ ${perfect.byKing.length})`);

// 5. ไม่ตอบเลย = 0 และไม่พัง
const zero = m.scoreAttempt(m.emptyAnswers());
ok(zero.score === 0 && zero.answered === 0, 'ไม่ตอบเลยต้องได้ 0');

// 6. เทียบก่อน/หลัง
const half = m.emptyAnswers();
m.TEST_QUESTIONS.forEach((q, i) => { if (i < 10) half[q.no - 1] = q.answer; });
const gain = m.compareAttempts(m.scoreAttempt(half), perfect);
ok(gain.pre === 10 && gain.post === 30 && gain.diff === 20, 'compareAttempts');
ok(Math.abs(gain.normalized - 1) < 1e-9, 'ทำได้เต็มจากที่เหลือ = normalized 1');

// 7. 🔒 นโยบายเปิดเฉลย — ค่าเริ่มต้นต้องไม่เปิดเฉลยในรอบก่อนเรียน
ok(m.shouldRevealAnswers('pre', 'post') === false, 'ค่าเริ่มต้นต้องไม่เฉลยในรอบก่อนเรียน');
ok(m.shouldRevealAnswers('post', 'post') === true, 'รอบหลังเรียนต้องเฉลย');
ok(m.shouldRevealAnswers('pre', 'never') === false && m.shouldRevealAnswers('post', 'never') === false, 'ปิดเฉลยต้องปิดทั้งสองรอบ');
ok(m.shouldRevealAnswers('pre', 'always') === true, 'ครูสั่งเฉลยทุกครั้งต้องเปิดได้');

// 8. เฉลยของ 2 ข้อที่เคยขัดกับคำอธิบายในไฟล์ Word — ยืนยันโดยเจ้าของโปรเจกต์แล้ว
// ตรวจที่ "คำตอบ" ไม่ใช่ที่กลไก KEY_FIXES เพราะพอไฟล์ Word ถูกแก้ที่ต้นทาง
// ธง keyFixed จะหายไปเอง แต่คำตอบต้องเป็นค่านี้เสมอไม่ว่าจะมาจากทางไหน
const CONFIRMED = { 8: 'ข', 19: 'ก' };
for (const [no, letter] of Object.entries(CONFIRMED)) {
  const q = m.TEST_QUESTIONS[Number(no) - 1];
  ok(LETTERS[q.answer] === letter, `ข้อ ${no} เฉลยต้องเป็น ${letter} (ได้ ${LETTERS[q.answer]})`);
}
const fixed = m.TEST_QUESTIONS.filter((q) => q.keyFixed);

console.log(fail.length ? '❌ FAIL\n' + fail.map((f) => '  · ' + f).join('\n') : '✅ ผ่านทั้งหมด · เฉลยข้อ 8 = ข · ข้อ 19 = ก');
process.exit(fail.length ? 1 : 0);
