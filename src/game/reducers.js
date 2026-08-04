// Чисті функції-редьюсери гри: (progress, payload) => наступний progress
// (або невеликий об'єкт-результат, коли виклику потрібно повернути ще й
// побічну інформацію на кшталт нововідкритих бейджів).
//
// Винесено з App.jsx (roles-and-architecture-plan.md, розділ 22.3 і
// розділ 40, крок 1 послідовності реалізації) — перший, "непомітний для
// гравця" крок підготовчого рефакторингу перед контекстами/роутингом/
// ролями. Це саме той самий патерн, який уже давно застосований у
// progress.js для checkQuests()/recordRaceResult() — тут він поширюється
// на решту доменної логіки, яка раніше жила прямо в компоненті App.
//
// СВІДОМО без побічних ефектів: жодна функція тут не викликає
// persist()/setState()/trackEvent()/звук. App.jsx лишається єдиним
// місцем, що зберігає прогрес і показує тости/звуки — виклик редьюсера
// тут лише ОБЧИСЛЮЄ, що має змінитись.

import { BADGES } from "../data/rewards.js";
import { AVATARS } from "../data/cosmetics.js";
import {
  ensureDaily, checkQuests, starsForMistakes, heroLevelFromXp, recordRaceResult,
} from "./progress.js";

// "combined" (рівні 10-12, ланцюжки дій) і "compare" (порівняння двох
// виразів) не відповідають одному факту множення "AxB" — pair у них має
// інший формат, тож ці kind виключені з facts-статистики.
export const NON_FACT_KINDS = ["combined", "compare"];

// Перевірка досягнень — спільна для КОЖНОЇ дії, що може розблокувати
// бейдж (рівень, лабіринт, перегони, "Мої знання"/тренування слабких
// прикладів, покупка аватара). Повертає { progress, earnedBadges } —
// earnedBadges порожній масив, якщо нічого нового не розблоковано;
// caller (App.jsx) сам вирішує, чи показати тост/звук за earnedBadges.
export function checkBadges(p) {
  const earned = BADGES.filter((b) => !p.badges.includes(b.id) && b.check(p));
  if (!earned.length) return { progress: p, earnedBadges: [] };
  return {
    progress: { ...p, badges: [...p.badges, ...earned.map((b) => b.id)] },
    earnedBadges: earned,
  };
}

// Купівля аватара. success === true, якщо після виклику гравець ВОЛОДІЄ
// цим аватаром (уже мав або щойно купив) — саме це значення повертає
// App.jsx назовні (ShopScreen очікує boolean). changed === true лише
// коли реально відбулась покупка (монети списані) — САМЕ тоді App.jsx
// має викликати persist()/trackEvent(), не для "вже було"/"не вистачає".
export function purchaseAvatar(progress, avatarId) {
  if (progress.ownedAvatars.includes(avatarId)) {
    return { progress, success: true, changed: false, earnedBadges: [] };
  }
  const av = AVATARS.find((a) => a.id === avatarId);
  if (!av || progress.coins < av.cost) {
    return { progress, success: false, changed: false, earnedBadges: [] };
  }
  let p = {
    ...progress,
    coins: progress.coins - av.cost,
    ownedAvatars: [...progress.ownedAvatars, avatarId],
  };
  const { progress: next, earnedBadges } = checkBadges(p);
  return { progress: next, success: true, changed: true, earnedBadges, cost: av.cost };
}

// Вибір уже придбаного аватара. Повертає ТОЙ САМИЙ об'єкт progress
// (за посиланням), якщо аватар не належить гравцю — App.jsx звіряє
// `next === progress`, щоб зрозуміти, що persist() викликати не треба
// (точнісінько як зараз: непридбаний аватар просто ігнорується).
export function selectAvatar(progress, avatarId) {
  if (!progress.ownedAvatars.includes(avatarId)) return progress;
  return { ...progress, avatar: avatarId };
}

// Фіксує одну відповідь (бій, "Мої знання", тренування слабких
// прикладів — усі йдуть через цю саму функцію). Повертає
// { progress, earnedBadges }.
export function recordFact(progress, pair, correct, kind, responseTimeMs) {
  let p = ensureDaily(progress);
  let weakFixed = false;
  if (!NON_FACT_KINDS.includes(kind)) {
    const existing = p.facts?.[pair] ?? {
      correct: 0, wrong: 0, correctStreak: 0, lastAnsweredAt: null, totalResponseTimeMs: 0, answeredCount: 0,
    };
    // "Слабкий, і щойно виправлений" — фіксуємо ДО оновлення факту нижче,
    // інакше existing уже враховуватиме цю саму правильну відповідь.
    weakFixed = correct && existing.wrong > 0 && existing.wrong >= existing.correct;
    const key = correct ? "correct" : "wrong";
    const priorAttempts = existing.correct + existing.wrong;
    // Згладжена точність (EMA) — щоб ОДНА випадкова помилка серед багатьох
    // попередніх успіхів не обвалювала статус одразу. Кожна відповідь лише
    // ЗСУВАЄ попереднє значення на ALPHA у бік 1 (правильно) чи 0 (помилка).
    const SMOOTHING_ALPHA = 0.2;
    const priorAccuracy = existing.smoothedAccuracy ?? (priorAttempts > 0 ? existing.correct / priorAttempts : correct ? 1 : 0);
    const smoothedAccuracy = priorAccuracy * (1 - SMOOTHING_ALPHA) + (correct ? 1 : 0) * SMOOTHING_ALPHA;
    const updated = {
      ...existing,
      [key]: existing[key] + 1,
      correctStreak: correct ? (existing.correctStreak ?? 0) + 1 : 0,
      lastAnsweredAt: Date.now(),
      totalResponseTimeMs: (existing.totalResponseTimeMs ?? 0) + (Number.isFinite(responseTimeMs) ? responseTimeMs : 0),
      answeredCount: (existing.answeredCount ?? 0) + (Number.isFinite(responseTimeMs) ? 1 : 0),
      smoothedAccuracy,
    };
    p = { ...p, facts: { ...p.facts, [pair]: updated } };
  }
  if (correct) {
    p = { ...p, daily: { ...p.daily, correctToday: p.daily.correctToday + 1 } };
    // "pair" для класичних/missing/wordProblem прикладів завжди має вигляд
    // "AxB" — якщо один із множників 7, це відповідь із таблиці на 7.
    if (!NON_FACT_KINDS.includes(kind) && pair.split("x").includes("7")) {
      p = { ...p, daily: { ...p.daily, table7Today: (p.daily.table7Today ?? 0) + 1 } };
    }
    if (weakFixed) {
      p = { ...p, daily: { ...p.daily, weakFixedToday: (p.daily.weakFixedToday ?? 0) + 1 } };
    }
  }
  // Глобальна серія правильних відповідей поспіль (бій + "Мої знання"/
  // тренування слабких прикладів разом — обидва йдуть через recordFact) —
  // для бейджа "20 поспіль", окремо від per-fact correctStreak вище.
  const newAnswerStreak = correct ? (p.answerStreak ?? 0) + 1 : 0;
  p = { ...p, answerStreak: newAnswerStreak, bestAnswerStreak: Math.max(p.bestAnswerStreak ?? 0, newAnswerStreak) };
  const badgeResult = checkBadges(p);
  p = checkQuests(badgeResult.progress);
  return { progress: p, earnedBadges: badgeResult.earnedBadges };
}

// Нагорода за тренувальні режими (пам'ять, "Мої знання" тощо, поза
// боєм/лабіринтом/перегонами — ті мають власні функції нижче).
export function rewardPractice(progress, coinGain, xpGain, pairsFound = 0) {
  let p = ensureDaily(progress);
  p = {
    ...p,
    coins: p.coins + coinGain,
    xp: (p.xp ?? 0) + xpGain,
    daily: { ...p.daily, memoryPairsToday: (p.daily.memoryPairsToday ?? 0) + pairsFound },
  };
  const badgeResult = checkBadges(p);
  p = checkQuests(badgeResult.progress);
  return { progress: p, earnedBadges: badgeResult.earnedBadges };
}

// Завершення лабіринту — окремо від rewardPractice, бо рахує ще й
// кількість пройдених лабіринтів (для поступового підвищення складності)
// та скрині/таємний шлях цього конкретного проходження.
export function completeMaze(progress, coinGain, xpGain, extra = {}) {
  const { chestsFound = 0, secretFound = false } = extra;
  let p = ensureDaily(progress);
  p = {
    ...p,
    coins: p.coins + coinGain,
    xp: (p.xp ?? 0) + xpGain,
    mazeCompletions: (p.mazeCompletions ?? 0) + 1,
    // НАЗАВЖДИ (на відміну від daily.mazeChestsToday/mazeSecretToday
    // нижче, які скидаються щодня) — для бейджів "10 скринь"/"5 секретних
    // шляхів".
    totalChestsOpened: (p.totalChestsOpened ?? 0) + chestsFound,
    totalSecretsFound: (p.totalSecretsFound ?? 0) + (secretFound ? 1 : 0),
    daily: {
      ...p.daily,
      mazeChestsToday: (p.daily.mazeChestsToday ?? 0) + chestsFound,
      mazeSecretToday: p.daily.mazeSecretToday || secretFound,
    },
  };
  const badgeResult = checkBadges(p);
  p = checkQuests(badgeResult.progress);
  return { progress: p, earnedBadges: badgeResult.earnedBadges };
}

// Завершення заїзду перегонів — нараховує нагороду й веде бухгалтерію:
// історію останніх заїздів (для рекомендації складності наступного
// разу), особисті рекорди, розблокування чемпіонського заїзду,
// лічильник сьогоднішніх перемог тренувального заїзду.
export function completeRace(progress, coinGain, xpGain, meta) {
  let p = ensureDaily(progress);
  p = {
    ...p,
    coins: p.coins + coinGain,
    xp: (p.xp ?? 0) + xpGain,
    raceCompletions: (p.raceCompletions ?? 0) + 1,
  };
  if (meta) {
    const { p: nextP, isPersonalBest } = recordRaceResult(p, meta);
    p = nextP;
    p = {
      ...p,
      daily: {
        ...p.daily,
        raceTop2Today: meta.place <= 2 ? (p.daily.raceTop2Today ?? 0) + 1 : (p.daily.raceTop2Today ?? 0),
        raceBestToday: p.daily.raceBestToday || isPersonalBest,
      },
    };
    // "10 перемог у перегонах" / "Перемога у чемпіонському заїзді".
    if (meta.place === 1) {
      p = { ...p, totalRaceWins: (p.totalRaceWins ?? 0) + 1 };
      if (meta.difficulty === "champion") p = { ...p, championRaceWon: true };
    }
  }
  const badgeResult = checkBadges(p);
  p = checkQuests(badgeResult.progress);
  return { progress: p, earnedBadges: badgeResult.earnedBadges };
}

// Завершення онбордингу — приходить рівно один раз. Зібрані під час
// діагностики facts зливаються в progress.facts, невелика стартова
// нагорода за навчальний бій, onboardingComplete=true. Без checkBadges
// (як і в оригіналі — на цьому кроці бейджів ще нема що перевіряти).
export function completeOnboarding(progress, { facts, confidenceLevel }) {
  let p = ensureDaily(progress);
  const mergedFacts = { ...p.facts };
  for (const [pair, stat] of Object.entries(facts ?? {})) {
    const existing = mergedFacts[pair] ?? { correct: 0, wrong: 0 };
    mergedFacts[pair] = { correct: existing.correct + stat.correct, wrong: existing.wrong + stat.wrong };
  }
  p = {
    ...p,
    onboardingComplete: true,
    onboardingConfidence: confidenceLevel,
    facts: mergedFacts,
    coins: p.coins + 15,
    xp: (p.xp ?? 0) + 30,
  };
  return checkQuests(p);
}

// Завершення рівня. На відміну від інших редьюсерів, повертає ще й
// короткий підсумок (result) — скільки зірок/монет/XP отримано, чи
// піднявся рівень героя — щоб ResultsScreen міг одразу його показати.
export function completeLevel(progress, levelId, mistakes) {
  let p = ensureDaily(progress);
  const newStars = starsForMistakes(mistakes);
  const oldStars = p.levels[levelId]?.stars ?? 0;
  const stars = Math.max(oldStars, newStars);
  const coinGain = Math.max(0, newStars - oldStars) * 10;
  const xpGain = 15 + newStars * 10;
  const levels = { ...p.levels, [levelId]: { stars } };
  const totalStars = Object.values(levels).reduce((s, l) => s + l.stars, 0);
  const prevHero = heroLevelFromXp(p.xp ?? 0);
  // "Повернувся після поразки й переміг" — lastFailedLevelId виставляється
  // recordLevelFailure() нижче й очищається тут при БУДЬ-ЯКІЙ перемозі (не
  // лише на тому самому рівні), щоб не лишався застряглим.
  const cameBack = p.lastFailedLevelId === levelId;

  let next = {
    ...p, levels, totalStars,
    coins: p.coins + coinGain,
    xp: (p.xp ?? 0) + xpGain,
    daily: { ...p.daily, levelsToday: p.daily.levelsToday + 1, perfectToday: p.daily.perfectToday || mistakes === 0 },
    lastFailedLevelId: null,
    hadComeback: p.hadComeback || cameBack,
  };

  const badgeResult = checkBadges(next);
  next = checkQuests(badgeResult.progress);
  const newHero = heroLevelFromXp(next.xp);

  return {
    progress: next,
    earnedBadges: badgeResult.earnedBadges,
    result: {
      levelId, stars, newStars, mistakes, coinGain, xpGain,
      leveledUp: newHero.level > prevHero.level,
    },
  };
}

// Фіксує "щойно програно рівень N" — completeLevel() вище звіряє з цим
// при наступній перемозі для бейджа "Повернувся після поразки й переміг".
export function recordLevelFailure(progress, levelId) {
  return { ...progress, lastFailedLevelId: levelId };
}

// Відмічає, що гравець щойно бачив свій прогрес (лише для бейджа "Нове"
// на головному екрані) — повертає ТОЙ САМИЙ об'єкт, якщо позначка вже
// свіжіша за поточний момент (наприклад, повторний виклик з того самого
// рендера) — caller звіряє за посиланням, чи варто взагалі persist().
export function markKnowledgeSeen(progress) {
  const ts = Date.now();
  if ((progress.knowledgeLastSeenAt ?? 0) >= ts) return progress;
  return { ...progress, knowledgeLastSeenAt: ts };
}
