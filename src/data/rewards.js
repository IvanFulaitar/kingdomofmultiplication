import { tableMastery, overallMastery } from "../game/mastery.js";
import { AVATARS } from "./cosmetics.js";

// name -> nameKey (achievements.json, src/i18n/locales/) — id лишається
// стабільним (зберігається в progress.badges), не перекладається.
//
// launch-plan.md, розділ 21 "Досягнення також потрібно розширити" — до
// початкових 8 додано ще 15 у чотирьох категоріях (Навчання/Пригоди/
// Наполегливість/Колекція). Жодне нове досягнення не дає монет/XP (як і
// жодне зі старих 8) — лише іконка-престиж у BadgesModal.jsx; система
// рамок/титулів/ефектів із плану ще не існує (лише аватари в магазині),
// тож "не всі досягнення повинні давати монети" тут виконано найпростіше
// можливим способом — усі є суто декоративними.
export const BADGES = [
  { id: "first_win", nameKey: "firstWin", icon: "🏅", check: (p) => Object.keys(p.levels).length >= 1 },
  { id: "no_mistakes", nameKey: "noMistakes", icon: "💎", check: (p) => Object.values(p.levels).some((l) => l.stars === 3) },
  { id: "forest_master", nameKey: "forestMaster", icon: "🌳", check: (p) => [1, 2, 3].every((id) => p.levels[id]?.stars === 3) },
  { id: "mountain_master", nameKey: "mountainMaster", icon: "🏔️", check: (p) => [4, 5, 6].every((id) => p.levels[id]?.stars === 3) },
  { id: "castle_master", nameKey: "castleMaster", icon: "🏯", check: (p) => [7, 8, 9].every((id) => p.levels[id]?.stars === 3) },
  { id: "sage_master", nameKey: "sageMaster", icon: "🧠", check: (p) => [10, 11, 12].every((id) => p.levels[id]?.stars === 3) },
  { id: "kingdom_lord", nameKey: "kingdomLord", icon: "👑", check: (p) => [1,2,3,4,5,6,7,8,9,10,11,12].every((id) => p.levels[id]?.stars === 3) },
  { id: "streak3", nameKey: "streak3", icon: "🔥", check: (p) => p.streak.current >= 3 },

  // --- Навчання ---
  { id: "correct100", nameKey: "correct100", icon: "📘", check: (p) => Object.values(p.facts ?? {}).reduce((s, f) => s + (f.correct ?? 0), 0) >= 100 },
  { id: "correct500", nameKey: "correct500", icon: "📚", check: (p) => Object.values(p.facts ?? {}).reduce((s, f) => s + (f.correct ?? 0), 0) >= 500 },
  { id: "table7_master", nameKey: "table7Master", icon: "7️⃣", check: (p) => tableMastery(p.facts ?? {}, 7).tier === "master" },
  // "понад 80% mastery" = тіер "good" (score>=80) або "master" (score>=95) для КОЖНОЇ з 8 таблиць.
  { id: "all_tables_good", nameKey: "allTablesGood", icon: "🌟", check: (p) => overallMastery(p.facts ?? {}).tables.every((t) => t.tier === "good" || t.tier === "master") },
  // Глобальна серія відповідей поспіль (App.jsx:recordFact -> answerStreak/bestAnswerStreak) —
  // НЕ те саме, що per-fact correctStreak у facts[pair] (mastery.js).
  { id: "streak20", nameKey: "streak20", icon: "⚡", check: (p) => (p.bestAnswerStreak ?? 0) >= 20 },

  // --- Пригоди ---
  { id: "chests10", nameKey: "chests10", icon: "🎁", check: (p) => (p.totalChestsOpened ?? 0) >= 10 },
  { id: "secrets5", nameKey: "secrets5", icon: "🗝️", check: (p) => (p.totalSecretsFound ?? 0) >= 5 },
  { id: "race_wins10", nameKey: "raceWins10", icon: "🏁", check: (p) => (p.totalRaceWins ?? 0) >= 10 },
  { id: "champion_win", nameKey: "championWin", icon: "🏆", check: (p) => p.championRaceWon === true },

  // --- Наполегливість ---
  { id: "comeback", nameKey: "comeback", icon: "💪", check: (p) => p.hadComeback === true },
  { id: "streak7days", nameKey: "streak7days", icon: "📅", check: (p) => (p.streak?.current ?? 0) >= 7 },
  // Наближення "навчальних сесій" без нового лічильника: унікальні пройдені
  // рівні (макс 12) + усі проходження лабіринту/перегонів (обидва рахують
  // і повтори, mazeCompletions/raceCompletions уже інкрементуються щоразу
  // незалежно від того, чи це перший прохід). "Пам'ять" сюди не входить —
  // для неї немає окремого лічильника проходжень.
  { id: "sessions30", nameKey: "sessions30", icon: "⏳", check: (p) => Object.keys(p.levels ?? {}).length + (p.mazeCompletions ?? 0) + (p.raceCompletions ?? 0) >= 30 },

  // --- Колекція ---
  { id: "first_avatar_bought", nameKey: "firstAvatarBought", icon: "🛍️", check: (p) => (p.ownedAvatars ?? []).length >= 2 },
  { id: "avatars5", nameKey: "avatars5", icon: "🎭", check: (p) => (p.ownedAvatars ?? []).length >= 5 },
  { id: "all_avatars", nameKey: "allAvatars", icon: "🎨", check: (p) => (p.ownedAvatars ?? []).length >= AVATARS.length },
];

// Щоденні завдання: пул варіантів (launch-plan.md, розділ 20), з якого щодня
// автоматично береться по одному з кожного рівня складності — "easy"
// (просте), "medium" (середнє) і "training" (пов'язане з тренуванням), щоб
// гравець щодня бачив 3 нових, різних завдання, а не одні й ті самі три.
//
// Два пункти з оригінального списку в launch-plan.md ("Переможи без
// підказки", "Виконай 10 прикладів менше ніж за 4 секунди") поки
// пропущені — у грі немає системи підказок і немає обліку часу відповіді
// поза режимом "Перегони"; додати їх можна, коли з'явиться відповідна
// інфраструктура.
// label -> labelKey (quests.json, src/i18n/locales/) — id лишається
// стабільним (progress.daily.activeQuestIds/claimed), не перекладається.
export const QUEST_POOL = [
  // --- просто ---
  { id: "correct10", tier: "easy", labelKey: "correct10", icon: "✅", target: 10, progress: (d) => d.correctToday, reward: { coins: 15, xp: 15 } },
  { id: "correct15", tier: "easy", labelKey: "correct15", icon: "✅", target: 15, progress: (d) => d.correctToday, reward: { coins: 20, xp: 20 } },
  { id: "levels1", tier: "easy", labelKey: "levels1", icon: "⚔️", target: 1, progress: (d) => d.levelsToday, reward: { coins: 10, xp: 10 } },
  { id: "levels2", tier: "easy", labelKey: "levels2", icon: "⚔️", target: 2, progress: (d) => d.levelsToday, reward: { coins: 20, xp: 20 } },
  { id: "memoryPairs2", tier: "easy", labelKey: "memoryPairs2", icon: "🧠", target: 2, progress: (d) => d.memoryPairsToday ?? 0, reward: { coins: 15, xp: 15 } },

  // --- середньо ---
  { id: "perfect1", tier: "medium", labelKey: "perfect1", icon: "💯", target: 1, progress: (d) => (d.perfectToday ? 1 : 0), reward: { coins: 15, xp: 15 } },
  { id: "levels3", tier: "medium", labelKey: "levels3", icon: "⚔️", target: 3, progress: (d) => d.levelsToday, reward: { coins: 25, xp: 25 } },
  { id: "correct25", tier: "medium", labelKey: "correct25", icon: "✅", target: 25, progress: (d) => d.correctToday, reward: { coins: 30, xp: 30 } },
  { id: "weakFixed3", tier: "medium", labelKey: "weakFixed3", icon: "🎯", target: 3, progress: (d) => d.weakFixedToday ?? 0, reward: { coins: 25, xp: 30 } },
  { id: "table7x5", tier: "medium", labelKey: "table7x5", icon: "7️⃣", target: 5, progress: (d) => d.table7Today ?? 0, reward: { coins: 20, xp: 25 } },

  // --- пов'язано з тренуванням ---
  { id: "memoryPairs3", tier: "training", labelKey: "memoryPairs3", icon: "🧠", target: 3, progress: (d) => d.memoryPairsToday ?? 0, reward: { coins: 20, xp: 20 } },
  { id: "mazeChest1", tier: "training", labelKey: "mazeChest1", icon: "🎁", target: 1, progress: (d) => d.mazeChestsToday ?? 0, reward: { coins: 20, xp: 20 } },
  { id: "mazeSecret1", tier: "training", labelKey: "mazeSecret1", icon: "🗝️", target: 1, progress: (d) => (d.mazeSecretToday ? 1 : 0), reward: { coins: 25, xp: 25 } },
  { id: "raceTop2_1", tier: "training", labelKey: "raceTop2_1", icon: "🏁", target: 1, progress: (d) => d.raceTop2Today ?? 0, reward: { coins: 20, xp: 20 } },
  { id: "raceBest1", tier: "training", labelKey: "raceBest1", icon: "🚀", target: 1, progress: (d) => (d.raceBestToday ? 1 : 0), reward: { coins: 25, xp: 25 } },
];

// Стабільний "випадковий" вибір без Math.random(): той самий dateStr завжди
// дає той самий набір (не змінюється при перезавантаженні сторінки того ж
// дня), але інший dateStr (завтра) — інший набір.
function hashDateStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed) {
  let state = seed;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Повертає 3 id — по одному з "easy"/"medium"/"training" — детерміновано
// відносно dateStr (формат YYYY-MM-DD), як гарантує launch-plan.md: "одне
// просте; одне середнє; одне пов'язане з тренуванням".
export function pickDailyQuestIds(dateStr) {
  const rand = mulberry32(hashDateStr(dateStr));
  const pick = (tier) => {
    const bucket = QUEST_POOL.filter((q) => q.tier === tier);
    return bucket[Math.floor(rand() * bucket.length)].id;
  };
  return [pick("easy"), pick("medium"), pick("training")];
}
