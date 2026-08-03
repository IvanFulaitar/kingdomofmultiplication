// name -> nameKey (achievements.json, src/i18n/locales/) — id лишається
// стабільним (зберігається в progress.badges), не перекладається.
export const BADGES = [
  { id: "first_win", nameKey: "firstWin", icon: "🏅", check: (p) => Object.keys(p.levels).length >= 1 },
  { id: "no_mistakes", nameKey: "noMistakes", icon: "💎", check: (p) => Object.values(p.levels).some((l) => l.stars === 3) },
  { id: "forest_master", nameKey: "forestMaster", icon: "🌳", check: (p) => [1, 2, 3].every((id) => p.levels[id]?.stars === 3) },
  { id: "mountain_master", nameKey: "mountainMaster", icon: "🏔️", check: (p) => [4, 5, 6].every((id) => p.levels[id]?.stars === 3) },
  { id: "castle_master", nameKey: "castleMaster", icon: "🏯", check: (p) => [7, 8, 9].every((id) => p.levels[id]?.stars === 3) },
  { id: "sage_master", nameKey: "sageMaster", icon: "🧠", check: (p) => [10, 11, 12].every((id) => p.levels[id]?.stars === 3) },
  { id: "kingdom_lord", nameKey: "kingdomLord", icon: "👑", check: (p) => [1,2,3,4,5,6,7,8,9,10,11,12].every((id) => p.levels[id]?.stars === 3) },
  { id: "streak3", nameKey: "streak3", icon: "🔥", check: (p) => p.streak.current >= 3 },
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
