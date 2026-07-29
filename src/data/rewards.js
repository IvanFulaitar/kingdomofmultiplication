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

// Щоденні завдання: фіксовані цілі, скидаються щодня, винагорода — монети + XP.
export const QUESTS = [
  { id: "correct15", label: "Дай 15 правильних відповідей", icon: "✅", target: 15, progress: (d) => d.correctToday, reward: { coins: 20, xp: 20 } },
  { id: "perfect1", label: "Пройди рівень без жодної помилки", icon: "💯", target: 1, progress: (d) => (d.perfectToday ? 1 : 0), reward: { coins: 15, xp: 15 } },
  { id: "levels3", label: "Заверши 3 рівні", icon: "⚔️", target: 3, progress: (d) => d.levelsToday, reward: { coins: 25, xp: 25 } },
];
