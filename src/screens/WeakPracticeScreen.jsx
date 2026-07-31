import { useRef, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import ArtImage from "../components/ArtImage.jsx";
import { buildFactQuestion } from "../game/generateQuestion.js";
import { explainFromPair } from "../game/explainFact.js";
import {
  tableMastery, computeMastery, masteryStatus,
  buildTablePracticePool, buildOverviewPracticePool,
} from "../game/mastery.js";
import { formatPercent } from "../game/format.js";
import { playUiPrimary, playUiBack, playAttack, playHeartLost, playVictory } from "../game/sfx.js";

// launch-plan.md, розділ 5, технічне завдання "Мої знання" (розділ 4) —
// коротке (5-8 прикладів) прицільне тренування слабких/недостатньо
// перевірених фактів, як внутрішній "режим" MyKnowledgeScreen.jsx (не
// окремий App.jsx screen — по завершенні природно повертаємось туди ж,
// звідки прийшли).
//
// Три способи запуску (усі будують пул ОДНАКОВИМИ функціями з mastery.js,
// якими вже користується MyKnowledgeScreen.jsx для показу "N коротких
// завдань" — це і є гарантія логічної узгодженості №3 технічного завдання:
// цифра на детальному/оглядовому екрані ЗАВЖДИ дорівнює реальній довжині
// сесії, бо рахується тим самим кодом):
//   tableNumber=N          -> buildTablePracticePool (кнопка детального екрана)
//   singleFact={a,b}       -> той самий факт кілька разів (кнопка
//                              "Потренувати цей приклад"/бейдж рядка)
//   інакше (обидва null)   -> buildOverviewPracticePool (кнопка головного екрана)
const SINGLE_FACT_REPEAT = 5;

const TITLE_BY_MODE = {
  weak: "Слабкі приклади",
  improve: "Приклади для покращення",
  review: "Тренування на закріплення",
};

// Логічна неузгодженість №4 технічного завдання: якщо режим НЕ складається
// виключно зі слабких прикладів (наприклад, туди потрапили ще й недостатньо
// перевірені), чесно кажемо про це підписом, а не називаємо все підряд
// "Слабкі приклади".
const BADGE_TEXT = "Персональне тренування";

// Дитині не показуємо технічні тіери/відсотки — лише дружнє, зрозуміле
// пояснення "навіщо саме цей приклад" (розділ 4.6).
const WHY_TEXT = {
  insufficient: "Цей приклад ще мало тренували",
  weak: "Цей приклад ще недостатньо закріплений",
  almost: "Цей приклад майже засвоєний — ще трохи практики",
  good: "Невелике повторення для впевненості",
  master: "Невелике повторення для впевненості",
};

function formatTableList(numbers) {
  if (numbers.length <= 1) return numbers.join("");
  return `${numbers.slice(0, -1).join(", ")} і ${numbers[numbers.length - 1]}`;
}

// Ранг тіера для порівняння "було -> стало" (розділ 5 тех. завдання для
// екрана завершення): "insufficient" — власна синтетична позначка
// buildTablePracticePool()/singleFact-пулу (не справжній тіер із
// mastery.js), рахуємо її нарівні з "untried" — обидва означають "ще
// немає реального статусу".
const TIER_RANK = { untried: 0, insufficient: 0, weak: 1, almost: 2, good: 3, master: 4 };

// Підзаголовок свята одразу під заголовком (розділ 2) — тон завжди
// підбадьорливий, ніколи не звинувачувальний, навіть при низькій точності.
function celebrationSubtitle(accuracy) {
  if (accuracy >= 100) return "Бездоганно! Усі відповіді правильні";
  if (accuracy >= 80) return "Чудовий результат! Ти добре попрацював";
  if (accuracy >= 60) return "Гарна робота! Ще трохи практики — і буде ще краще";
  return "Молодець, що тренуєшся! Спробуй ще раз, і результат покращиться";
}

export default function WeakPracticeScreen({ progress, tableNumber = null, singleFact = null, onAnswer, onReward, onExit, onReplay }) {
  const facts = progress.facts ?? {};

  // Пул питань і режим ("weak"/"improve"/"review"/"table"/"single")
  // рахуються ОДИН раз при вході (лениве ref-ініціалізування) — не на
  // кожен рендер і не після кожної відповіді (інакше "до/після" в кінці
  // не мало б сенсу).
  const poolRef = useRef(null);
  const modeRef = useRef(null);
  if (poolRef.current === null) {
    if (singleFact) {
      const { a, b } = singleFact;
      const pair = facts[`${a}x${b}`] ? `${a}x${b}` : `${b}x${a}`;
      const stat = facts[pair] ?? null;
      const attempts = stat ? (stat.correct ?? 0) + (stat.wrong ?? 0) : 0;
      const score = stat ? computeMastery(stat) : 0;
      const tier = attempts >= 3 ? masteryStatus(stat).tier : "insufficient";
      poolRef.current = Array.from({ length: SINGLE_FACT_REPEAT }, () => ({ pair, a, b, score, attempts, tier }));
      modeRef.current = "single";
    } else if (tableNumber != null) {
      poolRef.current = buildTablePracticePool(facts, tableNumber);
      modeRef.current = "table";
    } else {
      const { pool, mode } = buildOverviewPracticePool(facts);
      poolRef.current = pool;
      modeRef.current = mode;
    }
  }
  const pool = poolRef.current;
  const mode = modeRef.current;

  // Які таблиці показати в підсумку "було -> стало": лише обрану, якщо
  // тренували конкретну таблицю чи один факт (не всі 8 партнерів, яких
  // вона зачепила побічно) — інакше для практики з головного екрана
  // показуємо кожну таблицю, чиї факти реально трапились у пулі.
  const summaryTablesRef = useRef(null);
  if (summaryTablesRef.current === null) {
    summaryTablesRef.current = (tableNumber != null || singleFact)
      ? [tableNumber ?? singleFact.a]
      : [...new Set(pool.flatMap((f) => [f.a, f.b]))].sort((a, b) => a - b);
  }
  const summaryTables = summaryTablesRef.current;

  const beforeRef = useRef(null);
  if (beforeRef.current === null) {
    beforeRef.current = Object.fromEntries(summaryTables.map((n) => [n, tableMastery(facts, n)]));
  }

  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState(() => (pool.length ? buildFactQuestion(pool[0].a, pool[0].b) : null));
  const [feedback, setFeedback] = useState(null);
  const [hadWrongThisQuestion, setHadWrongThisQuestion] = useState(false);
  const [firstTryCorrectCount, setFirstTryCorrectCount] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [done, setDone] = useState(false);
  const questionStartRef = useRef(Date.now());
  // Які факти хоч раз завадили дитині цього тренування — для персональної
  // рекомендації на екрані завершення ("Радимо ще раз повторити N × M").
  const mistakePairsRef = useRef(new Set());

  // Немає жодного факту для тренування — дружнє повідомлення замість
  // порожнього/зламаного екрана (MyKnowledgeScreen.jsx і так ховає кнопку
  // в цьому випадку, це лишається запобіжником на випадок прямого виклику).
  if (!pool.length) {
    return (
      <div className="relative overflow-hidden min-h-dvh screen-in">
        <div className="center-vignette" />
        <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-16">
          <div className="mb-6">
            <TopBar onBack={onExit} title="Тренування" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-16">
            <span className="text-5xl">🌟</span>
            <h2 className="font-display gold-text text-xl font-extrabold">Поки що немає що повторити</h2>
            <p className="text-violet-200 text-sm max-w-xs">
              Спробуй трохи більше прикладів у грі — тоді тут з'являться ті, які варто підтренувати.
            </p>
            <button onClick={() => { playUiPrimary(); onExit(); }} className="next-challenge-button w-full py-4 rounded-2xl font-display font-extrabold text-lg mt-2">
              Гаразд
            </button>
          </div>
        </div>
      </div>
    );
  }

  const locked = feedback?.correct === true || feedback?.stage === 2;

  function advanceOrFinish(finalFirstTry, finalBestStreak) {
    const next = index + 1;
    if (next >= pool.length) {
      const coinGain = finalFirstTry * 2;
      const xpGain = finalFirstTry * 4;
      onReward?.(coinGain, xpGain);
      if (finalFirstTry > 0) playVictory();
      setFirstTryCorrectCount(finalFirstTry);
      setBestStreak(finalBestStreak);
      setDone(true);
      return;
    }
    setIndex(next);
    setQuestion(buildFactQuestion(pool[next].a, pool[next].b));
    setFeedback(null);
    setHadWrongThisQuestion(false);
    questionStartRef.current = Date.now();
  }

  function answer(option) {
    if (locked) return;
    const isCorrect = option === question.correct;
    const responseTimeMs = Date.now() - questionStartRef.current;
    onAnswer(question.pair, isCorrect, question.kind, responseTimeMs);
    questionStartRef.current = Date.now();

    if (isCorrect) {
      const newStreak = currentStreak + 1;
      // "Правильно з першої спроби" рахуємо лише якщо в ЦЬОМУ питанні ще
      // не було жодної помилки (розділ 4.5 — повторна спроба після
      // помилки лишається можливістю навчитись, але не "чистим" результатом).
      const finalFirstTry = firstTryCorrectCount + (hadWrongThisQuestion ? 0 : 1);
      const finalBestStreak = Math.max(bestStreak, newStreak);
      setCurrentStreak(newStreak);
      if (!hadWrongThisQuestion) setFirstTryCorrectCount(finalFirstTry);
      setBestStreak(finalBestStreak);
      setFeedback({ correct: true, chosen: option });
      playAttack();
      setTimeout(() => advanceOrFinish(finalFirstTry, finalBestStreak), 700);
      return;
    }

    setCurrentStreak(0);
    playHeartLost();
    mistakePairsRef.current.add(question.pair);
    if (!hadWrongThisQuestion) {
      // Перша помилка в цьому питанні (розділ 4.5): не переходимо далі
      // автоматично — даємо підказку й дозволяємо спробувати ще раз.
      setHadWrongThisQuestion(true);
      setFeedback({ correct: false, stage: 1, chosen: option, hint: explainFromPair(question.pair) });
    } else {
      // Друга помилка поспіль — показуємо повне пояснення і переходимо
      // далі лише після явного натискання "Продовжити" (не автоматично).
      setFeedback({ correct: false, stage: 2, chosen: option, explanation: explainFromPair(question.pair) });
    }
  }

  if (done) {
    // Рівень 1 — ЦІЛА таблиця (розділ 4 тех. завдання): показуємо і старе,
    // і нове значення разом із приростом, а не голе "було->стало" без
    // пояснення. delta===0 (округлення "з'їло" реальний прогрес) -> дружнє
    // формулювання замість "77% → 77%" (розділ 5).
    const totalAfter = summaryTables.map((n) => {
      const before = beforeRef.current[n];
      const after = tableMastery(progress.facts, n);
      const leveledUp = after.tier !== before.tier && after.score > before.score;
      return { n, before, after, leveledUp, delta: after.score - before.score };
    });

    // Рівень 2 — ОКРЕМИЙ приклад (розділ 4.7/4): "2 × 10: 54% → 63%".
    // Унікалізуємо пари, бо singleFact-режим повторює один і той самий
    // факт кілька разів. У підсумок "Покращені приклади" (розділ 4)
    // потрапляють лише ті, що РЕАЛЬНО покращились — не кожен факт із
    // пулу (інакше це були б випадкові картки, а не список покращень).
    const uniqueFacts = [...new Map(pool.map((f) => [f.pair, f])).values()];
    const factsAfter = uniqueFacts.map((f) => {
      const stat = progress.facts?.[f.pair] ?? null;
      const afterScore = stat ? computeMastery(stat) : 0;
      const afterStatus = masteryStatus(stat);
      const leveledUp = TIER_RANK[afterStatus.tier] > TIER_RANK[f.tier];
      return { ...f, afterScore, afterStatus, leveledUp };
    });
    const improvedFacts = factsAfter.filter((f) => f.afterScore > f.score);

    const accuracy = pool.length ? (firstTryCorrectCount / pool.length) * 100 : 0;
    const anyLeveledUp = totalAfter.some((t) => t.leveledUp) || improvedFacts.some((f) => f.leveledUp);

    // Розділ 6 — персональна рекомендація: пріоритет підвищення рівня >
    // ідеальний результат > конкретний факт, що заважав > загальна
    // підбадьорка. "mistakeFact" — найслабший ЗАРАЗ серед фактів, де
    // дитина хоч раз помилилась цього тренування.
    const mistakeFact = [...factsAfter]
      .filter((f) => mistakePairsRef.current.has(f.pair))
      .sort((a, b) => a.afterScore - b.afterScore)[0];
    let motivationText;
    if (anyLeveledUp) {
      motivationText = "Новий рівень засвоєння відкрито!";
    } else if (accuracy >= 100) {
      motivationText = mode === "single"
        ? "Чудово! Спробуй перевірити цей приклад ще раз завтра, щоб надійно його закріпити"
        : "Чудово! Спробуй перевірити ці приклади ще раз завтра, щоб надійно їх закріпити";
    } else if (mistakeFact) {
      motivationText = `Радимо ще раз повторити ${mistakeFact.a} × ${mistakeFact.b} — це допоможе краще його запам'ятати`;
    } else {
      motivationText = "Продовжуй у тому ж дусі — кожна практика наближає до нового рівня";
    }

    // Розділ 7/8 — не змушувати повторювати вже ідеально виконане:
    // 100% і не одна конкретна таблиця -> "Наступний приклад" (onReplay
    // все одно перебудує пул наново, і вже засвоєні факти природно
    // поступляться місцем іншим); 100% в режимі одного факту -> взагалі
    // ховаємо кнопку повтору, повернення до "Моїх знань" і так веде далі.
    const secondaryLabel = accuracy >= 100
      ? (mode === "single" ? null : "Наступний приклад")
      : accuracy >= 80
        ? "Закріпити ще раз"
        : "Потренувати ще раз";

    return (
      <div className="relative overflow-hidden min-h-dvh screen-in">
        <div className="center-vignette" />
        <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 sm:px-8 pt-8 pb-[max(20px,env(safe-area-inset-bottom))] flex flex-col items-center text-center gap-5">
          {/* 1. Святкова верхня частина */}
          <div className="knowledge-result-medallion relative">
            <span className="text-4xl knowledge-result-sparkle">✨</span>
            <span className="knowledge-result-twinkle knowledge-result-twinkle-1" aria-hidden="true">✦</span>
            <span className="knowledge-result-twinkle knowledge-result-twinkle-2" aria-hidden="true">✦</span>
          </div>
          <div className="knowledge-result-fade-up" style={{ "--kr-delay": "0.1s" }}>
            <h2 className="font-display gold-text text-3xl font-extrabold">Тренування завершено!</h2>
            <p className="font-body text-violet-100 text-sm mt-1.5 max-w-xs mx-auto">{celebrationSubtitle(accuracy)}</p>
          </div>

          {/* 2. Загальна статистика */}
          <div
            className="rpg-panel knowledge-result-fade-up rounded-2xl w-full grid grid-cols-3 divide-x divide-white/10 px-2 py-4"
            style={{ "--kr-delay": "0.22s" }}
          >
            <div className="flex flex-col items-center px-1.5">
              <span className="font-display font-extrabold text-xl sm:text-2xl gold-text">{firstTryCorrectCount} із {pool.length}</span>
              <span className="text-[11px] text-violet-200/70 mt-1 leading-tight">Правильно</span>
            </div>
            <div className="flex flex-col items-center px-1.5">
              <span className="font-display font-extrabold text-xl sm:text-2xl gold-text">{formatPercent(accuracy)}</span>
              <span className="text-[11px] text-violet-200/70 mt-1 leading-tight">Точність</span>
            </div>
            <div className="flex flex-col items-center px-1.5">
              <span className="font-display font-extrabold text-xl sm:text-2xl gold-text">{bestStreak}</span>
              <span className="text-[11px] text-violet-200/70 mt-1 leading-tight">Найкраща серія</span>
            </div>
          </div>

          {/* 3-4. Твій прогрес — таблиця(і) і покращені приклади в ОДНІЙ панелі */}
          <div className="w-full text-left knowledge-result-fade-up" style={{ "--kr-delay": "0.32s" }}>
            <h3 className="font-display font-bold text-base text-violet-50">Твій прогрес</h3>
            <p className="text-xs text-violet-200/70 mt-0.5 mb-3">Ось що покращилося після тренування</p>

            <div className="rpg-panel rounded-2xl px-4 py-4 flex flex-col gap-4">
              {totalAfter.map(({ n, before, after, leveledUp, delta }) => (
                <div key={n}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm text-violet-50">Таблиця на {n}</span>
                    <span className="font-display font-extrabold text-sm gold-text knowledge-score-transition">{formatPercent(after.score)}</span>
                  </div>
                  {delta === 0 ? (
                    <p className="text-xs text-violet-200/70 mt-1 mb-1.5">
                      {firstTryCorrectCount > 0 ? "Ще одна успішна відповідь наближає до наступного рівня" : "Прогрес закріплено"}
                    </p>
                  ) : (
                    <div className="flex items-center justify-between gap-2 mt-1 mb-1.5">
                      <span className="text-xs text-violet-200/60">Було {formatPercent(before.score)}</span>
                      <span className={`text-xs font-bold ${delta > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {delta > 0 ? "+" : ""}{Math.round(delta)}%
                      </span>
                    </div>
                  )}
                  <div className="knowledge-progress-track relative">
                    {delta !== 0 && (
                      <span className="knowledge-progress-marker" style={{ left: `${Math.max(0, Math.min(100, before.score))}%` }} />
                    )}
                    <div
                      className={`knowledge-progress-fill knowledge-fill-${after.tier} knowledge-fill-glow-edge`}
                      style={{ width: `${Math.max(0, Math.min(100, after.score))}%` }}
                    />
                  </div>
                  {leveledUp && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                      <ArtImage
                        src={`/assets/icons/knowledge/${after.file}.png`}
                        fallback={after.icon}
                        alt=""
                        className="w-4 h-4 object-contain inline-flex items-center justify-center knowledge-tier-glow"
                      />
                      Новий рівень: {after.label}!
                    </div>
                  )}
                </div>
              ))}

              {improvedFacts.length > 0 && (
                <div className="pt-1 border-t border-white/10 flex flex-col gap-3">
                  <h4 className="font-display font-bold text-xs text-violet-100 -mb-1">Покращені приклади</h4>
                  {improvedFacts.map((f) => (
                    <div key={f.pair}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-body text-sm text-violet-50">{f.a} × {f.b} = {f.a * f.b}</span>
                        <span className="font-display font-bold text-sm gold-text">{formatPercent(f.afterScore)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1 mb-1.5">
                        <span className="text-xs text-violet-200/60">Було {formatPercent(f.score)}</span>
                        <span className="text-xs font-bold text-emerald-300">+{Math.round(f.afterScore - f.score)}%</span>
                      </div>
                      <div className="knowledge-progress-track">
                        <div
                          className={`knowledge-progress-fill knowledge-fill-${f.afterStatus.tier} knowledge-fill-glow-edge`}
                          style={{ width: `${Math.max(0, Math.min(100, f.afterScore))}%` }}
                        />
                      </div>
                      {f.leveledUp && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                          <ArtImage
                            src={`/assets/icons/knowledge/${f.afterStatus.file}.png`}
                            fallback={f.afterStatus.icon}
                            alt=""
                            className="w-4 h-4 object-contain inline-flex items-center justify-center knowledge-tier-glow"
                          />
                          Новий статус: {f.afterStatus.label}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 6. Мотиваційне повідомлення */}
          <div className="knowledge-recommend-banner knowledge-result-fade-up rounded-xl px-3.5 py-2.5 text-sm font-semibold flex items-center gap-2 w-full text-left" style={{ "--kr-delay": "0.4s" }}>
            <span aria-hidden="true">💡</span>
            <span>{motivationText}</span>
          </div>

          {/* 7-8. Кнопки — головна золота дія першою, другорядна нижче */}
          <div className="w-full flex flex-col gap-2.5 mt-1">
            <button
              onClick={() => { playUiPrimary(); onExit(); }}
              className="knowledge-cta-button w-full py-3.5 rounded-2xl font-display font-extrabold text-lg text-indigo-950 min-h-[56px]"
            >
              Повернутися до "Моїх знань"
            </button>
            {secondaryLabel && onReplay && (
              <button
                onClick={() => { playUiPrimary(); onReplay(); }}
                className="knowledge-secondary-button w-full py-3.5 rounded-2xl font-display font-bold text-base min-h-[56px]"
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const title = mode === "single"
    ? `Приклад ${singleFact.a} × ${singleFact.b}`
    : mode === "table"
      ? `Таблиця на ${tableNumber}`
      : (TITLE_BY_MODE[mode] ?? "Персональне тренування");
  const showTablesList = (mode === "weak" || mode === "improve" || mode === "review") && summaryTables.length > 1;
  const whyText = WHY_TEXT[pool[index].tier] ?? "Невелике повторення для впевненості";

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />
      <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-16">
        <div className="mb-2">
          <TopBar onBack={() => { playUiBack(); onExit(); }} title={title} />
        </div>
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
          <span className="knowledge-badge-recommend">{BADGE_TEXT}</span>
          {showTablesList && (
            <span className="text-xs text-violet-200/70">Таблиці: {formatTableList(summaryTables)}</span>
          )}
        </div>

        <div
          className="flex items-center justify-center gap-1.5 mb-6"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={pool.length}
          aria-label={`Приклад ${index + 1} з ${pool.length}`}
        >
          {pool.map((_, i) => (
            <span
              key={i}
              className={`knowledge-pip ${i < index ? "knowledge-pip-done" : i === index ? "knowledge-pip-current" : "knowledge-pip-future"}`}
            />
          ))}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-3 w-full">
            <span className="text-xs font-semibold text-violet-200/60 uppercase tracking-wide">Обери правильну відповідь</span>
            <div className="quest-page knowledge-quest-page relative text-indigo-950 rounded-3xl px-8 py-9 max-w-full">
              <div className="font-display font-extrabold text-center text-5xl tracking-wide">{question.prompt}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 w-full">
            {question.options.map((opt) => {
              let style = "answer-btn hover:brightness-110";
              let disabled = false;
              if (feedback?.correct === true) {
                style = opt === question.correct ? "answer-btn-correct" : "answer-btn-dim opacity-50";
                disabled = true;
              } else if (feedback?.stage === 1) {
                style = opt === feedback.chosen ? "answer-btn-wrong-retry knowledge-shake" : "answer-btn hover:brightness-110";
              } else if (feedback?.stage === 2) {
                if (opt === question.correct) style = "answer-btn-correct";
                else if (opt === feedback.chosen) style = "answer-btn-wrong";
                else style = "answer-btn-dim opacity-50";
                disabled = true;
              }
              return (
                <button
                  key={opt}
                  disabled={disabled}
                  onClick={() => answer(opt)}
                  className={`font-display font-extrabold text-2xl text-white py-6 rounded-2xl transition active:scale-95 ${style}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="min-h-16 flex flex-col items-center gap-1.5">
            {feedback?.correct === true && (
              <div className="font-display font-bold text-sm text-center text-emerald-300">✦ Правильно! ✦</div>
            )}
            {feedback?.correct === false && feedback.stage === 1 && (
              <>
                <div className="font-display font-bold text-sm text-center text-rose-200">Спробуй ще раз</div>
                <p className="font-body text-xs text-amber-100 text-center leading-snug max-w-xs">{feedback.hint}</p>
              </>
            )}
            {feedback?.correct === false && feedback.stage === 2 && (
              <>
                <div className="font-display font-bold text-sm text-center text-rose-200">Ось як це порахувати</div>
                <p className="font-body text-xs text-amber-100 text-center leading-snug max-w-xs">{feedback.explanation}</p>
                <button
                  onClick={() => { playUiPrimary(); advanceOrFinish(firstTryCorrectCount, bestStreak); }}
                  className="knowledge-secondary-button rounded-xl px-5 py-2 text-sm font-display font-bold mt-1"
                >
                  Продовжити
                </button>
              </>
            )}
          </div>

          <div className="rpg-panel rounded-xl px-4 py-2.5 text-xs text-violet-200/80 text-center w-full">
            <span className="font-semibold text-violet-100">Навіщо цей приклад? </span>
            {whyText}
          </div>
        </div>
      </div>
    </div>
  );
}
