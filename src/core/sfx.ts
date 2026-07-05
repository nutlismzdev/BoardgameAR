// ระบบเสียง + haptic — สังเคราะห์เสียงด้วย Web Audio API (ไม่ต้องมีไฟล์เสียง)
// เปิด/ปิดผ่าน settings.soundEnabled

let ctx: AudioContext | null = null;
let enabled = true;
let bgMaster: GainNode | null = null;
let bgTimers: ReturnType<typeof setInterval>[] = [];
let bgPlaying = false;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (!on) stopBackgroundMusic();
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
    bgMaster.gain.value = 0.045;
    bgMaster.connect(c.destination);
  }
  return bgMaster;
}

function musicTone(
  freq: number,
  durMs: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
  destination?: AudioNode
) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g).connect(destination ?? c.destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000);
}

function playBackgroundBar() {
  const c = ac();
  if (!c) return;
  const dest = backgroundGain(c);
  const melody = [392, 440, 523.25, 493.88, 440, 392, 329.63, 349.23];
  const bass = [196, 196, 220, 220, 174.61, 174.61, 196, 196];

  melody.forEach((freq, i) => {
    musicTone(freq, 460, 'sine', 0.08, i * 0.5, dest);
  });
  bass.forEach((freq, i) => {
    musicTone(freq, 900, 'triangle', 0.045, i * 0.5, dest);
  });
}

export function startBackgroundMusic() {
  if (bgPlaying || !enabled) return;
  const c = ac();
  if (!c) return;

  bgPlaying = true;
  const master = backgroundGain(c);
  master.gain.setValueAtTime(0.045, c.currentTime);
  playBackgroundBar();
  bgTimers = [setInterval(playBackgroundBar, 4000)];
}

export function stopBackgroundMusic() {
  if (!bgPlaying && bgTimers.length === 0) return;
  bgPlaying = false;
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
    tone(659, 120, 'sine', 0.15); // E5
    tone(784, 120, 'sine', 0.15, 0.1); // G5
    tone(1047, 200, 'sine', 0.15, 0.2); // C6
    vibrate([30, 40, 30]);
  },
  wrong() {
    tone(200, 250, 'sawtooth', 0.12);
    vibrate(120);
  },
  unlock() {
    tone(523, 120, 'sine', 0.15); // C5
    tone(659, 120, 'sine', 0.15, 0.1);
    tone(784, 120, 'sine', 0.15, 0.2);
    tone(1047, 300, 'sine', 0.16, 0.32);
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
