// launch-plan.md, розділ 5 "Перетворити тренування на справжню систему
// навчання" — статус засвоєння для кожної таблиці множення й кожного
// окремого прикладу. П'ять рівнів (іконки — public/assets/icons/knowledge/,
// з emoji-фолбеком у MyKnowledgeScreen.jsx через ArtImage):
//   ⚪ Ще не вивчалось   — < 3 спроб
//   🔴 Потрібно повторити — оцінка < 60
//   🟡 Майже засвоєно     — 60..79
//   🟢 Добре засвоєно     — 80..94
//   ⭐ Майстер            — 95+, і ЛИШЕ якщо ще й досить спроб, стабільна
//                           серія поспіль і відповідь у межах цільового часу
//
// Дивись src/screens/MyKnowledgeScreen.jsx (де це показується) і
// src/game/progress.js (де факти зберігаються — те саме поле facts, яким
// уже давно користується getWeakFacts()/generateQuestion.js).

export const MULTIPLIER_RANGE = [2, 3, 4, 5, 6, 7, 8, 9];

// Мінімум спроб, щоб взагалі вважати факт/таблицю "спробуваними" — менше
// цього просто немає достатньо даних для чесної оцінки (⚪, не 🔴 — дитина
// ще не встигла показати, вміє вона чи ні).
const MIN_ATTEMPTS_FOR_TIER = 3;

// "Майстер" — не лише високий відсоток: потрібно ще й реальний обсяг
// практики, стабільна серія без помилок і швидка впевнена відповідь.
// Значення підібрані як розумний дефолт для дитячої гри, не як точна
// педагогічна константа.
const MASTER_MIN_ATTEMPTS = 5;
const MASTER_MIN_STREAK = 3;
const TARGET_RESPONSE_MS = 6000; // 6с — щедрий, не змагальний ліміт

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Середній час відповіді на цей факт, або null, якщо даних ще немає
// (старі факти до появи responseTimeMs, чи ще жодної відповіді).
export function averageResponseTime(stat) {
  if (!stat || !stat.answeredCount) return null;
  return stat.totalResponseTimeMs / stat.answeredCount;
}

// Один факт (наприклад "7×8") -> число 0..100. Формула навмисно проста й
// прозора (не ML): точність дає основну вагу, серія поспіль — невеликий
// бонус, а мало спроб — применшує результат (щоб один вдалий здогад одразу
// не показував високу оцінку).
//
// "accuracy" бере stat.smoothedAccuracy, якщо він є (експоненційно згладжене
// середнє з App.jsx:recordFact — кожна відповідь лише ЗСУВАЄ значення, а не
// замінює), а не сиру частку correct/attempts. Це навмисно: сира частка
// дозволяє ОДНІЙ випадковій помилці серед багатьох попередніх успіхів різко
// обвалити оцінку (і навпаки); згладжене значення реагує плавно — саме цього
// вимагає розділ 9 ("не знижувати статус після однієї випадкової помилки").
// Старі факти без smoothedAccuracy (записані до цієї фічі) просто
// використовують сиру частку — без окремої міграції.
export function computeMastery(stat) {
  if (!stat) return 0;
  const correct = stat.correct ?? 0;
  const wrong = stat.wrong ?? 0;
  const attempts = correct + wrong;
  if (attempts === 0) return 0;

  const accuracy = stat.smoothedAccuracy ?? correct / attempts;
  // Бонус за серію поспіль навмисно НЕВЕЛИКИЙ (макс +10, було +20): серія
  // скидається в 0 ОДРАЗУ ж після однієї помилки (App.jsx:recordFact), тож
  // якби вона важила так само багато, як точність, одна помилка одразу
  // забирала б і згладжену точність (плавно), і всю серію (миттєво) —
  // сумарно все одно давало б різкий обвал, якого явно вимагали уникнути
  // (розділ 9: "не знижувати статус після однієї випадкової помилки").
  // Найбільшу вагу тепер несе саме accuracy (уже згладжена), а серія лише
  // невеликий додатковий штрих; "стабільна серія" для "Майстра" все одно
  // окремо перевіряється явним порогом нижче (correctStreak >= MASTER_MIN_STREAK).
  const streakBonus = Math.min(stat.correctStreak ?? 0, 5) * 2; // до +10
  const confidence = Math.min(attempts / 5, 1); // <5 спроб — результат применшено

  const raw = clamp(accuracy * 90 + streakBonus, 0, 100);
  return Math.round(raw * (0.5 + 0.5 * confidence));
}

// "file" — ім'я файлу в public/assets/icons/knowledge/ (без розширення,
// самі PNG вже додані). "label" — точні формулювання з технічного завдання
// (навмисно дружні, без слів на кшталт "погано"/"провал").
const TIERS = {
  untried: { tier: "untried", icon: "⚪", file: "knowledge_untried", label: "Ще не вивчалось" },
  weak: { tier: "weak", icon: "🔴", file: "knowledge_weak", label: "Потрібно повторити" },
  almost: { tier: "almost", icon: "🟡", file: "knowledge_almost", label: "Майже засвоєно" },
  good: { tier: "good", icon: "🟢", file: "knowledge_good", label: "Добре засвоєно" },
  master: { tier: "master", icon: "⭐", file: "knowledge_master", label: "Майстер" },
};

// opts.minAttemptsForMaster — для агрегату цілої таблиці поріг масштабується
// (tableMastery нижче передає MASTER_MIN_ATTEMPTS × 8 партнерів), для
// одного факту лишається дефолт.
// opts.masterEligible — додатковий "жорсткий" вимикач: tableMastery ставить
// false, якщо серед 8 можливих прикладів таблиці є хоч один, який ще
// жодного разу не траплявся (не можна бути "майстром таблиці", не
// спробувавши всі приклади в ній).
export function masteryStatus(stat, opts = {}) {
  const { minAttemptsForMaster = MASTER_MIN_ATTEMPTS, masterEligible = true } = opts;
  const attempts = (stat?.correct ?? 0) + (stat?.wrong ?? 0);
  if (attempts < MIN_ATTEMPTS_FOR_TIER) return TIERS.untried;

  const score = computeMastery(stat);
  if (score < 60) return TIERS.weak;
  if (score < 80) return TIERS.almost;
  if (score < 95) return TIERS.good;

  // score >= 95 — але золота "Майстер"-іконка виправдана лише за
  // додаткових умов, не лише за самим відсотком.
  const streak = stat.correctStreak ?? 0;
  const avgRt = averageResponseTime(stat);
  const fastEnough = avgRt === null || avgRt <= TARGET_RESPONSE_MS;
  if (masterEligible && attempts >= minAttemptsForMaster && streak >= MASTER_MIN_STREAK && fastEnough) {
    return TIERS.master;
  }
  return TIERS.good;
}

// Прогрес зберігає facts за буквальним pair ("7x8" АБО "8x7" — залежно від
// того, як приклад був згенерований, порядок множників не нормалізується
// при записі). Повертає РІВНО 8 записів (партнери 2..9), з stat===null для
// ще не зустрічуваних — детальний екран показує їх усі, включно з
// "недостатньо даних".
export function tableFacts(facts, number) {
  return MULTIPLIER_RANGE.map((m) => {
    const pairA = `${number}x${m}`;
    const pairB = `${m}x${number}`;
    const stat = facts?.[pairA] ?? facts?.[pairB] ?? null;
    const pair = facts?.[pairA] ? pairA : facts?.[pairB] ? pairB : pairA;
    return { m, pair, stat };
  });
}

// Лише ті факти таблиці, які вже хоч раз зустрічались (для сумісності зі
// старим викликом і як внутрішній хелпер tableMastery нижче).
export function factsForTable(facts, number) {
  return tableFacts(facts, number)
    .filter((e) => e.stat)
    .map((e) => e.stat);
}

// Об'єднує кілька stat в один синтетичний — для оцінки ЦІЛОЇ таблиці тими
// самими формулами, що й одного факту. correctStreak бере МІНІМУМ (а не
// суму/середнє): таблиця настільки стабільна, наскільки стабільний її
// найгірший приклад — інакше один щойно натренований факт із довгою серією
// міг би "прикрити" інший, який дитина досі плутає.
function aggregateStats(stats) {
  const correct = stats.reduce((s, st) => s + (st.correct ?? 0), 0);
  const wrong = stats.reduce((s, st) => s + (st.wrong ?? 0), 0);
  const totalResponseTimeMs = stats.reduce((s, st) => s + (st.totalResponseTimeMs ?? 0), 0);
  const answeredCount = stats.reduce((s, st) => s + (st.answeredCount ?? 0), 0);
  const correctStreak = stats.length ? Math.min(...stats.map((st) => st.correctStreak ?? 0)) : 0;
  return { correct, wrong, correctStreak, totalResponseTimeMs, answeredCount };
}

// Агрегований статус для цілої таблиці (наприклад, усе, де множник — 7).
export function tableMastery(facts, number) {
  const entries = tableFacts(facts, number);
  const engaged = entries.filter((e) => e.stat);
  const attempts = engaged.reduce((s, e) => s + (e.stat.correct ?? 0) + (e.stat.wrong ?? 0), 0);
  if (attempts === 0) return { score: 0, attempts: 0, ...masteryStatus(null) };

  const agg = aggregateStats(engaged.map((e) => e.stat));
  const allCovered = engaged.length === MULTIPLIER_RANGE.length;
  const score = computeMastery(agg);
  const status = masteryStatus(agg, {
    minAttemptsForMaster: MASTER_MIN_ATTEMPTS * MULTIPLIER_RANGE.length,
    masterEligible: allCovered,
  });
  return { score, attempts, ...status };
}

// Загальна зведена панель для головного екрана "Мої знання" (розділ 2
// технічного завдання): один відсоток на всі 8 таблиць одразу, і кількість
// таблиць у кожному "хорошому"/"слабкому" кошику. "goodCount" рахує і
// "Добре засвоєно", і "Майстер" разом — обидва вже означають "дитина це
// знає", різниця лише в тому, наскільки блискуче.
export function overallMastery(facts) {
  const tables = MULTIPLIER_RANGE.map((n) => ({ number: n, ...tableMastery(facts, n) }));
  const totalAttempts = tables.reduce((s, t) => s + t.attempts, 0);
  if (totalAttempts === 0) {
    return { score: 0, attempts: 0, goodCount: 0, weakCount: 0, untriedCount: tables.length, tables };
  }
  const weightedSum = tables.reduce((s, t) => s + t.score * t.attempts, 0);
  const score = Math.round(weightedSum / totalAttempts);
  const goodCount = tables.filter((t) => t.tier === "good" || t.tier === "master").length;
  const weakCount = tables.filter((t) => t.tier === "weak").length;
  const untriedCount = tables.filter((t) => t.tier === "untried").length;
  return { score, attempts: totalAttempts, goodCount, weakCount, untriedCount, tables };
}

// Чи з'явилась хоч якась нова активність у фактах з моменту, коли гравець
// востаннє відкривав "Мої знання" (progress.knowledgeLastSeenAt) —
// використовується лише для бейджа "Нове" на головному екрані. lastAnsweredAt
// з'являється в App.jsx:recordFact лише для фактів, відповіданих ПІСЛЯ появи
// цієї фічі — старі факти без цього поля просто не рахуються (не показуємо
// бейдж заднім числом за давню активність).
export function hasNewMasteryActivity(facts, sinceTs = 0) {
  for (const stat of Object.values(facts ?? {})) {
    if ((stat?.lastAnsweredAt ?? 0) > sinceTs) return true;
  }
  return false;
}

// Яку з 8 таблиць порадити наступною — від найслабшого доказу проблеми до
// геть нового матеріалу, а не просто "найнижчий відсоток" (інакше система
// завжди тягнула б увагу на ще не вивчене замість реально слабкого):
//   1. є таблиця зі статусом "Потрібно повторити" (реальний доказ слабкості)
//      -> найгірша серед них;
//   2. інакше є "Майже засвоєно" -> найгірша серед них (варто дотягнути);
//   3. інакше є ще не вивчена таблиця -> перша за номером;
//   4. інакше (усе "Добре"/"Майстер") -> нема кого рекомендувати, null.
export function recommendTable(facts, numbers = MULTIPLIER_RANGE) {
  const entries = numbers.map((n) => ({ number: n, mastery: tableMastery(facts, n) }));

  const weak = entries.filter((e) => e.mastery.tier === "weak");
  if (weak.length) {
    weak.sort((a, b) => a.mastery.score - b.mastery.score);
    return { number: weak[0].number, reason: "weak" };
  }

  const almost = entries.filter((e) => e.mastery.tier === "almost");
  if (almost.length) {
    almost.sort((a, b) => a.mastery.score - b.mastery.score);
    return { number: almost[0].number, reason: "almost" };
  }

  const untried = entries.filter((e) => e.mastery.tier === "untried");
  if (untried.length) {
    return { number: untried[0].number, reason: "untried" };
  }

  return null;
}

// N найслабших фактів для тренування (розділ 8): за замовчуванням по
// ВСІХ таблицях (головний екран), або лише по одній (pairs — конкретний
// список ключів, детальний екран передає tableFacts(...).map(e=>e.pair)).
//
// ВАЖЛИВО: це не просто "N фактів із найнижчим числом" — інакше для
// таблиці, де геть усе вже "Майстер", функція все одно повернула б 8
// записів (найслабші СЕРЕД майстрів, тобто 95-96% замість 100%), і кнопка
// "Потренувати" пропонувала б потренувати те, що дитина й так відмінно
// знає. needsWork=true (за замовчуванням) додатково фільтрує до тіерів
// "Потрібно повторити"/"Майже засвоєно" — те саме, що використовується для
// бейджа "Повторити" на детальному екрані. excludeUntried=true — "не
// включати теми, яких дитина ще не вивчала": факти з <3 спроб не тягнуть
// увагу, попри формально низьку оцінку (0), це не слабкість, а відсутність
// даних.
export function weakestFacts(facts, { limit = 8, excludeUntried = true, needsWork = true, pairs = null } = {}) {
  const entries = pairs
    ? pairs.map((pair) => [pair, facts?.[pair] ?? null]).filter(([, stat]) => stat)
    : Object.entries(facts ?? {}).filter(([pair]) => /^\d+x\d+$/.test(pair));

  const withScore = entries.map(([pair, stat]) => {
    const attempts = (stat.correct ?? 0) + (stat.wrong ?? 0);
    return { pair, stat, score: computeMastery(stat), attempts, tier: masteryStatus(stat).tier };
  });

  let eligible = excludeUntried
    ? withScore.filter((e) => e.attempts >= MIN_ATTEMPTS_FOR_TIER)
    : withScore;

  if (needsWork) {
    eligible = eligible.filter((e) => e.tier === "weak" || e.tier === "almost");
  }

  eligible.sort((a, b) => a.score - b.score);

  return eligible.slice(0, limit).map((e) => {
    const [a, b] = e.pair.split("x").map(Number);
    return { pair: e.pair, a, b, score: e.score, attempts: e.attempts };
  });
}
