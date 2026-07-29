import { QUESTS } from "../data/rewards.js";

export const STORAGE_KEY = "kingdom-multiplication-progress";

export function defaultProgress() {
  return {
    totalStars: 0, coins: 0, xp: 0,
    streak: { current: 0, lastPlayedDate: null },
    levels: {}, badges: [], facts: {},
    avatar: "wizard", ownedAvatars: ["wizard"],
    daily: { date: null, correctToday: 0, levelsToday: 0, perfectToday: false, claimed: [] },
  };
}

// Заповнює нові поля для прогресу, збереженого до появи магазину/квестів,
// і рахує вже обраний аватар власним, щоб він не "замкнувся" заднім числом.
function migrateProgress(p) {
  const ownedAvatars = p.ownedAvatars ?? Array.from(new Set(["wizard", p.avatar].filter(Boolean)));
  return { ...p, ownedAvatars };
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
