// Фонова музика головної теми — окремий модуль від sound.js (короткі
// ефекти), але користується ТИМ САМИМ AudioContext (getSharedAudioContext),
// щоб на сторінці працював лише один аудіоконтекст.
//
// Свідомо НЕ використовуємо звичайний <audio loop>: у MP3 через приховане
// доповнення кодувальника (encoder delay/padding) штатний loop-атрибут
// браузера часто дає ледь чутний клац на стику. AudioBufferSourceNode з
// loop=true, навпаки, зациклює вже розкодований сирий буфер семпл-у-семпл —
// це надійний спосіб отримати справді безшовний loop, і "після завершення
// автоматично починається знову" виконується сам собою (той самий вузол
// ніколи не зупиняється й не перестворюється між екранами SPA).

import { isSoundEnabled, getSharedAudioContext } from "./sound.js";

const SOURCES = [
  "/assets/audio/music/main_theme.ogg",
  "/assets/audio/music/main_theme.mp3",
];

const MUSIC_ENABLED_KEY = "musicEnabled";
const MUSIC_VOLUME_KEY = "musicVolume";
const DEFAULT_MUSIC_VOLUME = 0.18; // ~15-20%, як просив бриф

const RATE_CALM = 1.0;
const RATE_ACTIVE = 1.035; // ледь відчутне пришвидшення для бою/лабіринту/перегонів
const INTENSITY_BOOST = 1.3; // множник гучності у "активному" стані
const VISIBILITY_MULT = 0.12; // наскільки приглушуємо, коли вкладка неактивна
const DUCK_MULT = 0.35; // наскільки приглушуємо на час звуку перемоги

const FADE_IN_SEC = 1.4; // плавна поява при першому старті
const FADE_OUT_SEC = 0.8; // плавне згасання при вимкненні музики тумблером
const INTENSITY_RAMP_SEC = 0.7; // перехід calm <-> active
const DUCK_DOWN_SEC = 0.18; // швидко пригасити (перемога / вкладка згорнута)
const DUCK_UP_SEC = 0.7; // плавно повернути назад

let buffer = null;
let loadingPromise = null;
let sourceNode = null;
let gainNode = null;
let enabled = true;
let intensity = "calm";
let baseVolume = DEFAULT_MUSIC_VOLUME;
let tabHidden = false;
let ducking = false;
let startRequested = false;
let unlockAttached = false;
let visibilityAttached = false;
let duckTimer = null;

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function ctxOrNull() {
  try {
    return getSharedAudioContext();
  } catch {
    return null;
  }
}

// ------------------------------------------------------- persistence -----
export function isMusicEnabled() {
  try {
    return localStorage.getItem(MUSIC_ENABLED_KEY) !== "off";
  } catch {
    return true;
  }
}

function persistMusicEnabled(v) {
  try {
    localStorage.setItem(MUSIC_ENABLED_KEY, v ? "on" : "off");
  } catch {
    /* не збереглось цього разу — не критично */
  }
}

export function getMusicVolume() {
  try {
    const raw = localStorage.getItem(MUSIC_VOLUME_KEY);
    if (raw === null) return DEFAULT_MUSIC_VOLUME;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? clamp01(v) : DEFAULT_MUSIC_VOLUME;
  } catch {
    return DEFAULT_MUSIC_VOLUME;
  }
}

export function setMusicVolume(v) {
  const clamped = clamp01(v);
  try {
    localStorage.setItem(MUSIC_VOLUME_KEY, String(clamped));
  } catch {
    /* не збереглось цього разу — не критично */
  }
  baseVolume = clamped;
  applyGain(0.4);
}

// ------------------------------------------------------------ loading -----
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

// -------------------------------------------------- autoplay unlocking ----
// Через обмеження браузерів звук не можна примусово ввімкнути до першого
// жесту користувача. Ми готуємо (завантажуємо/розкодовуємо) трек одразу, і
// навіть викликаємо .start() на вже підготованому вузлі — але поки
// AudioContext лишається suspended, це нічим не звучить. Щойно трапляється
// перший клік/тап/клавіша будь-де на сторінці, контекст резюмиться і трек
// стає чутним — рівно один раз, без повторного запуску.
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

// ------------------------------------------------------ tab visibility ----
function attachVisibilityListener() {
  if (visibilityAttached || typeof document === "undefined") return;
  visibilityAttached = true;
  document.addEventListener("visibilitychange", () => {
    tabHidden = document.hidden;
    applyGain(tabHidden ? DUCK_DOWN_SEC : DUCK_UP_SEC);
  });
}

// --------------------------------------------------------- gain control ---
function effectiveVolume() {
  let v = baseVolume;
  if (intensity === "active") v *= INTENSITY_BOOST;
  if (tabHidden) v *= VISIBILITY_MULT;
  if (ducking) v *= DUCK_MULT;
  return clamp01(v);
}

function applyGain(rampSec) {
  if (!gainNode) return;
  const ctx = ctxOrNull();
  if (!ctx) return;
  const now = ctx.currentTime;
  const target = Math.max(effectiveVolume(), 0.0001);
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(target, now + rampSec);
}

// ------------------------------------------------------- start / stop -----
function ensurePlaying() {
  if (!enabled || !buffer || sourceNode) return;
  const ctx = ctxOrNull();
  if (!ctx) return;

  gainNode = ctx.createGain();
  gainNode.gain.value = 0.0001; // старт у тиші — далі плавний fade-in
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

  applyGain(FADE_IN_SEC);
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
      gain.gain.linearRampToValueAtTime(0.0001, now + FADE_OUT_SEC);
    }
  } catch {
    /* якщо рампу побудувати не вдалось — просто зупиняємо нижче */
  }
  setTimeout(() => {
    try { node.stop(); } catch { /* вже зупинений */ }
    try { node.disconnect(); } catch { /* вже відʼєднаний */ }
    try { gain && gain.disconnect(); } catch { /* вже відʼєднаний */ }
  }, Math.ceil(FADE_OUT_SEC * 1000) + 30);
}

// -------------------------------------------------------------- public ----
// Викликати один раз (App.jsx, при монтуванні) — сама лише підготовка
// (завантаження й розкодування) НЕ потребує жесту користувача, тож може
// стартувати одразу; фактичний звук зʼявиться щойно спрацює перший клік/тап
// десь на сторінці (браузерна політика автовідтворення). Наступні переходи
// між екранами SPA НЕ перезапускають трек — initMusic просто не робить
// нічого, якщо він уже готовий/грає (guard через startRequested/sourceNode).
export function initMusic() {
  if (typeof window === "undefined") return;
  enabled = isMusicEnabled();
  baseVolume = getMusicVolume();
  attachUnlockListeners();
  attachVisibilityListener();
  startRequested = true;
  loadBuffer().then((buf) => {
    if (buf && startRequested) ensurePlaying();
  });
}

// Незалежний від звукових ефектів тумблер "Музика" (окремий ключ
// localStorage "musicEnabled", окремий від "sfxEnabled" у sound.js).
export function setMusicEnabled(next) {
  enabled = next;
  persistMusicEnabled(next);
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
  applyGain(INTENSITY_RAMP_SEC);
  const ctx = ctxOrNull();
  if (ctx && sourceNode) {
    try {
      const now = ctx.currentTime;
      sourceNode.playbackRate.cancelScheduledValues(now);
      sourceNode.playbackRate.setValueAtTime(sourceNode.playbackRate.value, now);
      sourceNode.playbackRate.linearRampToValueAtTime(
        next === "active" ? RATE_ACTIVE : RATE_CALM,
        now + INTENSITY_RAMP_SEC
      );
    } catch {
      /* ігноруємо */
    }
  }
}

// Короткочасно приглушити музику (звук перемоги, рівня тощо) й плавно
// повернути стандартну гучність, коли подія стихне. Викликається з sfx.js
// для "важливих" звукових подій (playSfx() у списку IMPORTANT).
export function duckMusic(seconds = 0.9) {
  if (!isSoundEnabled()) return; // якщо ефекти вимкнені — приглушувати нічого не для чого
  ducking = true;
  applyGain(DUCK_DOWN_SEC);
  if (duckTimer) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    ducking = false;
    applyGain(DUCK_UP_SEC);
  }, Math.max(50, seconds * 1000));
}
