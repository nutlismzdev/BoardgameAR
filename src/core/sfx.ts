// ระบบเสียง + haptic — 2 ชั้น:
//   1) เสียงสังเคราะห์ Web Audio (เพลงพื้นหลัง + sfx สั้น ๆ) — ไม่ต้องมีไฟล์
//   2) ไฟล์เสียงจริงใน public/sound/ สำหรับจังหวะสำคัญ (ลุ้น/สำเร็จ) — มี fallback เป็นข้อ 1
// เปิด/ปิดผ่าน settings.soundEnabled

let ctx: AudioContext | null = null;
let enabled = true;
let bgMaster: GainNode | null = null;
let bgTimers: ReturnType<typeof setInterval>[] = [];
let bgPlaying = false;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (!on) {
    // ⚠️ ลำดับสำคัญ: หยุด sample ให้จบ (ซึ่งจะคืนเกน bus เป็น 0.095) ก่อน แล้วค่อยมิวต์ bus
    // เป็นขั้นสุดท้าย · เดิมเรียก stopBackgroundMusic() ขึ้นก่อน แล้ว stopSuspense() ไป
    // duckBackground(false) ดันเกนกลับเป็น 0.095 = โน้ตที่ schedule ค้างไว้ล่วงหน้าดัง
    // เต็มเสียงต่ออีกหลายวินาที "หลัง" เด็กกดปิดเสียงไปแล้ว
    stopSuspense();
    stopSuccess();
    stopBackgroundMusic();
  }
}

// ออกจากเกม / จบเกม: ต้องหยุด "ทุกชั้น" ไม่ใช่แค่เพลงพื้นหลัง
// เดิม backToHome เรียกแค่ stopBackgroundMusic() → เพลงฉลองที่ยาว 75 วิ ตามกลับไปดัง
// ต่อที่หน้า Home และคาบเกี่ยวกับเสียง sfx.win ของหน้าจบเกม
export function stopAllAudio() {
  stopSuspense();
  stopSuccess();
  stopBackgroundMusic();
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function stopBackgroundTimers() {
  bgTimers.forEach(clearInterval);
  bgTimers = [];
}

function backgroundGain(c: AudioContext) {
  if (!bgMaster) {
    bgMaster = c.createGain();
    bgMaster.gain.value = 0.095;
    bgMaster.connect(c.destination);
  }
  return bgMaster;
}

// โน้ตเพลงพื้นหลัง — รับ "เวลาเริ่มจริงบนนาฬิกา AudioContext" (absolute) ไม่ใช่ delay
// เพราะตัวจัดคิวด้านล่างวางบาร์ล่วงหน้าตาม nextBarAt ไม่ได้อิงว่า timer มาถึงตอนไหน
function musicToneAt(
  c: AudioContext,
  freq: number,
  durMs: number,
  type: OscillatorType,
  gain: number,
  at: number,
  destination: AudioNode
) {
  const t0 = Math.max(at, c.currentTime);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g).connect(destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000);
}

// ── ตัวจัดคิวเพลงพื้นหลังแบบ look-ahead ──
// เดิมใช้ `setInterval(playBackgroundBar, 4000)` แล้ววางโน้ตที่ `currentTime + i*0.5`
// ซึ่งผูกจังหวะเพลงไว้กับ "เวลาที่ timer มาถึง" — setInterval เป็นนาฬิกา wall-clock ที่สะดุด
// ตาม main thread (React render / preload อาร์ตการ์ด / โหลด MindAR / decode ภาพ) ทุกครั้งที่
// สะดุด บาร์จะเลื่อน = เงียบเป็นช่วงหรือทับซ้อนกัน (วัดจริงด้วย jitter 30–900ms: 10 ใน 11 บาร์ผิด)
// ตอนนี้ timer แค่ "มาถามทุก 200ms ว่าถึงเวลาวางบาร์ถัดไปหรือยัง" ส่วนเวลาเล่นจริงยึด nextBarAt
// บนนาฬิกาของ AudioContext → timer มาช้าก็ยังวางบาร์ตรงจุดเดิม ไม่สะสมความคลาดเคลื่อน
const BAR_SEC = 4; // 8 โน้ต × 0.5 วิ
// วางล่วงหน้า 1 วินาที = กลืนการสะดุดของ main thread ได้ถึง 1 วิโดยไม่มีรอยต่อ วัดจริง
// ด้วย jitter 30–900ms: 0.6s เหลือสะดุด 1 ครั้ง · 1.0s ไม่สะดุดเลย · มากกว่านี้ไม่ได้เพิ่ม
const LOOKAHEAD_SEC = 1;
const PUMP_MS = 200;
let nextBarAt = 0; // เวลาบนนาฬิกา audio ที่บาร์ถัดไปต้องเริ่ม

function scheduleBarAt(c: AudioContext, at: number) {
  const dest = backgroundGain(c);
  const melody = [392, 440, 523.25, 493.88, 440, 392, 329.63, 349.23];
  const bass = [196, 196, 220, 220, 174.61, 174.61, 196, 196];

  melody.forEach((freq, i) => {
    musicToneAt(c, freq, 460, 'sine', 0.12, at + i * 0.5, dest);
  });
  // เบสยาว 900ms คาบเกี่ยวโน้ตถัดไปตั้งใจให้เสียงต่อเนื่อง (คู่ละระดับเสียงเดียวกัน)
  // ตัวสุดท้ายจึงล้นเข้าบาร์ถัดไป 400ms ที่ระดับเสียงเดียวกันพอดี — เป็นการลากเสียง ไม่ใช่เพี้ยน
  bass.forEach((freq, i) => {
    musicToneAt(c, freq, 900, 'triangle', 0.075, at + i * 0.5, dest);
  });
}

function pumpBackground() {
  const c = ac();
  if (!c || !bgPlaying) return;
  // ตกขบวนไปไกล (แท็บถูกพักไว้/เครื่องหลับ) → ข้ามมาเริ่มบาร์ใหม่ ห้ามไล่วางบาร์ที่ค้างย้อนหลัง
  // ไม่งั้นทุกบาร์ที่ตกไปจะถูกวางพร้อมกันในเฟรมเดียว = เสียงถล่มทับกันตอนกลับมาที่แอป
  if (nextBarAt < c.currentTime) nextBarAt = c.currentTime;
  while (nextBarAt < c.currentTime + LOOKAHEAD_SEC) {
    scheduleBarAt(c, nextBarAt);
    nextBarAt += BAR_SEC;
  }
}

export function startBackgroundMusic() {
  if (!enabled) return;
  const c = ac(); // resume() ให้ context ทำงานเมื่อมี user gesture แม้เพลงตั้ง bgPlaying ไว้แล้ว
  if (!c) return;
  if (bgPlaying) return;

  bgPlaying = true;
  const master = backgroundGain(c);
  master.gain.setValueAtTime(0.095, c.currentTime);
  nextBarAt = c.currentTime;
  pumpBackground();
  bgTimers = [setInterval(pumpBackground, PUMP_MS)];
}

export function stopBackgroundMusic() {
  if (!bgPlaying && bgTimers.length === 0) return;
  bgPlaying = false;
  nextBarAt = 0;
  stopBackgroundTimers();
  if (ctx && bgMaster) bgMaster.gain.setValueAtTime(0.0001, ctx.currentTime);
}

// เล่นโน้ตสั้น ๆ
function tone(freq: number, durMs: number, type: OscillatorType = 'sine', gain = 0.15, delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000);
}

function vibrate(pattern: number | number[]) {
  if (enabled && typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// ── เสียงจากไฟล์จริง (public/sound) ──
// เสียงสังเคราะห์ด้านบนยังอยู่ครบและทำหน้าที่เป็น fallback: ถ้าไฟล์โหลดไม่ขึ้น
// (ไฟล์หาย/ยังโหลดไม่เสร็จ/เบราว์เซอร์บล็อก) เกมต้องยังมีเสียงตอบสนอง ไม่ใช่เงียบไปเฉย ๆ
type SampleName = 'success' | 'wait';

const SAMPLE_SRC: Record<SampleName, string> = {
  success: 'sound/success_card.mp3', // ตอบถูก / ได้เหรียญกษัตริย์จากการ์ด AR ทอง
  wait: 'sound/wait_card.mp3', // ลุ้นระทึกระหว่างเข้าภารกิจ + คิดคำตอบ (วนซ้ำ)
};

const samples: Partial<Record<SampleName, HTMLAudioElement>> = {};
const brokenSamples = new Set<SampleName>();

// ⚠️ success_card.mp3 ยาว 74.9 วินาที — เป็น "เพลง" ไม่ใช่เสียงเอฟเฟกต์ แต่จังหวะที่ใช้มัน
// (ตอบถูก/ได้เหรียญกษัตริย์) เกิดทุก ๆ 15–20 วินาที จึงตัดเล่นแค่ท่อนต้นเป็น stinger แล้วหรี่ลง
// ต้องสั้นกว่า 1 เทิร์นเสมอ ไม่งั้นมันจะคาบเกี่ยวการ์ดใบถัดไปแล้วกลืนเสียงของใบนั้นทั้งใบ
const SUCCESS_STINGER_MS = 3000;
const SUCCESS_FADE_MS = 600;
const SUCCESS_VOLUME = 0.85;
// sfx.correct() ถูกเรียก 2 นัดต่อการตอบ 1 ข้อ (ตอนเฉลย + ตอนกดปุ่มเดินเกมต่อ) — นัดที่สอง
// ต้องไม่รีสตาร์ทเพลงกลางคัน · เดิมใช้ "เพลงยังเล่นอยู่ไหม" เป็นตัวแทนของ "นัดเดิมหรือเปล่า"
// ซึ่งกินยาว 75 วิ = ตอบถูกอีก 4–5 ครั้งถัดไปโดนกลืนหมด ตอนนี้วัดจาก currentTime แทน
const SUCCESS_RETRIGGER_SEC = 1.2;
let successFadeTimer: ReturnType<typeof setTimeout> | null = null;
let successFadeStep: ReturnType<typeof setInterval> | null = null;

function sample(name: SampleName): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (brokenSamples.has(name)) return null;
  let el = samples[name];
  if (!el) {
    // BASE_URL กัน path พังถ้าวันหน้าเสิร์ฟใต้ subpath (ตอนนี้เป็น '/')
    el = new Audio(`${import.meta.env.BASE_URL}${SAMPLE_SRC[name]}`);
    el.preload = 'auto';
    // โหลดไม่ได้ = เลิกพยายามถาวร แล้วปล่อยให้เสียงสังเคราะห์รับช่วงต่อ
    el.addEventListener('error', () => brokenSamples.add(name));
    if (name === 'success') el.addEventListener('ended', () => duckBackground(false));
    samples[name] = el;
  }
  return el;
}

function stopSample(name: SampleName) {
  const el = samples[name];
  if (!el) return;
  el.pause();
  el.currentTime = 0;
}

function successPlaying() {
  const el = samples.success;
  return !!el && !el.paused && !el.ended;
}

function clearSuccessTimers() {
  if (successFadeTimer !== null) {
    clearTimeout(successFadeTimer);
    successFadeTimer = null;
  }
  if (successFadeStep !== null) {
    clearInterval(successFadeStep);
    successFadeStep = null;
  }
}

// หยุดเพลงฉลองทันที — ต้องเรียกทุกจังหวะที่ "เรื่องเปลี่ยนไปแล้ว" (เริ่มลุ้นใบใหม่ / ตอบผิด /
// ออกจากเกม / ปิดเสียง) ไม่งั้นเพลงฉลองจะไปคลออยู่เบื้องหลังเหตุการณ์ที่ไม่ได้ฉลองอะไรเลย
function stopSuccess() {
  clearSuccessTimers();
  stopSample('success');
  const el = samples.success;
  if (el) el.volume = SUCCESS_VOLUME; // คืนระดับเสียงเผื่อหยุดกลางช่วง fade
}

function fadeOutSuccess() {
  successFadeTimer = null;
  const el = samples.success;
  if (!el || el.paused) return;
  const stepCount = Math.max(1, Math.round(SUCCESS_FADE_MS / 50));
  const step = el.volume / stepCount;
  successFadeStep = setInterval(() => {
    const next = el.volume - step;
    if (next <= 0.02) {
      stopSuccess();
      duckBackground(false);
      return;
    }
    el.volume = next;
  }, 50);
}

// หรี่เพลงพื้นหลังสังเคราะห์ขณะเล่นไฟล์เสียง — ไม่หยุดเพลง (จะได้ไม่ต้องจำสถานะว่าต้องเปิดคืนไหม)
// แค่ลดเกนของ bus เพลงอย่างเดียว เสียง sfx สั้น ๆ ต่อ destination ตรงจึงไม่โดนหรี่ไปด้วย
function duckBackground(on: boolean) {
  if (!ctx || !bgMaster) return;
  // เพลงถูกปิดเสียง/หยุดไปแล้ว = ห้ามมีใครดันเกนกลับขึ้นมา · จำเป็นเพราะการคืนเกนมาจาก
  // callback ที่มาถึงทีหลังได้ (fade ของ stinger, event 'ended') ซึ่งอาจวิ่งมาหลังผู้เล่นกด
  // ปิดเสียงหรือออกจากเกมไปแล้ว แล้วปลุกโน้ตที่ schedule ค้างไว้ให้ดังเต็มเสียง
  if (!enabled || !bgPlaying) {
    bgMaster.gain.setValueAtTime(0.0001, ctx.currentTime);
    return;
  }
  bgMaster.gain.setTargetAtTime(on ? 0.018 : 0.095, ctx.currentTime, 0.12);
}

export function startSuspense() {
  if (!enabled) return;
  const el = sample('wait');
  if (!el) return;
  stopSuccess(); // เพลงฉลองของใบก่อนต้องจบก่อนเสมอ ไม่งั้นดังทับเสียงลุ้นของใบใหม่
  if (!el.paused) return; // เล่นค้างอยู่แล้ว — อย่ารีเซ็ตให้เสียงกระตุก
  el.loop = true;
  el.volume = 0.5;
  el.currentTime = 0;
  duckBackground(true);
  // ยังไม่มี user gesture (autoplay policy) — ปล่อยผ่านเงียบ ๆ ไม่ throw ใส่เกม
  el.play().catch(() => {});
}

export function stopSuspense() {
  stopSample('wait');
  // ถ้าเสียงฉลองกำลังเล่นต่อทันที อย่าเพิ่งเปิดเพลงคืน ไม่งั้นตีกับเสียงฉลอง
  if (!successPlaying()) duckBackground(false);
}

// เสียงสำเร็จ (ครั้งเดียวจบ) — คืน false เมื่อเล่นไม่ได้ ให้ผู้เรียกถอยไปใช้เสียงสังเคราะห์
function playSuccessSample(): boolean {
  if (!enabled) return false;
  const el = sample('success');
  if (!el) return false;
  stopSample('wait'); // ลุ้นจบแล้ว — ต้องหยุดก่อนเสมอ ไม่ใช่เฉพาะตอนที่ได้เล่นเพลงฉลองจริง
  // นัดที่สองของ "การตอบครั้งเดียวกัน" (เฉลย → กดปุ่มเดินเกมต่อ) — ปล่อยให้เพลงเล่นต่อ
  // ไม่รีสตาร์ทกลางคัน · เกินช่วงนี้ถือเป็นคำตอบใหม่ ต้องได้ยินเสียงใหม่เสมอ
  if (successPlaying() && el.currentTime < SUCCESS_RETRIGGER_SEC) return true;
  clearSuccessTimers();
  el.loop = false;
  el.volume = SUCCESS_VOLUME;
  el.currentTime = 0;
  duckBackground(true);
  el.play().catch(() => {
    brokenSamples.add('success');
    duckBackground(false);
  });
  successFadeTimer = setTimeout(fadeOutSuccess, SUCCESS_STINGER_MS);
  return true;
}

export const sfx = {
  roll() {
    // เสียงกลิ้งลูกเต๋า + สั่นเป็นจังหวะให้รู้สึกลุ้น
    tone(180, 60, 'square', 0.1);
    tone(240, 60, 'square', 0.1, 0.07);
    tone(200, 50, 'square', 0.08, 0.16);
    tone(260, 50, 'square', 0.08, 0.24);
    vibrate([25, 40, 25, 40, 25, 60]);
  },
  reveal() {
    tone(660, 90, 'sine', 0.14);
    tone(990, 140, 'sine', 0.14, 0.06);
    vibrate(70);
  },
  step() {
    tone(520, 40, 'triangle', 0.08);
  },
  coin() {
    tone(880, 70, 'sine', 0.12);
    tone(1320, 90, 'sine', 0.12, 0.06);
  },
  correct() {
    // ไฟล์เสียงจริงก่อน — ถ้าใช้ไม่ได้ค่อยถอยไปอาร์เพจจิโอสังเคราะห์ (เกมต้องไม่เงียบ)
    if (!playSuccessSample()) {
      tone(659, 120, 'sine', 0.15); // E5
      tone(784, 120, 'sine', 0.15, 0.1); // G5
      tone(1047, 200, 'sine', 0.15, 0.2); // C6
    }
    vibrate([30, 40, 30]);
  },
  wrong() {
    stopSuccess(); // เพลงฉลองของใบก่อนต้องไม่ดังคลออยู่ตอนเด็กเพิ่งตอบผิด
    stopSuspense(); // ลุ้นจบแล้ว (แค่จบแบบไม่สวย) — คืนเพลงพื้นหลังด้วย
    tone(200, 250, 'sawtooth', 0.12);
    vibrate(120);
  },
  unlock() {
    if (!playSuccessSample()) {
      tone(523, 120, 'sine', 0.15); // C5
      tone(659, 120, 'sine', 0.15, 0.1);
      tone(784, 120, 'sine', 0.15, 0.2);
      tone(1047, 300, 'sine', 0.16, 0.32);
    }
    vibrate([40, 30, 40, 30, 80]);
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 200, 'sine', 0.15, i * 0.12));
    vibrate([50, 40, 50, 40, 120]);
  },
  tap() {
    tone(440, 30, 'sine', 0.06);
  },
};
