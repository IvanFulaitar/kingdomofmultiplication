// Шар налаштувань звукових ефектів: увімкнено/вимкнено (sfxEnabled) і
// загальна гучність (sfxVolume) — окремо від Music (music.js). Саме
// відтворення (36 файлів у public/assets/audio/sfx/) живе у sfx.js; той
// модуль читає getSfxVolume()/isSoundEnabled() звідси. Розділення навмисне:
// тут — лише персистентність і спільний AudioContext, без залежності від
// music.js чи sfx.js (жодних циклічних імпортів).

const SOUND_KEY = "sfxEnabled";
const OLD_SOUND_KEY = "kingdom-multiplication-sound"; // старий ключ (до розділення Music/SFX)
const SFX_VOLUME_KEY = "sfxVolume";
// Було 0.5 (~45-60%, як просив початковий бриф) — але виміряно (ffmpeg
// volumedetect), що самі файли ефектів у середньому на 3-6dB "гучніші" за
// себе, ніж трек фонової музики (SFX мали ширший запас на мастерингу),
// тож при однаковому множнику 0.5 ефекти реально перебивали музику навіть
// без будь-яких "важливих" подій-дакерів. 0.3 повертає баланс — ефекти й
// далі чітко чутні поверх музики, але вже не забивають її.
const DEFAULT_SFX_VOLUME = 0.3;
let migrated = false;
let ctx = null;

function migrateOldKey() {
  if (migrated) return;
  migrated = true;
  try {
    if (localStorage.getItem(SOUND_KEY) === null) {
      const old = localStorage.getItem(OLD_SOUND_KEY);
      if (old !== null) localStorage.setItem(SOUND_KEY, old);
    }
  } catch {
    /* не критично */
  }
}

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

// Той самий AudioContext віддається й фоновій музиці (music.js), і
// звуковим ефектам (sfx.js), щоб на сторінці існував лише один спільний
// контекст, а не декілька незалежних.
export function getSharedAudioContext() {
  return getCtx();
}

export function isSoundEnabled() {
  migrateOldKey();
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

// Загальний множник гучності ефектів (0..1) — окремий від Music, свій ключ
// localStorage ("sfxVolume"), відновлюється при наступному відкритті гри.
export function getSfxVolume() {
  try {
    const raw = localStorage.getItem(SFX_VOLUME_KEY);
    if (raw === null) return DEFAULT_SFX_VOLUME;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_SFX_VOLUME;
  } catch {
    return DEFAULT_SFX_VOLUME;
  }
}

export function setSfxVolume(v) {
  try {
    localStorage.setItem(SFX_VOLUME_KEY, String(Math.min(1, Math.max(0, v))));
  } catch {
    /* не збереглось цього разу — не критично */
  }
}
