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

// FINISH лишається фіксованим "довжиною траси" незалежно від складності —
// довшу/коротшу гонку дають не інші фінішні 100%, а інша кількість раундів
// і інший приріст за раунд (обидва тепер задаються в data/raceDifficulties.js).
export const FINISH = 100;
const MIN_OPPONENT_GAIN = 3;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Складність тепер обирає сам гравець на окремому екрані (RaceDifficultyScreen)
// — раніше вона підвищувалась автоматично від кількості пройдених заїздів,
// але це робило гру передбачуваною й не давало дитині керувати викликом.
// Три складності: "training" (Тренувальний), "adventure" (Пригодницький),
// "champion" (Чемпіонський) — повний опис кожної в data/raceDifficulties.js.
export const TIER_LABEL = {
  training: "Тренувальний заїзд",
  adventure: "Пригодницький заїзд",
  champion: "Чемпіонський заїзд",
};

// --- Прогрес гравця -----------------------------------------------------

// Три швидкісні пороги в межах ліміту часу конкретної складності (значення
// timeLimit тепер завжди приходить із data/raceDifficulties.js) — трасса
// ділиться на три рівні відрізки: дуже швидко / нормально / повільно.
export function speedTierFor(timeLeft, timeLimit = 6) {
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
// catchUpBonus = clamp((playerProgress - opponentProgress) × 0.12, catchupBounds.min, catchupBounds.max).
// catchupBounds приходить прямо з обраної складності (data/raceDifficulties.js
// -> cfg.catchup) — єдине джерело правди для меж "гумового" наздоганяння,
// без дублювання в двох файлах. Гравець ніколи не бачить цих чисел — ззовні
// це має виглядати просто як "природний" темп суперника, не як механізм.
export function opponentGain({ tierConfig, catchupBounds, playerProgress, opponentProgress, isFinalStretch }) {
  const [lo, hi] = tierConfig.base;
  let gain = rand(lo, hi);
  gain += rand(-2, 2); // невелика випадковість, щоб заїзди не повторювались однаково

  if (tierConfig.weakChance && Math.random() < tierConfig.weakChance) {
    const [pLo, pHi] = tierConfig.weakPenalty;
    gain -= rand(pLo, pHi);
  }

  const gap = playerProgress - opponentProgress;
  gain += clamp(Math.round(gap * 0.12), catchupBounds.min, catchupBounds.max);

  if (isFinalStretch) gain += rand(0, 1); // останні 2 раунди: максимум +1 додатково

  return Math.max(MIN_OPPONENT_GAIN, Math.round(gain));
}

// --- Події перегонів ------------------------------------------------------

// labelKey/descKey замість готового тексту (race.json, src/i18n/locales/) —
// цей об'єкт обчислюється один раз при завантаженні модуля, тож
// "заморожений" перекладений текст не реагував би на зміну мови пізніше
// (той самий принцип, що й у mastery.js/regions.js). Переклад відбувається
// в RaceScreen.jsx у точці показу.
export const RACE_EVENTS = {
  boost: { id: "boost", labelKey: "eventBoostLabel", descKey: "eventBoostDesc", icon: "⚡" },
  turn: { id: "turn", labelKey: "eventTurnLabel", descKey: "eventTurnDesc", icon: "🌀" },
  star: { id: "star", labelKey: "eventStarLabel", descKey: "eventStarDesc", icon: "⭐" },
  dash: { id: "dash", labelKey: "eventDashLabel", descKey: "eventDashDesc", icon: "🏆" },
  slippery: { id: "slippery", labelKey: "eventSlipperyLabel", descKey: "eventSlipperyDesc", icon: "❄️" },
};

const RANDOM_EVENT_IDS = ["boost", "turn", "star", "slippery"];
const RANDOM_EVENT_CHANCE = 0.45;

// Один випадковий (або жодного) на раунд. Перший раунд завжди спокійний —
// щоб дитина спершу відчула базову гру без додаткових умов. Останній раунд
// завжди "Фінішний ривок" (сама природа події прив'язана до фінішу).
export function pickRaceEvent(roundIndex, maxRounds = 7) {
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

// Зірки прямо прив'язані до зайнятого місця (просто й зрозуміло дитині):
// 1 місце = 3, 2 місце = 2, 3 місце = 1. Виняток — зовсім слабкий результат
// на 3-му місці (дуже низька точність): 0 зірок, але текст/тон екрана все
// одно лишається теплим і мотивуючим, не караючим.
export function starsForRace({ place, accuracy }) {
  if (place === 1) return 3;
  if (place === 2) return 2;
  if (accuracy < 0.25) return 0;
  return 1;
}

// Ключі (race.json) замість готового тексту — з тієї ж причини, що й
// RACE_EVENTS вище.
export const PLACE_HEADLINE_KEY = {
  1: "placeHeadline1",
  2: "placeHeadline2",
  3: "placeHeadline3",
};

// Емоційна фраза під підсумком місця — завжди тепла, ніколи не карає за
// програш (лише м'яко підбадьорює спробувати ще раз). `t` передається з
// компонента (RaceScreen.jsx), бо ця функція викликається під час рендера.
export function raceMoodPhrase(t, { place, accuracy }) {
  if (place === 1) return accuracy >= 0.85 ? t("race:moodGreat") : t("race:moodGood");
  if (place === 2) return t("race:moodGood");
  return t("race:moodTryAgain");
}

// Контекстна підказка на екрані результату (розділ "UX-покращення" брифу).
// Лише порада — ніколи не перемикає складність примусово, гравець завжди
// обирає сам на наступному екрані вибору.
export function raceResultHint(t, { place, accuracy, difficulty }) {
  if (place === 1 && accuracy >= 0.85 && difficulty !== "champion") {
    return t("race:hintHarder");
  }
  if (place !== 1) {
    if (accuracy < 0.5 && difficulty !== "training") return t("race:hintEasier");
    return t("race:hintRetry");
  }
  return null;
}

// --- Нагорода за заїзд ---------------------------------------------------
//
// "Базова нагорода" картки складності (напр. 40 монет/65 XP на чемпіонському)
// — це вже ПОВНА нагорода за 1 місце З урахуванням множника складності
// (base * multiplier). У розбивці на екрані результату показуємо це двома
// рядками — "Базова нагорода" (base) і "Бонус складності ×M" (base*(M-1)) —
// саме так, як просив бриф у прикладі "20 + бонус ×2: +20 = 40".
// Місце змінює вже цю повну суму (100%/65%/35%), а бонуси за точність/серію/
// рекорд додаються зверху, без знижки за місце.
const PLACE_FACTOR = { 1: 1, 2: 0.65, 3: 0.35 };
const PERFECT_ACCURACY_COIN_BONUS = 5;
const FLAWLESS_XP_BONUS = 10;
const PERSONAL_BEST_COIN_BONUS = 5;

export function computeRaceReward({
  reward, // { coins, xp, multiplier, bonusChestChance }
  place,
  accuracy,
  flawless, // жодної помилки й жодного тайм-ауту за весь заїзд
  isPersonalBest,
  trainingWinsToday = 0, // скільки ПОВНИХ перемог тренувального заїзду вже було сьогодні (до цієї)
  isTraining = false,
}) {
  const placeFactor = PLACE_FACTOR[place] ?? 0.35;

  const difficultyCoinBonus = Math.round(reward.coins * (reward.multiplier - 1));
  const difficultyXpBonus = Math.round(reward.xp * (reward.multiplier - 1));

  const fullCoins = reward.coins + difficultyCoinBonus; // = base * multiplier
  const fullXp = reward.xp + difficultyXpBonus;

  let placedCoins = Math.round(fullCoins * placeFactor);
  const placedXp = Math.round(fullXp * placeFactor);

  // Захист від фарму: перші 3 перемоги тренувального заїзду на день дають
  // повну нагороду монетами, далі — трохи менше (XP не зменшується, і
  // складніші заїзди завжди вигідніші — обмеження навмисно м'яке).
  let farmReduced = false;
  if (isTraining && place === 1 && trainingWinsToday >= 3) {
    placedCoins = Math.round(placedCoins * 0.6);
    farmReduced = true;
  }

  const accuracyBonusCoins = accuracy >= 0.999 ? PERFECT_ACCURACY_COIN_BONUS : 0;
  const flawlessBonusXp = flawless ? FLAWLESS_XP_BONUS : 0;
  const personalBestBonusCoins = isPersonalBest ? PERSONAL_BEST_COIN_BONUS : 0;

  const totalCoins = Math.max(1, placedCoins + accuracyBonusCoins + personalBestBonusCoins);
  const totalXp = Math.max(1, placedXp + flawlessBonusXp);

  return {
    baseCoins: reward.coins,
    baseXp: reward.xp,
    multiplier: reward.multiplier,
    difficultyCoinBonus,
    difficultyXpBonus,
    placeFactor,
    placedCoins,
    placedXp,
    accuracyBonusCoins,
    flawlessBonusXp,
    personalBestBonusCoins,
    farmReduced,
    totalCoins,
    totalXp,
  };
}

// "Особистий рекорд" для складності — проста композитна оцінка, що
// монотонно зростає з кращим місцем, вищою точністю й швидшою середньою
// відповіддю. Не показується гравцю напряму, лише порівнюється з
// попереднім найкращим результатом на цій самій складності.
export function raceScoreFor({ place, accuracy, avgResponseTime, timeLimit }) {
  const placeScore = place === 1 ? 300 : place === 2 ? 180 : 60;
  const accScore = Math.round(accuracy * 100);
  const speedScore = Math.max(0, Math.round((timeLimit - avgResponseTime) * 10));
  return placeScore + accScore + speedScore;
}
