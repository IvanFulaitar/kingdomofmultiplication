// Фонова музика головної теми — окремий модуль від sound.js (короткі
// ефекти), але користується ТИМ САМИМ AudioContext (getSharedAudioContext),
// щоб на сторінці працював лише один аудіоконтекст.
//
// Свідомо НЕ використовуємо звичайний <audio loop>: у MP3 через приховане
// доповнення кодувальника (encoder delay/padding) штатний loop-атрибут
// браузера часто дає ледь чутний клац на стику. AudioBufferSourceNode з
// loop=true, навпаки, зациклює вже розкодований сирий буфер семпл-у-семпл —
// це надійний спосіб отримати справді безшовний loop.

import { isSoundEnabled, getSharedAudioContext } from "./sound.js";

const SOURCES = [
  "/assets/audio/music/main_theme.ogg",
  "/assets/audio/music/main_theme.mp3",
];

// Гучність музики навмисно нижча за типовий gain звукових ефектів (0.07–0.2
// у sound.js), щоб клік і "правильна відповідь" завжди лишались чутними.
const VOLUME_CALM = 0.4;
const VOLUME_ACTIVE = 0.52;
const RATE_CALM = 1.0;
const RATE_ACTIVE = 1.035; // ледь відчутне пришвидшення для бою/лабіринту/перегонів
const RAMP_SEC = 0.7;
const FADE_SEC = 0.25;

let buffer = null;
let loadingPromise = null;
let sourceNode = null;
let gainNode = null;
let enabled = true;
let intensity = "calm";
let startRequested = false;
let unlockAttached = false;

function ctxOrNull() {
  try {
    return getSharedAudioContext();
  } catch {
    return null;
  }
}

async function loadBuffer() {
  if (buffer) return buffer;
  if (loadingPromise) return loadingPromise;
  const ctx = ctxOrNull();
  if (!ctx) return null;

  loadingPromise = (async () => {
    for (const url of SOURCES) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        const decoded = await new Promise((resolve, reject) => {
          // decodeAudioData повертає Promise у сучасних браузерах, але старий
          // callback-синтаксис теж підтримуємо про всяк випадок.
          const maybePromise = ctx.decodeAudioData(arr, resolve, reject);
          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.then(resolve, reject);
          }
        });
        buffer = decoded;
        return buffer;
      } catch {
        // пробуємо наступний формат у списку (напр. якщо .ogg не підтримується)
      }
    }
    return null;
  })();

  return loadingPromise;
}

function attachUnlockListeners() {
  if (unlockAttached || typeof window === "undefined") return;
  unlockAttached = true;
  const unlock = () => {
    ctxOrNull();
    ensurePlaying();
  };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });
}

function ensurePlaying() {
  if (!enabled || !buffer || sourceNode) return;
  const ctx = ctxOrNull();
  if (!ctx) return;

  gainNode = ctx.createGain();
  gainNode.gain.value = intensity === "active" ? VOLUME_ACTIVE : VOLUME_CALM;
  gainNode.connect(ctx.destination);

  sourceNode = ctx.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.loop = true;
  sourceNode.loopStart = 0;
  sourceNode.loopEnd = buffer.duration;
  try {
    sourceNode.playbackRate.value = intensity === "active" ? RATE_ACTIVE : RATE_CALM;
  } catch {
    /* ігноруємо, якщо AudioParam з якоїсь причини недоступний */
  }
  sourceNode.connect(gainNode);
  sourceNode.start(0);
}

function stopPlaying() {
  if (!sourceNode) return;
  const ctx = ctxOrNull();
  const node = sourceNode;
  const gain = gainNode;
  sourceNode = null;
  gainNode = null;
  try {
    if (ctx && gain) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + FADE_SEC);
    }
  } catch {
    /* якщо рампу побудувати не вдалось — просто зупиняємо нижче */
  }
  setTimeout(() => {
    try { node.stop(); } catch { /* вже зупинений */ }
    try { node.disconnect(); } catch { /* вже відʼєднаний */ }
    try { gain && gain.disconnect(); } catch { /* вже відʼєднаний */ }
  }, Math.ceil(FADE_SEC * 1000) + 30);
}

// Викликати один раз (App.jsx, при монтуванні) — сама лише підготовка
// (завантаження й розкодування) НЕ потребує жесту користувача, тож може
// стартувати одразу; фактичний звук зʼявиться щойно спрацює перший клік/тап
// десь на сторінці (браузерна політика автовідтворення).
export function initMusic() {
  if (typeof window === "undefined") return;
  enabled = isSoundEnabled();
  attachUnlockListeners();
  startRequested = true;
  loadBuffer().then((buf) => {
    if (buf && startRequested) ensurePlaying();
  });
}

// Викликається разом із тим самим тумблером, що вмикає/вимикає звукові
// ефекти (єдиний 🔊/🔇 перемикач на головному екрані керує й музикою).
export function setMusicEnabled(next) {
  enabled = next;
  if (next) {
    startRequested = true;
    if (buffer) ensurePlaying();
    else loadBuffer().then((buf) => { if (buf && startRequested) ensurePlaying(); });
  } else {
    startRequested = false;
    stopPlaying();
  }
}

// 'active' — трохи енергійніше (бій, лабіринт, перегони), 'calm' — усюди
// інде. Та сама головна тема, лише плавна зміна гучності й темпу.
export function setMusicIntensity(next) {
  if (next !== "calm" && next !== "active") return;
  intensity = next;
  const ctx = ctxOrNull();
  if (!ctx) return;
  const targetVol = next === "active" ? VOLUME_ACTIVE : VOLUME_CALM;
  const targetRate = next === "active" ? RATE_ACTIVE : RATE_CALM;
  if (gainNode) {
    const now = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(targetVol, now + RAMP_SEC);
  }
  if (sourceNode) {
    try {
      const now = ctx.currentTime;
      sourceNode.playbackRate.cancelScheduledValues(now);
      sourceNode.playbackRate.setValueAtTime(sourceNode.playbackRate.value, now);
      sourceNode.playbackRate.linearRampToValueAtTime(targetRate, now + RAMP_SEC);
    } catch {
      /* ігноруємо */
    }
  }
}
