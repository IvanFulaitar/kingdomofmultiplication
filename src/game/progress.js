import { QUEST_POOL, pickDailyQuestIds } from "../data/rewards.js";

export const STORAGE_KEY = "kingdom-multiplication-progress";
// Резервна копія — завжди попередній успішно збережений стан, на випадок
// якщо основний запис пошкодиться (наприклад, вкладку закрили посеред
// запису). "-corrupted" — сюди складаємо будь-який нечитаний JSON, який
// знайшли при завантаженні, лише для можливого експорту/діагностики.
const BACKUP_KEY = `${STORAGE_KEY}-backup`;
const CORRUPTED_KEY = `${STORAGE_KEY}-corrupted`;

// Версія ФОРМАТУ збереження (не плутати з APP_VERSION у version.js).
// Піднімати лише коли міняється сама структура полів прогресу настільки,
// що старі дані треба явно перетворити (див. migrateSave нижче).
export const CURRENT_SAVE_VERSION = 1;

// Останнє попередження про відновлення/втрату збереження при завантаженні
// (не персистентне — живе лише до першого виклику takeLoadWarning()).
// Не персистимо його в самому прогресі, щоб випадково не записати в save.
let lastLoadWarning = null;

export function takeLoadWarning() {
  const w = lastLoadWarning;
  lastLoadWarning = null;
  return w;
}

// Порожній об'єкт daily на конкретну дату — використовується і для щойно
// створеного прогресу (defaultProgress), і щоразу, як настає новий день
// (ensureDaily). activeQuestIds — сьогоднішні 3 щоденні завдання, обрані
// детерміновано з QUEST_POOL (src/data/rewards.js): по одному з easy/medium/training.
function emptyDaily(date) {
  return {
    date,
    correctToday: 0,
    levelsToday: 0,
    perfectToday: false,
    memoryPairsToday: 0,
    mazeChestsToday: 0,
    mazeSecretToday: false,
    raceTop2Today: 0,
    raceBestToday: false,
    table7Today: 0,
    weakFixedToday: 0,
    claimed: [],
    activeQuestIds: pickDailyQuestIds(date ?? "unknown"),
  };
}

export function defaultProgress() {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    totalStars: 0, coins: 0, xp: 0,
    streak: { current: 0, lastPlayedDate: null },
    levels: {}, badges: [], facts: {},
    avatar: "wizard", ownedAvatars: ["wizard"],
    daily: emptyDaily(null),
    mazeCompletions: 0,
    raceCompletions: 0,
    // Перегони: історія останніх 5 заїздів (для рекомендації складності),
    // особисті рекорди на кожній складності, чи вже відкрито чемпіонський
    // заїзд (одна перемога у пригодницькому — назавжди, навіть якщо сама
    // перемога згодом "випаде" з короткої історії останніх 5), і лічильник
    // сьогоднішніх перемог у тренувальному заїзді (захист від фарму).
    raceHistory: [],
    raceBest: {},
    raceChampionUnlocked: false,
    raceDaily: { date: null, trainingWins: 0 },
  };
}

// Заповнює нові поля для прогресу, збереженого до появи магазину/квестів,
// і рахує вже обраний аватар власним, щоб він не "замкнувся" заднім числом.
function migrateProgress(p) {
  const ownedAvatars = p.ownedAvatars ?? Array.from(new Set(["wizard", p.avatar].filter(Boolean)));
  const mazeCompletions = p.mazeCompletions ?? 0;
  const raceCompletions = p.raceCompletions ?? 0;
  const raceHistory = p.raceHistory ?? [];
  const raceBest = p.raceBest ?? {};
  const raceChampionUnlocked = p.raceChampionUnlocked ?? false;
  const raceDaily = p.raceDaily ?? { date: null, trainingWins: 0 };

  // Дозаповнює нові лічильники/activeQuestIds для збереження того самого
  // дня (ensureDaily нижче скидає daily цілком лише на зміну дати, тож
  // збереження в межах поточного дня, зроблені до появи нового пулу
  // завдань, самі по собі activeQuestIds не отримають без цього).
  const dailyBase = p.daily ?? emptyDaily(null);
  const daily = {
    ...dailyBase,
    memoryPairsToday: dailyBase.memoryPairsToday ?? 0,
    mazeChestsToday: dailyBase.mazeChestsToday ?? 0,
    mazeSecretToday: dailyBase.mazeSecretToday ?? false,
    raceTop2Today: dailyBase.raceTop2Today ?? 0,
    raceBestToday: dailyBase.raceBestToday ?? false,
    table7Today: dailyBase.table7Today ?? 0,
    weakFixedToday: dailyBase.weakFixedToday ?? 0,
    activeQuestIds: dailyBase.activeQuestIds ?? pickDailyQuestIds(dailyBase.date ?? new Date().toISOString().slice(0, 10)),
  };

  return { ...p, ownedAvatars, mazeCompletions, raceCompletions, raceHistory, raceBest, raceChampionUnlocked, raceDaily, daily };
}

// Версійна міграція формату збереження (окремо від migrateProgress вище,
// яка лише дозаповнює поля, що з'явились без зміни saveVersion). Кожна
// майбутня зміна структури save додає власний "if (next.saveVersion === N)"
// крок і піднімає версію — так старі збереження ніколи не губляться мовчки.
export function migrateSave(raw) {
  let next = migrateProgress(raw);

  if (!next.saveVersion || next.saveVersion < 1) {
    // Найперші збереження (до появи saveVersion) — самі поля вже приведені
    // до ладу через migrateProgress вище, лишається проставити версію.
    next = { ...next, saveVersion: 1 };
  }

  // Приклад майбутнього кроку, коли з'явиться версія 2:
  // if (next.saveVersion === 1) {
  //   next = { ...next, /* нові/перейменовані поля */ saveVersion: 2 };
  // }

  return next;
}

export function ensureDaily(p) {
  const today = new Date().toISOString().slice(0, 10);
  if (p.daily?.date === today) return p;
  return { ...p, daily: emptyDaily(today) };
}

export function updateStreak(p) {
  const today = new Date().toISOString().slice(0, 10);
  if (p.streak.lastPlayedDate === today) return p;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const current = p.streak.lastPlayedDate === yesterday ? p.streak.current + 1 : 1;
  return { ...p, streak: { current, lastPlayedDate: today } };
}

export function heroLevelFromXp(xp) {
  let level = 1, remaining = xp ?? 0, need = 100;
  while (remaining >= need) {
    remaining -= need;
    level++;
    need = 100 + (level - 1) * 40;
  }
  return { level, into: remaining, need };
}

// Перевіряє лише СЬОГОДНІШНІ 3 активні завдання (daily.activeQuestIds) і
// одразу нараховує нагороду за щойно виконані.
export function checkQuests(p) {
  const daily = p.daily;
  const activeQuests = QUEST_POOL.filter((q) => daily.activeQuestIds?.includes(q.id));
  const newlyDone = activeQuests.filter((q) => !daily.claimed.includes(q.id) && q.progress(daily) >= q.target);
  if (!newlyDone.length) return p;
  const claimed = [...daily.claimed, ...newlyDone.map((q) => q.id)];
  const coins = p.coins + newlyDone.reduce((s, q) => s + q.reward.coins, 0);
  const xp = (p.xp ?? 0) + newlyDone.reduce((s, q) => s + q.reward.xp, 0);
  return { ...p, coins, xp, daily: { ...daily, claimed } };
}

export function starsForMistakes(mistakes) {
  if (mistakes === 0) return 3;
  if (mistakes === 1) return 2;
  return 1;
}

// undefined = ключ був, але JSON зламаний; null = ключа просто не було
// (перший запуск — це НЕ пошкодження, попереджати нема про що).
function safeParseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function finishLoad(parsed) {
  let p = migrateSave({ ...defaultProgress(), ...parsed });
  p = updateStreak(p);
  p = ensureDaily(p);
  return p;
}

// Це справжній проєкт поза Claude, тож прогрес зберігається у звичайному
// localStorage браузера — а не window.storage, який працював тільки в чаті.
//
// Порядок відновлення при пошкодженому основному записі:
// 1. Спробувати резервну копію (BACKUP_KEY) — це попередній вдалий save.
// 2. Якщо й вона нечитабельна/відсутня — почати з нуля, але зберегти
//    зіпсований JSON під CORRUPTED_KEY (не видаляти мовчки — можна буде
//    показати гравцю/автору для діагностики чи спробувати відновити вручну).
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeParseJson(raw);

    if (parsed !== null && parsed !== undefined) {
      return finishLoad(parsed);
    }

    if (parsed === undefined) {
      try {
        localStorage.setItem(CORRUPTED_KEY, raw);
      } catch {
        /* не критично — просто не буде куди зазирнути постфактум */
      }

      const backupRaw = localStorage.getItem(BACKUP_KEY);
      const backupParsed = safeParseJson(backupRaw);
      if (backupParsed !== null && backupParsed !== undefined) {
        lastLoadWarning = "recovered-from-backup";
        return finishLoad(backupParsed);
      }
      lastLoadWarning = "reset-corrupted";
    }

    return defaultProgress();
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p) {
  try {
    // Перед перезаписом основного ключа копіюємо його ПОПЕРЕДНІЙ (ще не
    // зіпсований) вміст у backup — так backup завжди на один крок позаду,
    // і зіпсований запис ніколи сам себе не перезаписує в backup.
    const prevRaw = localStorage.getItem(STORAGE_KEY);
    if (prevRaw !== null && safeParseJson(prevRaw) !== undefined) {
      localStorage.setItem(BACKUP_KEY, prevRaw);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* збереження не вдалося цього разу — гра просто продовжує роботу */
  }
}

// Викликається лише з явної дії гравця (кнопка "Експортувати прогрес") —
// зберігає весь поточний прогрес у JSON-файл, який можна покласти в
// хмару чи перенести на інший пристрій до появи серверних акаунтів.
export function exportSaveFile(p) {
  try {
    const payload = JSON.stringify(p, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kingdom-math-save-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

// Розбирає текст імпортованого файлу й повертає {ok:true, progress} або
// {ok:false, error}. Навмисно НЕ зберігає сам — виклик має явно передати
// готовий progress у saveProgress()/persist(), щоб екран міг спершу
// запитати підтвердження (імпорт перезаписує весь поточний прогрес).
export function parseImportedSave(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return { ok: false, error: "empty" };
    return { ok: true, progress: finishLoad(parsed) };
  } catch {
    return { ok: false, error: "invalid-json" };
  }
}

// ===================== Перегони: складність, історія, рекорди =====================

const CHAMPION_HERO_LEVEL = 5;

// Чемпіонський заїзд відкривається однією перемогою у пригодницькому АБО
// досягненням певного рівня героя — "raceChampionUnlocked" зберігається
// назавжди (не залежить від того, чи ця стара перемога ще лишилась у
// короткій історії останніх 5 заїздів).
export function isChampionRaceUnlocked(p) {
  return !!p.raceChampionUnlocked || heroLevelFromXp(p.xp ?? 0).level >= CHAMPION_HERO_LEVEL;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function todaysTrainingWins(p) {
  return p.raceDaily?.date === todayStr() ? (p.raceDaily.trainingWins ?? 0) : 0;
}

// Викликається одразу після нарахування нагороди за заїзд — веде історію
// (максимум 5 останніх, для рекомендації складності), фіксує особистий
// рекорд для цієї складності, назавжди відкриває чемпіонський заїзд після
// першої перемоги у пригодницькому, і рахує сьогоднішні перемоги
// тренувального заїзду (для м'якого захисту від фарму монет).
export function recordRaceResult(p, { difficulty, place, accuracy, avgResponseTime, bestStreak, gapToSecond, score }) {
  const entry = { difficulty, place, accuracy, avgResponseTime, bestStreak, gapToSecond, won: place === 1 };
  const raceHistory = [...(p.raceHistory ?? []), entry].slice(-5);

  const prevBest = p.raceBest?.[difficulty] ?? 0;
  const isPersonalBest = score > prevBest;
  const raceBest = isPersonalBest ? { ...(p.raceBest ?? {}), [difficulty]: score } : (p.raceBest ?? {});

  const raceChampionUnlocked = p.raceChampionUnlocked || (difficulty === "adventure" && place === 1);

  let raceDaily = p.raceDaily ?? { date: null, trainingWins: 0 };
  if (difficulty === "training" && place === 1) {
    const today = todayStr();
    const current = raceDaily.date === today ? raceDaily.trainingWins : 0;
    raceDaily = { date: today, trainingWins: current + 1 };
  }

  return { p: { ...p, raceHistory, raceBest, raceChampionUnlocked, raceDaily }, isPersonalBest };
}

const RACE_NEXT_DIFFICULTY = { training: "adventure", adventure: "champion" };

// Лише РЕКОМЕНДАЦІЯ — ніколи не перемикає складність примусово, лише
// підказує біля відповідної картки на екрані вибору. Права на остаточний
// вибір завжди лишається за гравцем.
export function getRaceRecommendation(raceHistory = []) {
  if (!raceHistory.length) return null;
  const recent = raceHistory.slice(-5);
  const last = recent[recent.length - 1];

  const lastTwo = recent.slice(-2);
  const confidentDouble =
    lastTwo.length === 2 &&
    lastTwo[0].difficulty === lastTwo[1].difficulty &&
    lastTwo.every((r) => r.place === 1 && r.accuracy >= 0.85 && (r.gapToSecond ?? 0) >= 15);
  if (confidentDouble) {
    const next = RACE_NEXT_DIFFICULTY[last.difficulty];
    if (next) return { type: "harder", from: last.difficulty, to: next };
  }

  const lastThree = recent.slice(-3);
  const threeLosses = lastThree.length === 3 && lastThree.every((r) => r.place !== 1);
  const lowAccuracy = last.accuracy < 0.6;
  if ((threeLosses || lowAccuracy) && last.difficulty !== "training") {
    return { type: "easier", from: last.difficulty, to: "training" };
  }

  return null;
}
