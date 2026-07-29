export const REGIONS = [
  { id: "A", name: "Ліс Новачків", icon: "🌲", tint: "from-emerald-700 to-emerald-900", levels: [1, 2, 3], range: [2, 5] },
  { id: "B", name: "Гори Хоробрих", icon: "⛰️", tint: "from-sky-700 to-indigo-900", levels: [4, 5, 6], range: [6, 9] },
  { id: "C", name: "Замок Майстра", icon: "🏰", tint: "from-fuchsia-700 to-purple-950", levels: [7, 8, 9], range: [2, 9] },
  { id: "D", name: "Вежа Мудреця", icon: "🗼", tint: "from-rose-700 to-red-950", levels: [10, 11, 12], range: [2, 9] },
];

export const LEVEL_META = {
  1: { title: "Перші кроки", sub: "2–3", enemy: { name: "Лісовий хробак", icon: "🐛" } },
  2: { title: "Стежка гнома", sub: "4–5", enemy: { name: "Їжак-бешкетник", icon: "🦔" } },
  3: { title: "Брама лісу", sub: "2–5", enemy: { name: "Вепр-охоронець", icon: "🐗" } },
  4: { title: "Кам'яний шлях", sub: "6–7", enemy: { name: "Гірський яструб", icon: "🦅" } },
  5: { title: "Крижаний перевал", sub: "8–9", enemy: { name: "Крижаний ведмідь", icon: "🐻" } },
  6: { title: "Вершина", sub: "6–9", enemy: { name: "Тролль вершини", icon: "🧌" } },
  7: { title: "Тронна зала", sub: "2–9", enemy: { name: "Вартовий замку", icon: "💂" } },
  8: { title: "Загадка мага", sub: "?", enemy: { name: "Підступний маг", icon: "🧙‍♂️" } },
  9: { title: "Іспит майстра", sub: "⚡", enemy: { name: "Дракон-охоронець", icon: "🐉" } },
  10: { title: "Подвійна дія", sub: "×, +/−", enemy: { name: "Привид вежі", icon: "👻" } },
  11: { title: "Ланцюжок дій", sub: "×, +, −", enemy: { name: "Оракул", icon: "🔮" } },
  12: { title: "Пастка мудреця", sub: "⚠️", enemy: { name: "Хранитель пастки", icon: "🧿" } },
};

export function isLevelUnlocked(levelId, progress) {
  if (levelId === 1) return true;
  return !!progress.levels[levelId - 1];
}
