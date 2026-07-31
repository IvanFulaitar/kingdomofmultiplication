export const BADGES = [
  { id: "first_win", name: "Перша перемога", icon: "🏅", check: (p) => Object.keys(p.levels).length >= 1 },
  { id: "no_mistakes", name: "Без промахів", icon: "💎", check: (p) => Object.values(p.levels).some((l) => l.stars === 3) },
  { id: "forest_master", name: "Майстер лісу", icon: "🌳", check: (p) => [1, 2, 3].every((id) => p.levels[id]?.stars === 3) },
  { id: "mountain_master", name: "Майстер гір", icon: "🏔️", check: (p) => [4, 5, 6].every((id) => p.levels[id]?.stars === 3) },
  { id: "castle_master", name: "Майстер замку", icon: "🏯", check: (p) => [7, 8, 9].every((id) => p.levels[id]?.stars === 3) },
  { id: "sage_master", name: "Мудрець веж", icon: "🧠", check: (p) => [10, 11, 12].every((id) => p.levels[id]?.stars === 3) },
  { id: "kingdom_lord", name: "Володар королівства", icon: "👑", check: (p) => [1,2,3,4,5,6,7,8,9,10,11,12].every((id) => p.levels[id]?.stars === 3) },
  { id: "streak3", name: "3 дні поспіль", icon: "🔥", check: (p) => p.streak.current >= 3 },
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
export const QUEST_POOL = [
  // --- просто ---
  { id: "correct10", tier: "easy", label: "Дай 10 правильних відповідей", icon: "✅", target: 10, progress: (d) => d.correctToday, reward: { coins: 15, xp: 15 } },
  { id: "correct15", tier: "easy", label: "Дай 15 правильних відповідей", icon: "✅", target: 15, progress: (d) => d.correctToday, reward: { coins: 20, xp: 20 } },
  { id: "levels1", tier: "easy", label: "Пройди 1 рівень", icon: "⚔️", target: 1, progress: (d) => d.levelsToday, reward: { coins: 10, xp: 10 } },
  { id: "levels2", tier: "easy", label: "Пройди 2 рівні", icon: "⚔️", target: 2, progress: (d) => d.levelsToday, reward: { coins: 20, xp: 20 } },
  { id: "memoryPairs2", tier: "easy", label: "Знайди 2 пари у «Математичній пам'яті»", icon: "🧠", target: 2, progress: (d) => d.memoryPairsToday ?? 0, reward: { coins: 15, xp: 15 } },

  // --- середньо ---
  { id: "perfect1", tier: "medium", label: "Пройди рівень без жодної помилки", icon: "💯", target: 1, progress: (d) => (d.perfectToday ? 1 : 0), reward: { coins: 15, xp: 15 } },
  { id: "levels3", tier: "medium", label: "Заверши 3 рівні", icon: "⚔️", target: 3, progress: (d) => d.levelsToday, reward: { coins: 25, xp: 25 } },
  { id: "correct25", tier: "medium", label: "Дай 25 правильних відповідей", icon: "✅", target: 25, progress: (d) => d.correctToday, reward: { coins: 30, xp: 30 } },
  { id: "weakFixed3", tier: "medium", label: "Виправ 3 слабкі приклади", icon: "🎯", target: 3, progress: (d) => d.weakFixedToday ?? 0, reward: { coins: 25, xp: 30 } },
  { id: "table7x5", tier: "medium", label: "Дай 5 правильних відповідей із таблицею на 7", icon: "7️⃣", target: 5, progress: (d) => d.table7Today ?? 0, reward: { coins: 20, xp: 25 } },

  // --- пов'язано з тренуванням ---
  { id: "memoryPairs3", tier: "training", label: "Знайди 3 пари у «Математичній пам'яті»", icon: "🧠", target: 3, progress: (d) => d.memoryPairsToday ?? 0, reward: { coins: 20, xp: 20 } },
  { id: "mazeChest1", tier: "training", label: "Відкрий скриню в лабіринті", icon: "🎁", target: 1, progress: (d) => d.mazeChestsToday ?? 0, reward: { coins: 20, xp: 20 } },
  { id: "mazeSecret1", tier: "training", label: "Знайди таємний шлях у лабіринті", icon: "🗝️", target: 1, progress: (d) => (d.mazeSecretToday ? 1 : 0), reward: { coins: 25, xp: 25 } },
  { id: "raceTop2_1", tier: "training", label: "Посідай перше або друге місце в перегонах", icon: "🏁", target: 1, progress: (d) => d.raceTop2Today ?? 0, reward: { coins: 20, xp: 20 } },
  { id: "raceBest1", tier: "training", label: "Покращ свій особистий рекорд у перегонах", icon: "🚀", target: 1, progress: (d) => (d.raceBestToday ? 1 : 0), reward: { coins: 25, xp: 25 } },
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
