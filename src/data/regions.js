// name/title/enemy-name лишаються ЛИШЕ ключами (nameKey/titleKey) — сам
// переклад живе в src/i18n/locales/{uk,en,pl}/regions.json, щоб не мати
// два джерела правди для одного тексту. id (A-D, 1-12) — стабільний,
// використовується в progress.levels/progress-логіці й НЕ перекладається
// (розділ 11 брифу локалізації: id != назва).
export const REGIONS = [
  { id: "A", nameKey: "regionA", icon: "🌲", tint: "from-emerald-700 to-emerald-900", levels: [1, 2, 3], range: [2, 5] },
  { id: "B", nameKey: "regionB", icon: "⛰️", tint: "from-sky-700 to-indigo-900", levels: [4, 5, 6], range: [6, 9] },
  { id: "C", nameKey: "regionC", icon: "🏰", tint: "from-fuchsia-700 to-purple-950", levels: [7, 8, 9], range: [2, 9] },
  { id: "D", nameKey: "regionD", icon: "🗼", tint: "from-rose-700 to-red-950", levels: [10, 11, 12], range: [2, 9] },
];

export const LEVEL_META = {
  1: { titleKey: "level1Title", sub: "2–3", enemy: { nameKey: "level1Enemy", icon: "🐛" } },
  2: { titleKey: "level2Title", sub: "4–5", enemy: { nameKey: "level2Enemy", icon: "🦔" } },
  3: { titleKey: "level3Title", sub: "2–5", enemy: { nameKey: "level3Enemy", icon: "🐗" } },
  4: { titleKey: "level4Title", sub: "6–7", enemy: { nameKey: "level4Enemy", icon: "🦅" } },
  5: { titleKey: "level5Title", sub: "8–9", enemy: { nameKey: "level5Enemy", icon: "🐻" } },
  6: { titleKey: "level6Title", sub: "6–9", enemy: { nameKey: "level6Enemy", icon: "🧌" } },
  7: { titleKey: "level7Title", sub: "2–9", enemy: { nameKey: "level7Enemy", icon: "💂" } },
  8: { titleKey: "level8Title", sub: "?", enemy: { nameKey: "level8Enemy", icon: "🧙‍♂️" } },
  9: { titleKey: "level9Title", sub: "⚡", enemy: { nameKey: "level9Enemy", icon: "🐉" } },
  10: { titleKey: "level10Title", sub: "×, +/−", enemy: { nameKey: "level10Enemy", icon: "👻" } },
  11: { titleKey: "level11Title", sub: "×, +, −", enemy: { nameKey: "level11Enemy", icon: "🔮" } },
  12: { titleKey: "level12Title", sub: "⚠️", enemy: { nameKey: "level12Enemy", icon: "🧿" } },
};

export function isLevelUnlocked(levelId, progress) {
  if (levelId === 1) return true;
  return !!progress.levels[levelId - 1];
}
