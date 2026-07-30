// Прості звукові ефекти через Web Audio API — синтезуються прямо в
// браузері, жодних аудіофайлів не потрібно. Вимкнути/увімкнути можна
// незалежно від прогресу гри (свій ключ localStorage).

const SOUND_KEY = "kingdom-multiplication-sound";
let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Той самий AudioContext віддається й фоновій музиці (music.js), щоб на
// сторінці існував лише один спільний контекст, а не два незалежних.
export function getSharedAudioContext() {
  return getCtx();
}

export function isSoundEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
  } catch {
    /* не збереглось цього разу — не критично */
  }
}

// Один тон: частота (Гц), зсув старту (с), тривалість (с), форма хвилі, гучність.
function tone(freq, start, duration, type, gain) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = audioCtx.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function play(sequence) {
  if (!isSoundEnabled()) return;
  sequence.forEach(([freq, start, duration, type, gain]) => tone(freq, start, duration, type, gain));
}

// Короткий клік для основних кнопок (Грати, навігація).
export function playClick() {
  play([[520, 0, 0.06, "square", 0.07]]);
}

// Веселий висхідний передзвін на правильну відповідь.
export function playCorrect() {
  play([
    [523.25, 0, 0.12, "sine", 0.16],
    [659.25, 0.08, 0.14, "sine", 0.16],
    [783.99, 0.16, 0.18, "sine", 0.18],
  ]);
}

// М'який низький "промах" на неправильну відповідь — без різкості.
export function playWrong() {
  play([
    [220, 0, 0.16, "sawtooth", 0.12],
    [174.61, 0.1, 0.22, "sawtooth", 0.12],
  ]);
}

// Фанфари на завершення рівня / перемогу.
export function playWin() {
  play([
    [523.25, 0, 0.12, "triangle", 0.16],
    [659.25, 0.1, 0.12, "triangle", 0.16],
    [783.99, 0.2, 0.12, "triangle", 0.16],
    [1046.5, 0.3, 0.3, "triangle", 0.2],
  ]);
}

// Іскристий передзвін на здобутий бейдж.
export function playBadge() {
  play([
    [783.99, 0, 0.1, "sine", 0.16],
    [987.77, 0.08, 0.1, "sine", 0.16],
    [1174.66, 0.16, 0.24, "sine", 0.2],
  ]);
}

// Коротка енергійна висхідна фраза на вхід в останні (найнапруженіші)
// раунди "Перегонів" — заміна "музика стає активнішою" без окремого
// музичного треку, якого в грі поки що немає.
export function playFinalStretch() {
  play([
    [392, 0, 0.09, "square", 0.1],
    [523.25, 0.08, 0.09, "square", 0.11],
    [659.25, 0.16, 0.12, "square", 0.13],
  ]);
}
