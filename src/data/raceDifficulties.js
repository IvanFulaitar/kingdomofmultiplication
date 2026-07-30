// Три СКЛАДНОСТІ СУПЕРНИКІВ для режиму "Перегони" — гравець обирає їх сам
// на окремому екрані перед стартом заїзду (RaceDifficultyScreen.jsx).
//
// Важливо: це складність суперників/заїзду (швидкість, час на відповідь,
// гумове наздоганяння, кількість раундів, нагорода) — НЕ складність самих
// математичних прикладів. Тема прикладів завжди лишається в межах уже
// вивченого (таблиця множення 2-9); лише ФОРМА питання ускладнюється на
// чемпіонському рівні (див. questionMix + game/practice.js).
export const RACE_DIFFICULTY_ORDER = ["training", "adventure", "champion"];

export const RACE_DIFFICULTIES = {
  training: {
    id: "training",
    order: 1,
    label: "Тренувальний заїзд",
    tagline: "Легкий",
    description: "Суперники їдуть повільніше. Добре для знайомства з режимом і новою математичною темою.",
    footerNote: "Для старту",
    startLabel: "ПОЧАТИ ТРЕНУВАЛЬНИЙ ЗАЇЗД",
    theme: "training",
    icon: "shield",
    rounds: 7,
    timeLimit: 8,
    catchup: { min: -4, max: 2 }, // сповільнення до -4%, бонус наздоганяння max +2%
    questionMix: "easy",
    reward: { coins: 15, xp: 25, multiplier: 1 },
  },
  adventure: {
    id: "adventure",
    order: 2,
    label: "Пригодницький заїзд",
    tagline: "Звичайний",
    description: "Збалансований заїзд. Суперники тримають темп, а перемога залежить від швидкості й точності.",
    footerNote: "Рекомендовано",
    startLabel: "ПОЧАТИ ПРИГОДНИЦЬКИЙ ЗАЇЗД",
    theme: "adventure",
    icon: "flag",
    rounds: 7,
    timeLimit: 6,
    catchup: { min: -3, max: 4 },
    questionMix: "normal",
    reward: { coins: 25, xp: 40, multiplier: 1.5 },
  },
  champion: {
    id: "champion",
    order: 3,
    label: "Чемпіонський заїзд",
    tagline: "Складний",
    description: "Швидкі суперники, менше часу та складніші приклади. Для тих, хто готовий боротися за найбільшу нагороду.",
    footerNote: "Високий ризик",
    startLabel: "ПОЧАТИ ЧЕМПІОНСЬКИЙ ЗАЇЗД",
    theme: "champion",
    icon: "bolt",
    rounds: 9,
    timeLimit: 4,
    catchup: { min: -1, max: 3 }, // майже не сповільнюються, якщо гравець відстає
    questionMix: "hard",
    reward: { coins: 40, xp: 65, multiplier: 2, bonusChestChance: 0.25 },
    lockHint: "Переможи у пригодницькому заїзді",
  },
};

// Мінімальний рівень героя, що сам собою відкриває чемпіонський заїзд,
// навіть якщо дитина ще жодного разу не перемагала у пригодницькому.
export const CHAMPION_HERO_LEVEL_UNLOCK = 5;

export function isDifficultyUnlocked(id, { championUnlocked }) {
  if (id !== "champion") return true;
  return !!championUnlocked;
}

// --- Запам'ятовування останнього вибору (окремий localStorage-ключ,
// як і musicEnabled/sfxEnabled — не всередині великого progress-обʼєкта). ---
const RACE_DIFFICULTY_KEY = "raceDifficulty";

export function getSavedRaceDifficulty() {
  try {
    const v = localStorage.getItem(RACE_DIFFICULTY_KEY);
    return RACE_DIFFICULTIES[v] ? v : null;
  } catch {
    return null;
  }
}

export function saveRaceDifficulty(id) {
  try {
    localStorage.setItem(RACE_DIFFICULTY_KEY, id);
  } catch {
    /* не збереглось цього разу — не критично */
  }
}
