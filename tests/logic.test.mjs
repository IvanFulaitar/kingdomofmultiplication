// launch-plan.md, розділ 17 "Тестування перед запуском" — набір unit-тестів
// на чисту ігрову логіку (без React/DOM): генерація прикладів, зірки, XP,
// нагороди, покупки, міграції save, адаптивна складність, перегони,
// щоденні завдання, streak, захист від подвійного отримання нагороди.
//
// Навмисно БЕЗ vitest/jest: у цьому середовищі немає доступу до npm-реєстру
// для встановлення нового test-раннера (лише те, що вже є в node_modules).
// Замість цього — крихітний вбудований harness (test/assert нижче) і
// запуск через esbuild (вже присутній як транзитивна залежність vite),
// що дозволяє напряму імпортувати справжні ESM-модулі гри (включно з
// JSON-локалями). Дивись scripts/run-tests.mjs — саме він збирає й
// виконує цей файл; напряму `node tests/logic.test.mjs` не запуститься
// (JSON-імпорти й import.meta.env не проходять без збірки).
//
// Якщо колись з'явиться доступ до npm-реєстру — цей файл легко
// переноситься під vitest/jest майже без змін (test()/assert* тут навмисно
// повторюють звичний describe-less "test(name, fn)" стиль).

import {
  defaultProgress, migrateSave, starsForMistakes, heroLevelFromXp,
  checkQuests, updateStreak, ensureDaily, saveProgress, loadProgress,
  takeLoadWarning, recordRaceResult, isChampionRaceUnlocked,
  getRaceRecommendation, STORAGE_KEY, CURRENT_SAVE_VERSION,
} from "../src/game/progress.js";
import {
  generateQuestion, buildFactQuestion, factKey, timeForLevel,
  getWeakFacts, factsUsedIn,
} from "../src/game/generateQuestion.js";
import {
  computeMastery, masteryStatus, tableFacts, tableMastery, overallMastery,
  recommendTable, MULTIPLIER_RANGE,
} from "../src/game/mastery.js";
import {
  opponentGain, streakBonus, starsForRace, computeRaceReward, rankParticipants,
} from "../src/game/raceEngine.js";
import { QUEST_POOL, pickDailyQuestIds } from "../src/data/rewards.js";

// --------------------------------------------------------- mini harness ---
let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push({ name, err });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// In-memory localStorage polyfill — progress.js звертається до глобального
// localStorage лише ВСЕРЕДИНІ функцій (не на верхньому рівні модуля), тож
// досить підмінити його до першого виклику saveProgress()/loadProgress().
class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.has(k) ? this.store.get(k) : null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}
globalThis.localStorage = new MemoryStorage();

// ======================================================= progress.js ===

test("defaultProgress: розумні стартові значення", () => {
  const p = defaultProgress();
  assertEqual(p.coins, 0);
  assertEqual(p.xp, 0);
  assertEqual(p.totalStars, 0);
  assertEqual(p.avatar, "wizard");
  assert(p.ownedAvatars.includes("wizard"), "wizard має бути в ownedAvatars за замовчуванням");
  assertEqual(p.saveVersion, CURRENT_SAVE_VERSION);
  assertEqual(p.daily.activeQuestIds.length, 3, "щодня має бути рівно 3 активних завдання");
});

test("starsForMistakes: 0 помилок = 3 зірки, далі спадає", () => {
  assertEqual(starsForMistakes(0), 3);
  assertEqual(starsForMistakes(1), 2);
  assertEqual(starsForMistakes(2), 1);
  assertEqual(starsForMistakes(10), 1, "багато помилок не повинно давати 0 чи від'ємні зірки");
});

test("heroLevelFromXp: рівень 1 при xp=0, монотонно зростає", () => {
  const l0 = heroLevelFromXp(0);
  assertEqual(l0.level, 1);
  assertEqual(l0.into, 0);
  assertEqual(l0.need, 100);

  assertEqual(heroLevelFromXp(99).level, 1, "99xp ще не рівень 2 (поріг=100)");
  const l100 = heroLevelFromXp(100);
  assertEqual(l100.level, 2);
  assertEqual(l100.into, 0);
  assertEqual(l100.need, 140, "поріг рівня 2 = 100 + (2-1)*40");

  // Монотонність: рівень ніколи не спадає зі зростанням xp.
  let prevLevel = 1;
  for (let xp = 0; xp <= 5000; xp += 37) {
    const { level } = heroLevelFromXp(xp);
    assert(level >= prevLevel, `рівень не має спадати: xp=${xp} дав level=${level} після ${prevLevel}`);
    prevLevel = level;
  }
});

test("migrateSave: старий/неповний прогрес дозаповнюється без падіння", () => {
  const bare = {}; // найгірший випадок — зовсім порожній об'єкт
  const migrated = migrateSave(bare);
  assert(Array.isArray(migrated.ownedAvatars), "ownedAvatars має стати масивом");
  assert(migrated.ownedAvatars.includes("wizard"));
  assertEqual(migrated.mazeCompletions, 0);
  assertEqual(migrated.raceCompletions, 0);
  assert(migrated.saveVersion >= 1);
  assert(Array.isArray(migrated.daily.activeQuestIds));
  assertEqual(migrated.daily.activeQuestIds.length, 3);
});

test("migrateSave: наявний прогрес (рівні/монети) позначає онбординг пройденим", () => {
  const old = { levels: { 1: { stars: 3 } }, coins: 50 };
  const migrated = migrateSave(old);
  assertEqual(migrated.onboardingComplete, true, "гравець з реальним прогресом не має знову бачити онбординг");
});

test("checkQuests: нараховує нагороду рівно один раз за завдання", () => {
  let p = defaultProgress();
  p = ensureDaily(p);
  // Беремо перше активне easy-завдання і форсуємо його прогрес до цілі.
  const easyId = p.daily.activeQuestIds.find((id) => QUEST_POOL.find((q) => q.id === id)?.tier === "easy");
  const quest = QUEST_POOL.find((q) => q.id === easyId);
  // correctToday — поле, яке читає progress() майже всіх easy-квестів; про
  // всяк випадок форсуємо universal-friendly шлях через прямий виклик quest.progress.
  p = { ...p, daily: { ...p.daily, correctToday: 999, levelsToday: 999, memoryPairsToday: 999 } };

  const before = p.coins;
  const afterFirst = checkQuests(p);
  assert(afterFirst.daily.claimed.includes(easyId), "завдання має потрапити в claimed після виконання");
  assert(afterFirst.coins >= before, "монети мають нарахуватись");

  const afterSecond = checkQuests(afterFirst);
  assertEqual(afterSecond.coins, afterFirst.coins, "повторний виклик НЕ повинен нараховувати нагороду вдруге (захист від подвійного отримання)");
  assertEqual(afterSecond.daily.claimed.length, afterFirst.daily.claimed.length);
});

test("updateStreak: послідовні дні збільшують серію, розрив скидає", () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const longAgo = "2000-01-01";

  const fromYesterday = updateStreak({ streak: { current: 4, lastPlayedDate: yesterday } });
  assertEqual(fromYesterday.streak.current, 5, "гра вчора -> сьогодні збільшує серію на 1");

  const fromLongAgo = updateStreak({ streak: { current: 9, lastPlayedDate: longAgo } });
  assertEqual(fromLongAgo.streak.current, 1, "розрив у грі скидає серію до 1, а не забирає в 0/мінус");

  const sameDayTwice = updateStreak({ streak: { current: 3, lastPlayedDate: today } });
  assertEqual(sameDayTwice.streak.current, 3, "повторний виклик того самого дня не повинен рахувати ще раз");
});

test("ensureDaily: скидає лічильники на новий день, лишає в межах дня", () => {
  const p = { daily: { date: "2000-01-01", correctToday: 5, claimed: ["x"], activeQuestIds: ["a", "b", "c"] } };
  const reset = ensureDaily(p);
  assert(reset.daily.date !== "2000-01-01");
  assertEqual(reset.daily.correctToday, 0);
  assertEqual(reset.daily.claimed.length, 0);

  const sameDay = ensureDaily(reset);
  assertEqual(sameDay, reset, "у межах того самого дня об'єкт не повинен пересоздаватись");
});

test("save/load: звичайний round-trip зберігає дані", () => {
  localStorage.clear();
  const p = { ...defaultProgress(), coins: 123, xp: 45 };
  const ok = saveProgress(p);
  assertEqual(ok, true, "saveProgress має повернути true при успішному записі");
  const loaded = loadProgress();
  assertEqual(loaded.coins, 123);
  assertEqual(loaded.xp, 45);
});

test("save/load: пошкоджений основний запис відновлюється з backup", () => {
  localStorage.clear();
  saveProgress({ ...defaultProgress(), coins: 10 }); // валідний перший запис (стане backup)
  saveProgress({ ...defaultProgress(), coins: 20 }); // валідний другий (backup тепер = coins:10, main = coins:20)
  localStorage.setItem(STORAGE_KEY, "{not valid json"); // ламаємо ГОЛОВНИЙ запис уручну

  const loaded = loadProgress();
  assertEqual(loaded.coins, 10, "має відновитись саме з backup (попередній валідний стан)");
  assertEqual(takeLoadWarning(), "recovered-from-backup");
  assertEqual(takeLoadWarning(), null, "попередження видається лише один раз (споживається)");
});

test("save/load: пошкоджені основний запис і backup -> чистий старт", () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, "{broken");
  localStorage.setItem(`${STORAGE_KEY}-backup`, "{also broken");

  const loaded = loadProgress();
  assertEqual(loaded.coins, 0, "без валідного backup лишається лише почати заново");
  assertEqual(takeLoadWarning(), "reset-corrupted");
});

test("saveProgress: повертає false, якщо запис на диск не вдався (напр. QuotaExceededError)", () => {
  localStorage.clear();
  const realSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
  try {
    const ok = saveProgress(defaultProgress());
    assertEqual(ok, false, "невдалий localStorage.setItem має призвести до return false, а не тихого проковтування");
  } finally {
    localStorage.setItem = realSetItem;
  }
});

test("перегони: чемпіонський заїзд назавжди відкривається однією перемогою", () => {
  let p = defaultProgress();
  assertEqual(isChampionRaceUnlocked(p), false);
  const { p: afterWin } = recordRaceResult(p, {
    difficulty: "adventure", place: 1, accuracy: 0.9, avgResponseTime: 2, bestStreak: 5, gapToSecond: 20, score: 500,
  });
  assertEqual(isChampionRaceUnlocked(afterWin), true);

  // Навіть після 5 інших заїздів (історія обрізається до 5) прапорець лишається.
  let rolled = afterWin;
  for (let i = 0; i < 5; i++) {
    rolled = recordRaceResult(rolled, {
      difficulty: "training", place: 3, accuracy: 0.5, avgResponseTime: 3, bestStreak: 1, gapToSecond: 0, score: 10,
    }).p;
  }
  assertEqual(isChampionRaceUnlocked(rolled), true, "чемпіонський статус не повинен губитись при прокрутці історії");
});

test("перегони: рекомендація складності реагує на впевнені перемоги й серію програшів", () => {
  const twoConfidentWins = [
    { difficulty: "training", place: 1, accuracy: 0.9, gapToSecond: 20 },
    { difficulty: "training", place: 1, accuracy: 0.95, gapToSecond: 25 },
  ];
  const harder = getRaceRecommendation(twoConfidentWins);
  assert(harder && harder.type === "harder" && harder.to === "adventure", "дві впевнені перемоги поспіль -> порада складніше");

  const threeLosses = [
    { difficulty: "adventure", place: 2, accuracy: 0.4 },
    { difficulty: "adventure", place: 3, accuracy: 0.3 },
    { difficulty: "adventure", place: 2, accuracy: 0.4 },
  ];
  const easier = getRaceRecommendation(threeLosses);
  assert(easier && easier.type === "easier" && easier.to === "training", "три поразки поспіль -> порада легше");
});

// =================================================== generateQuestion.js ===

test("factKey: формат a x b", () => {
  assertEqual(factKey(6, 7), "6x7");
});

test("timeForLevel: рівні 10+ мають більше часу", () => {
  assertEqual(timeForLevel(1), 9);
  assertEqual(timeForLevel(9), 9);
  assertEqual(timeForLevel(10), 15);
  assertEqual(timeForLevel(12), 15);
});

test("buildFactQuestion: коректна відповідь і 4 унікальні позитивні варіанти", () => {
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      const q = buildFactQuestion(a, b);
      assertEqual(q.correct, a * b, `${a}x${b} має correct=${a * b}`);
      assertEqual(q.options.length, 4, `${a}x${b}: мають бути рівно 4 варіанти`);
      assertEqual(new Set(q.options).size, 4, `${a}x${b}: варіанти мають бути унікальними`);
      assert(q.options.includes(q.correct), `${a}x${b}: правильна відповідь має бути серед варіантів`);
      for (const opt of q.options) {
        assert(opt > 0, `${a}x${b}: варіант ${opt} має бути додатним`);
      }
    }
  }
});

test("getWeakFacts: лише факти, де помилок стільки ж або більше за правильні", () => {
  const facts = {
    "2x3": { correct: 1, wrong: 2 },
    "4x5": { correct: 5, wrong: 0 },
    "6x7": { correct: 1, wrong: 1 },
    "8x9": { correct: 0, wrong: 0 },
  };
  const weak = getWeakFacts(facts).sort();
  assertEqual(weak.join(","), "2x3,6x7");
});

test("factsUsedIn: розбирає classic і compare питання", () => {
  assertEqual(factsUsedIn({ pair: "6x7" }).join(","), "6x7");
  const cmp = factsUsedIn({ kind: "compare", pair: "cmp-6x7_9x8" });
  assertEqual(cmp.join(","), "6x7,8x9", "множники в compare нормалізуються (менший першим)");
});

test("generateQuestion: для всіх 12 рівнів завжди валідне питання (без зависань і дублів)", () => {
  const ITERATIONS = 150;
  for (let levelId = 1; levelId <= 12; levelId++) {
    for (let i = 0; i < ITERATIONS; i++) {
      const q = generateQuestion(levelId, null, [], []);
      // "compare" (порівняння двох добутків) — навмисно рівно 2 варіанти
      // ("лівий вираз" / "правий вираз"), не 4, як в усіх інших типів.
      const expectedOptions = q.kind === "compare" ? 2 : 4;
      assert(q && typeof q.prompt === "string" && q.prompt.length > 0, `рівень ${levelId}: prompt має бути непорожнім рядком`);
      assert(Array.isArray(q.options) && q.options.length === expectedOptions, `рівень ${levelId} (${q.kind}): очікувалось ${expectedOptions} варіантів, отримано ${q.options?.length}`);
      assertEqual(new Set(q.options).size, expectedOptions, `рівень ${levelId} (${q.kind}): варіанти без дублів`);
      const correctCount = q.options.filter((o) => o === q.correct).length;
      assertEqual(correctCount, 1, `рівень ${levelId} (${q.kind}): правильна відповідь має зустрічатись рівно один раз серед варіантів`);
    }
  }
});

// ============================================================ mastery.js ===

test("computeMastery: без спроб = 0, багато правильних поспіль -> близько до максимуму", () => {
  assertEqual(computeMastery(null), 0);
  assertEqual(computeMastery({ correct: 0, wrong: 0 }), 0);
  const strong = computeMastery({ correct: 10, wrong: 0, correctStreak: 5, smoothedAccuracy: 1 });
  assert(strong >= 95, `дуже хороший факт має бути >=95, отримано ${strong}`);
});

test("masteryStatus: менше 3 спроб завжди 'untried' незалежно від результату", () => {
  assertEqual(masteryStatus({ correct: 2, wrong: 0 }).tier, "untried");
  assertEqual(masteryStatus({ correct: 0, wrong: 2 }).tier, "untried");
});

test("masteryStatus: 'master' вимагає не лише відсоток, а й серію і швидкість", () => {
  const highScoreNoStreak = masteryStatus({ correct: 10, wrong: 0, correctStreak: 0, smoothedAccuracy: 1 });
  assert(highScoreNoStreak.tier !== "master", "без стабільної серії статус не повинен бути 'master'");
  const realMaster = masteryStatus({ correct: 10, wrong: 0, correctStreak: 5, smoothedAccuracy: 1, totalResponseTimeMs: 10000, answeredCount: 5 });
  assertEqual(realMaster.tier, "master");
});

test("tableFacts: завжди рівно 8 записів (партнери 2..9)", () => {
  const entries = tableFacts({}, 7);
  assertEqual(entries.length, MULTIPLIER_RANGE.length);
});

test("recommendTable: порожні факти рекомендують першу невивчену таблицю", () => {
  const rec = recommendTable({});
  assert(rec && rec.reason === "untried" && rec.number === MULTIPLIER_RANGE[0]);
});

test("recommendTable: реальна слабкість переважає над невивченим", () => {
  // Кожен факт "AxB" одночасно належить рядку таблиці A (партнер B) І
  // рядку таблиці B (партнер A) — tableFacts() шукає facts[pairA] ??
  // facts[pairB]. Тож щоб ОДНОЗНАЧНО зробити слабкою лише таблицю 5,
  // недостатньо заповнити тільки її рядок: усі "сусідні" таблиці теж
  // отримали б по одному "позиченому" поганому факту. Тому явно
  // заповнюємо ВСІ 36 унікальних пар (a<=b, 2..9): пари з 5 — погані,
  // решта — дуже хороші. Тоді в кожної "сусідньої" таблиці лише 1 з 8
  // партнерів поганий (розбавлено до "good"), а в таблиці 5 — усі 8
  // (однозначно "weak").
  const facts = {};
  for (const a of MULTIPLIER_RANGE) {
    for (const b of MULTIPLIER_RANGE) {
      if (a > b) continue;
      const weak = a === 5 || b === 5;
      facts[`${a}x${b}`] = weak
        ? { correct: 1, wrong: 9 }
        : { correct: 10, wrong: 0, correctStreak: 5, totalResponseTimeMs: 10000, answeredCount: 10 };
    }
  }
  const rec = recommendTable(facts);
  assertEqual(rec.reason, "weak");
  assertEqual(rec.number, 5, "лише таблиця 5 має бути суцільно weak, сусідні розбавлені до good");
});

// ========================================================= raceEngine.js ===

test("streakBonus: зростає зі стабільною серією, максимум +3", () => {
  assertEqual(streakBonus(1), 0);
  assertEqual(streakBonus(2), 1);
  assertEqual(streakBonus(3), 2);
  assertEqual(streakBonus(4), 3);
  assertEqual(streakBonus(10), 3, "бонус не повинен рости необмежено");
});

test("opponentGain: 'гумове' наздоганяння завжди обмежене, ніколи не вирішує заїзд одноосібно", () => {
  const tierConfig = { base: [8, 10], weakChance: 0, weakPenalty: [0, 0] };
  for (let i = 0; i < 200; i++) {
    const bigLead = opponentGain({
      tierConfig, catchupBounds: { min: -3, max: 5 },
      playerProgress: 90, opponentProgress: 10, isFinalStretch: false,
    });
    // Навіть із величезним розривом на користь гравця, приріст суперника
    // обмежений catchupBounds.max (5) поверх базового діапазону (8-10) +
    // випадковості (-2..2) — тобто ніколи не "телепортує" суперника вперед.
    assert(bigLead <= 10 + 2 + 5, `приріст суперника (${bigLead}) не має перевищувати базу+варіацію+максимум наздоганяння`);
    assert(bigLead >= 3, "приріст суперника завжди >= мінімального порогу (MIN_OPPONENT_GAIN)");
  }
});

test("starsForRace: місце визначає зірки, слабкий результат на 3-му місці без карання", () => {
  assertEqual(starsForRace({ place: 1, accuracy: 0.5 }), 3);
  assertEqual(starsForRace({ place: 2, accuracy: 0.1 }), 2);
  assertEqual(starsForRace({ place: 3, accuracy: 0.9 }), 1);
  assertEqual(starsForRace({ place: 3, accuracy: 0.1 }), 0);
});

test("rankParticipants: сортує за прогресом, нічию розбиває часом останньої відповіді", () => {
  const ranked = rankParticipants([
    { id: "a", rawProgress: 50, lastAnswerTime: 100 },
    { id: "b", rawProgress: 80, lastAnswerTime: 200 },
    { id: "c", rawProgress: 80, lastAnswerTime: 50 },
  ]);
  assertEqual(ranked.map((r) => r.id).join(","), "c,b,a", "при нічиї (80=80) перемагає той, хто відповів РАНІШЕ");
});

test("computeRaceReward: захист від фарму знижує лише монети тренувального заїзду після 3 перемог", () => {
  const reward = { coins: 20, xp: 20, multiplier: 1 };
  const normal = computeRaceReward({ reward, place: 1, accuracy: 0.8, flawless: false, isPersonalBest: false, trainingWinsToday: 2, isTraining: true });
  const farmed = computeRaceReward({ reward, place: 1, accuracy: 0.8, flawless: false, isPersonalBest: false, trainingWinsToday: 3, isTraining: true });
  assertEqual(normal.farmReduced, false);
  assertEqual(farmed.farmReduced, true);
  assert(farmed.totalCoins < normal.totalCoins, "4-та+ перемога тренувального заїзду за день має давати менше монет");
  assertEqual(farmed.totalXp, normal.totalXp, "XP фарм-захист не зменшує (лише монети)");
});

test("computeRaceReward: нагорода завжди щонайменше 1 монета/1 XP", () => {
  const reward = { coins: 1, xp: 1, multiplier: 1 };
  const r = computeRaceReward({ reward, place: 3, accuracy: 0, flawless: false, isPersonalBest: false, trainingWinsToday: 0, isTraining: false });
  assert(r.totalCoins >= 1);
  assert(r.totalXp >= 1);
});

// ============================================================ rewards.js ===

test("pickDailyQuestIds: детерміновано (той самий день = той самий набір)", () => {
  const a = pickDailyQuestIds("2026-08-04");
  const b = pickDailyQuestIds("2026-08-04");
  assertEqual(a.join(","), b.join(","));
});

test("pickDailyQuestIds: завжди по одному easy/medium/training, усі id існують у QUEST_POOL", () => {
  for (const dateStr of ["2026-01-01", "2026-06-15", "2027-12-31"]) {
    const ids = pickDailyQuestIds(dateStr);
    assertEqual(ids.length, 3);
    const tiers = ids.map((id) => QUEST_POOL.find((q) => q.id === id)?.tier);
    assertEqual(tiers.join(","), "easy,medium,training");
  }
});

// ================================================================ підсумок ===

console.log(`\n${passed} passed, ${failures.length} failed (усього ${passed + failures.length})\n`);
if (failures.length) {
  for (const { name, err } of failures) {
    console.log(`FAIL: ${name}`);
    console.log(`  ${err.stack ? err.stack.split("\n").slice(0, 3).join("\n  ") : err}`);
  }
  process.exitCode = 1;
}
