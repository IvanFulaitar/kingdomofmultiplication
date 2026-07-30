import { QUESTS } from "../data/rewards.js";

export const STORAGE_KEY = "kingdom-multiplication-progress";

export function defaultProgress() {
  return {
    totalStars: 0, coins: 0, xp: 0,
    streak: { current: 0, lastPlayedDate: null },
    levels: {}, badges: [], facts: {},
    avatar: "wizard", ownedAvatars: ["wizard"],
    daily: { date: null, correctToday: 0, levelsToday: 0, perfectToday: false, claimed: [] },
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
  return { ...p, ownedAvatars, mazeCompletions, raceCompletions, raceHistory, raceBest, raceChampionUnlocked, raceDaily };
}

export function ensureDaily(p) {
  const today = new Date().toISOString().slice(0, 10);
  if (p.daily?.date === today) return p;
  return { ...p, daily: { date: today, correctToday: 0, levelsToday: 0, perfectToday: false, claimed: [] } };
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

// Перевіряє, чи щойно виконано якесь щоденне завдання, і одразу нараховує нагороду.
export function checkQuests(p) {
  const daily = p.daily;
  const newlyDone = QUESTS.filter((q) => !daily.claimed.includes(q.id) && q.progress(daily) >= q.target);
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

// Це справжній проєкт поза Claude, тож прогрес зберігається у звичайному
// localStorage браузера — а не window.storage, який працював тільки в чаті.
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let p = raw ? migrateProgress({ ...defaultProgress(), ...JSON.parse(raw) }) : defaultProgress();
    p = updateStreak(p);
    p = ensureDaily(p);
    return p;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* збереження не вдалося цього разу — гра просто продовжує роботу */
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
