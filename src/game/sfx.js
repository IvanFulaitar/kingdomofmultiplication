// Повна система коротких звукових ефектів (файли, не осцилятори) — 36
// окремих семплів у public/assets/audio/sfx/. sound.js лишається "шаром
// налаштувань" (isSoundEnabled/getSfxVolume/persist), а цей модуль — шаром
// відтворення: буферизація через Web Audio (той самий спільний
// AudioContext, що й music.js/sound.js), попереднє й лениве завантаження,
// cooldown і обмеження накладання копій одного й того ж звуку, коротке
// приглушення музики (duckMusic) для "важливих" подій.

import { isSoundEnabled, getSfxVolume, getSharedAudioContext } from "./sound.js";
import { duckMusic } from "./music.js";

const BASE = "/assets/audio/sfx/";

// Часто повторювані/наскрізні звуки — вантажимо одразу при старті гри.
const CORE = [
  "ui_click", "ui_primary", "ui_back", "modal_open", "modal_close",
  "answer_correct", "answer_wrong", "coin", "star", "xp_gain", "hint", "streak",
];

// Рідкісні/специфічні для режиму звуки — вантажимо лише під час відкриття
// відповідного екрана, щоб не тягнути зайве на головному меню.
const GROUPS = {
  rewards: ["level_up", "achievement", "chest_open", "purchase_success", "insufficient_coins"],
  combat: ["attack", "enemy_hit", "heart_lost", "victory", "defeat"],
  maze: ["maze_move", "key_pickup", "door_open", "trap", "portal", "maze_exit"],
  race: ["race_start", "race_boost", "race_overtake", "race_finish"],
  memory: ["card_flip", "pair_match", "pair_wrong", "memory_complete"],
};

// "Важливі" події — під час них коротко приглушуємо фонову музику
// через той самий duckMusic(), що й music.js уже надає.
const IMPORTANT = new Set(["level_up", "achievement", "victory", "defeat", "race_finish", "memory_complete", "maze_exit"]);

// Виміряно (ffmpeg volumedetect): самі файли цих "важливих" стінгерів НЕ
// гучніші за музику (усі ~-15..-18dB mean, як і трек). "Перебивали" музику
// вони через розрив множників гучності при затишенні (duckMusic у
// music.js) — SFX і далі грав на повній getSfxVolume(), тоді як музика
// падала набагато нижче. 0.7 тут разом зі зменшеним DUCK_MULT (0.5,
// music.js) звужує цей розрив із ~+13.6dB до ~+7.4dB — стінгер усе ще
// чітко виділяється, але вже не оглушує.
const IMPORTANT_GAIN_SCALE = 0.7;

// Per-id налаштування анти-спаму: невеликий cooldown для частих кліків,
// суворіший ліміт (без накладання копій) для великих одноразових подій.
const DEFAULT_RULE = { cooldownMs: 90, maxOverlap: 2 };
const RULES = {
  ui_click: { cooldownMs: 70, maxOverlap: 3 },
  maze_move: { cooldownMs: 120, maxOverlap: 2 },
  card_flip: { cooldownMs: 80, maxOverlap: 2 },
};
for (const id of IMPORTANT) RULES[id] = { cooldownMs: 500, maxOverlap: 1 };

const buffers = new Map(); // id -> AudioBuffer | Promise<AudioBuffer|null>
const lastPlayed = new Map(); // id -> timestamp (ms)
const activeCount = new Map(); // id -> кількість зараз відтворюваних копій

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function ctxOrNull() {
  try {
    return getSharedAudioContext();
  } catch {
    return null;
  }
}

async function loadOne(id) {
  const cached = buffers.get(id);
  if (cached && !(cached instanceof Promise)) return cached;
  if (cached instanceof Promise) return cached;
  const ctx = ctxOrNull();
  if (!ctx) return null;

  const promise = (async () => {
    try {
      const res = await fetch(`${BASE}${id}.mp3`);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const decoded = await new Promise((resolve, reject) => {
        const maybePromise = ctx.decodeAudioData(arr, resolve, reject);
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve, reject);
        }
      });
      return decoded;
    } catch {
      return null;
    }
  })();

  buffers.set(id, promise);
  const decoded = await promise;
  buffers.set(id, decoded);
  return decoded;
}

// Викликати один раз при старті застосунку (App.jsx).
export function preloadCoreSfx() {
  CORE.forEach(loadOne);
}

// Викликати при вході в конкретний режим ("maze" | "race" | "memory" |
// "combat" | "rewards") — безпечно кликати повторно, кеш не дублюється.
export function preloadSfxGroup(name) {
  (GROUPS[name] || []).forEach(loadOne);
}

// Універсальний програвач. Не блокує виклик (усе асинхронне під капотом),
// тож ніколи не затримує клік/перехід. Тихо ігнорує все, якщо ефекти
// вимкнені, звук ще не завантажений, або той самий звук зараз надто часто
// повторюється / вже грає забагато копій.
export function playSfx(id) {
  if (!isSoundEnabled()) return;
  const rule = RULES[id] ?? DEFAULT_RULE;

  const t = now();
  const last = lastPlayed.get(id) ?? -Infinity;
  if (t - last < rule.cooldownMs) return;
  const active = activeCount.get(id) ?? 0;
  if (active >= rule.maxOverlap) return;
  lastPlayed.set(id, t);

  loadOne(id).then((buf) => {
    if (!buf) return;
    const ctx = ctxOrNull();
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.gain.value = getSfxVolume() * (IMPORTANT.has(id) ? IMPORTANT_GAIN_SCALE : 1);
    gain.connect(ctx.destination);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);

    activeCount.set(id, (activeCount.get(id) ?? 0) + 1);
    src.onended = () => {
      activeCount.set(id, Math.max(0, (activeCount.get(id) ?? 1) - 1));
      try { src.disconnect(); } catch { /* вже відʼєднаний */ }
      try { gain.disconnect(); } catch { /* вже відʼєднаний */ }
    };

    if (IMPORTANT.has(id)) duckMusic(buf.duration + 0.2);

    src.start(0);
  });
}

// ------------------------------------------------- зручні іменовані виклики
export const playUiClick = () => playSfx("ui_click");
export const playUiPrimary = () => playSfx("ui_primary");
export const playUiBack = () => playSfx("ui_back");
export const playModalOpen = () => playSfx("modal_open");
export const playModalClose = () => playSfx("modal_close");

export const playAnswerCorrect = () => playSfx("answer_correct");
export const playAnswerWrong = () => playSfx("answer_wrong");
export const playStreakSfx = () => playSfx("streak");
export const playHintSfx = () => playSfx("hint");

export const playCoin = () => playSfx("coin");
export const playStar = () => playSfx("star");
export const playXpGain = () => playSfx("xp_gain");
export const playLevelUp = () => playSfx("level_up");
export const playAchievementSfx = () => playSfx("achievement");
export const playChestOpen = () => playSfx("chest_open");
export const playPurchaseSuccess = () => playSfx("purchase_success");
export const playInsufficientCoins = () => playSfx("insufficient_coins");

export const playAttack = () => playSfx("attack");
export const playEnemyHit = () => playSfx("enemy_hit");
export const playHeartLost = () => playSfx("heart_lost");
export const playVictory = () => playSfx("victory");
export const playDefeat = () => playSfx("defeat");

export const playCardFlip = () => playSfx("card_flip");
export const playPairMatch = () => playSfx("pair_match");
export const playPairWrong = () => playSfx("pair_wrong");
export const playMemoryComplete = () => playSfx("memory_complete");

export const playMazeMove = () => playSfx("maze_move");
export const playKeyPickup = () => playSfx("key_pickup");
export const playDoorOpen = () => playSfx("door_open");
export const playTrapSfx = () => playSfx("trap");
export const playPortal = () => playSfx("portal");
export const playMazeExit = () => playSfx("maze_exit");

export const playRaceStart = () => playSfx("race_start");
export const playRaceBoost = () => playSfx("race_boost");
export const playRaceOvertake = () => playSfx("race_overtake");
export const playRaceFinish = () => playSfx("race_finish");
