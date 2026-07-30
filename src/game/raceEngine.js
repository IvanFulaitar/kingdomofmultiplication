import { rand } from "./random.js";

// ---------------------------------------------------------------------
// Балансова "фізика" режиму "Перегони" — чиста логіка без React, щоб її
// можна було прогнати й перевірити числами окремо від інтерфейсу.
//
// Головний принцип: прогрес гравця залежить ЛИШЕ від точності й швидкості
// його відповідей і ніколи не забирається за помилку. Суперники мають
// м'яке ("гумове") наздоганяння — воно трохи звужує чи розширює розрив,
// але ніколи не вирішує перегони саме собою: якщо дитина відповідає
// швидко й правильно, перевага зберігається.
// ---------------------------------------------------------------------

export const MAX_ROUNDS = 7;
export const TIME_LIMIT = 6;
export const FINISH = 100;
const MIN_OPPONENT_GAIN = 3;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Складність росте з кількістю вже пройдених перегонів (як і в "Лабіринті"),
// але обирається ОДИН РАЗ на старті заїзду — усередині одного забігу вона
// ніколи не змінюється різко.
export function tierForCompletions(n = 0) {
  if (n >= 6) return "hard";
  if (n >= 2) return "normal";
  return "easy";
}

export const TIER_LABEL = { easy: "Легкий заїзд", normal: "Звичайний заїзд", hard: "Складний заїзд" };

// Межі "гумового" бонусу — звужуються на складному рівні (щоб виклик
// лишався чесним, а не штучним) і слабшають на легкому.
const CATCHUP_BOUNDS = {
  easy: { min: -2, max: 2 },
  normal: { min: -3, max: 4 },
  hard: { min: -3, max: 3 },
};

// --- Прогрес гравця -----------------------------------------------------

// Три швидкісні пороги в межах TIME_LIMIT (6 c) — приблизно по 2 секунди
// кожен: дуже швидко / нормально / повільно.
export function speedTierFor(timeLeft, timeLimit = TIME_LIMIT) {
  if (timeLeft >= (timeLimit * 2) / 3) return "veryFast";
  if (timeLeft >= timeLimit / 3) return "normal";
  return "slow";
}

const PLAYER_GAIN_BY_SPEED = {
  veryFast: [20, 22],
  normal: [16, 18],
  slow: [12, 14],
};

export function playerBaseGain(speedTier) {
  const [lo, hi] = PLAYER_GAIN_BY_SPEED[speedTier];
  return rand(lo, hi);
}

// 2 поспіль = +1%, 3 поспіль = +2%, 4 і більше = максимум +3%.
// streakAfter — довжина серії ПІСЛЯ цієї правильної відповіді.
export function streakBonus(streakAfter) {
  if (streakAfter >= 4) return 3;
  if (streakAfter === 3) return 2;
  if (streakAfter === 2) return 1;
  return 0;
}

// --- Прогрес суперників ---------------------------------------------------

// opponentGain = baseGain (власний діапазон рівня) + randomVariation(-2..2)
// + catchUpBonus, де
// catchUpBonus = clamp((playerProgress - opponentProgress) × 0.12, tierMin, tierMax).
// Гравець ніколи не бачить цих чисел — ззовні це має виглядати просто як
// "природний" темп суперника, не як технічний механізм.
export function opponentGain({ tierConfig, tier, playerProgress, opponentProgress, isFinalStretch }) {
  const [lo, hi] = tierConfig.base;
  let gain = rand(lo, hi);
  gain += rand(-2, 2); // невелика випадковість, щоб заїзди не повторювались однаково

  if (tierConfig.weakChance && Math.random() < tierConfig.weakChance) {
    const [pLo, pHi] = tierConfig.weakPenalty;
    gain -= rand(pLo, pHi);
  }

  const gap = playerProgress - opponentProgress;
  const bounds = CATCHUP_BOUNDS[tier];
  gain += clamp(Math.round(gap * 0.12), bounds.min, bounds.max);

  if (isFinalStretch) gain += rand(0, 1); // останні 2 раунди: максимум +1 додатково

  return Math.max(MIN_OPPONENT_GAIN, Math.round(gain));
}

// --- Події перегонів ------------------------------------------------------

export const RACE_EVENTS = {
  boost: { id: "boost", label: "Прискорення!", desc: "Швидка відповідь дає ще більше проргесу", icon: "⚡" },
  turn: { id: "turn", label: "Крутий поворот!", desc: "Цього разу всі трохи сповільнюються", icon: "🌀" },
  star: { id: "star", label: "Золота зірка!", desc: "Правильна відповідь дасть монету", icon: "⭐" },
  dash: { id: "dash", label: "Фінішний ривок!", desc: "Останній приклад — з бонусом", icon: "🏆" },
  slippery: { id: "slippery", label: "Слизька ділянка!", desc: "Помилка не забере прогрес", icon: "❄️" },
};

const RANDOM_EVENT_IDS = ["boost", "turn", "star", "slippery"];
const RANDOM_EVENT_CHANCE = 0.45;

// Один випадковий (або жодного) на раунд. Перший раунд завжди спокійний —
// щоб дитина спершу відчула базову гру без додаткових умов. Останній раунд
// завжди "Фінішний ривок" (сама природа події прив'язана до фінішу).
export function pickRaceEvent(roundIndex, maxRounds = MAX_ROUNDS) {
  if (roundIndex === 0) return null;
  if (roundIndex === maxRounds - 1) return RACE_EVENTS.dash;
  if (Math.random() < RANDOM_EVENT_CHANCE) {
    return RACE_EVENTS[RANDOM_EVENT_IDS[rand(0, RANDOM_EVENT_IDS.length - 1)]];
  }
  return null;
}

// --- Підсумки та зірки ------------------------------------------------

// Порівнюємо "фактичний" (не обрізаний на 100%) прогрес — так коректно
// вирішується випадок, коли кілька учасників перетнули фініш в один і
// той самий раунд: перемагає той, хто фактично пробіг далі, а не той,
// кого просто першим намалював інтерфейс. Час останньої відповіді —
// детермінований запасний критерій на випадок точної рівності.
export function rankParticipants(entries) {
  return [...entries].sort((a, b) => {
    if (b.rawProgress !== a.rawProgress) return b.rawProgress - a.rawProgress;
    return a.lastAnswerTime - b.lastAnswerTime;
  });
}

// Живий (проміжний) розподіл місць під час гонки — для бейджів "1/2/3"
// біля кожної доріжки, що оновлюються щоразу після раунду. На відміну від
// rankParticipants, тут не потрібен розбір нічиєї за часом — це лише для
// відображення "хто зараз попереду", не для визначення фінального переможця.
export function liveStandings(positions) {
  const order = Object.keys(positions).sort((a, b) => positions[b] - positions[a]);
  const place = {};
  order.forEach((id, i) => { place[id] = i + 1; });
  return place;
}

export function starsForRace({ place, accuracy, missedCount }) {
  if (place !== 1) return 1; // перша зірка — за сам факт участі до фінішу
  if (accuracy >= 0.85 || missedCount === 0) return 3;
  return 2;
}
