import { useRef, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import ArtImage from "../components/ArtImage.jsx";
import { buildFactQuestion } from "../game/generateQuestion.js";
import { explainFromPair } from "../game/explainFact.js";
import { weakestFacts, tableMastery, tableFacts } from "../game/mastery.js";
import { playUiPrimary, playUiBack, playAttack, playHeartLost, playVictory } from "../game/sfx.js";

// launch-plan.md, розділ 5, технічне завдання "Мої знання" розділ 8 —
// "Потренувати слабкі приклади" / "Потренувати таблицю на N": коротке
// (5-10 прикладів) прицільне тренування САМЕ слабких фактів, а не звичайний
// випадковий добір. Викликається з MyKnowledgeScreen.jsx (і як внутрішній
// "режим" того самого екрана, не окремий App.jsx screen — так по завершенні
// природно повертаємось туди ж, звідки прийшли: до огляду чи до конкретної
// таблиці).
//
// tableNumber===null -> пул з УСІХ таблиць (кнопка на головному екрані);
// tableNumber=N -> пул лише з фактів таблиці на N (кнопка на детальному
// екрані). В обох випадках weakestFacts() уже виключає ще не вивчені факти
// (<3 спроб) — розділ 8: "не включати теми, яких дитина ще не вивчала".
const POOL_LIMIT_ALL = 10;
const POOL_LIMIT_TABLE = 8;

export default function WeakPracticeScreen({ progress, tableNumber = null, onAnswer, onReward, onExit }) {
  const facts = progress.facts ?? {};

  // Пул питань і "знімок ДО" рахуються ОДИН раз при вході (лениве
  // ref-ініціалізування) — не на кожен рендер, і не після кожної відповіді
  // (інакше "до/після" порівняння в кінці не мало б сенсу).
  const poolRef = useRef(null);
  if (poolRef.current === null) {
    const pairs = tableNumber
      ? tableFacts(facts, tableNumber).filter((e) => e.stat).map((e) => e.pair)
      : null;
    poolRef.current = weakestFacts(facts, {
      pairs,
      limit: tableNumber ? POOL_LIMIT_TABLE : POOL_LIMIT_ALL,
    });
  }
  const pool = poolRef.current;

  // Які таблиці показати в підсумку "було -> стало": лише обрану, якщо
  // тренували конкретну таблицю (не всі 8 партнерів, яких вона зачепила
  // побічно) — інакше для практики з головного екрана показуємо кожну
  // таблицю, чиї факти реально трапились у пулі.
  const summaryTablesRef = useRef(null);
  if (summaryTablesRef.current === null) {
    summaryTablesRef.current = tableNumber
      ? [tableNumber]
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
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const questionStartRef = useRef(Date.now());

  // Немає жодного слабкого (але вже вивченого) факту — або дитина ще геть
  // нічого не пробувала, або вже все добре засвоєно. Дружнє повідомлення
  // замість порожнього/зламаного екрана (MyKnowledgeScreen.jsx і так ховає
  // кнопку в цьому випадку, але цей запобіжник лишається на випадок прямого
  // виклику чи зміни даних між кліком і рендером).
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

  function answer(option) {
    if (feedback || done) return;
    const correct = option === question.correct;
    const responseTimeMs = Date.now() - questionStartRef.current;
    const explanation = !correct ? explainFromPair(question.pair) : null;
    // "correctCount" зі стану оновлюється через функціональну форму (c=>c+1),
    // тож саме воно завжди точне для відображення. Але замикання нижче,
    // всередині setTimeout, бачить ЗАСТАРІЛЕ значення "correctCount" з
    // рендера, у якому було створено answer() — тому для підрахунку
    // нагороди на останньому питанні рахуємо власну, свіжу суму тут-таки.
    const finalCorrectCount = correctCount + (correct ? 1 : 0);
    setFeedback({ correct, chosen: option, explanation });
    if (correct) {
      setCorrectCount((c) => c + 1);
      playAttack();
    } else {
      playHeartLost();
    }
    onAnswer(question.pair, correct, question.kind, responseTimeMs);

    setTimeout(() => {
      const next = index + 1;
      if (next >= pool.length) {
        // Невелика, але реальна нагорода за коротке тренування — той самий
        // rewardPractice(), яким уже користуються Пам'ять/Лабіринт/Перегони
        // (pairsFound не передаємо — це поле не про це тренування).
        const coinGain = finalCorrectCount * 2;
        const xpGain = finalCorrectCount * 4;
        onReward?.(coinGain, xpGain);
        if (finalCorrectCount > 0) playVictory();
        setDone(true);
        return;
      }
      setIndex(next);
      setQuestion(buildFactQuestion(pool[next].a, pool[next].b));
      setFeedback(null);
      questionStartRef.current = Date.now();
    }, explanation ? 1500 : 700);
  }

  if (done) {
    const totalAfter = summaryTables.map((n) => {
      const before = beforeRef.current[n];
      const after = tableMastery(progress.facts, n);
      const leveledUp = after.tier !== before.tier && after.score > before.score;
      return { n, before, after, leveledUp };
    });

    return (
      <div className="relative overflow-hidden min-h-dvh screen-in">
        <div className="center-vignette" />
        <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-16 flex flex-col items-center text-center gap-5">
          <span className="text-6xl knowledge-result-sparkle">✨</span>
          <h2 className="font-display gold-text text-2xl font-extrabold">Тренування завершено!</h2>
          <p className="text-violet-200 text-sm">
            Правильно: {correctCount} із {pool.length}
          </p>

          <div className="w-full flex flex-col gap-2.5">
            {totalAfter.map(({ n, before, after, leveledUp }) => (
              <div key={n} className="rpg-panel rounded-xl px-4 py-3 text-left">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display font-bold text-sm">Таблиця на {n}</span>
                  <span className="font-display font-extrabold text-sm gold-text knowledge-score-transition">
                    {before.score}% → {after.score}%
                  </span>
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
          </div>

          <button onClick={() => { playUiPrimary(); onExit(); }} className="next-challenge-button w-full py-4 rounded-2xl font-display font-extrabold text-lg mt-2">
            До "Моїх знань"
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />
      <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-16">
        <div className="mb-6">
          <TopBar onBack={() => { playUiBack(); onExit(); }} title={tableNumber ? `Таблиця на ${tableNumber}` : "Слабкі приклади"} />
        </div>

        <div className="text-center mb-1">
          <span className="text-xs text-violet-200/80 font-semibold">Приклад {index + 1} з {pool.length}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-indigo-950/60 border border-white/10 overflow-hidden mb-6">
          <div
            className="h-full knowledge-quiz-progress-fill transition-all"
            style={{ width: `${((index + (feedback ? 1 : 0)) / pool.length) * 100}%` }}
          />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="quest-page relative text-indigo-950 rounded-3xl px-8 py-9 max-w-full">
            <div className="font-display font-extrabold text-center text-5xl tracking-wide">{question.prompt}</div>
          </div>
          <div className="grid grid-cols-2 gap-3.5 w-full">
            {question.options.map((opt) => {
              let style = "answer-btn hover:brightness-110";
              if (feedback) {
                if (opt === question.correct) style = "answer-btn-correct";
                else if (opt === feedback.chosen) style = "answer-btn-wrong";
                else style = "answer-btn-dim opacity-50";
              }
              return (
                <button
                  key={opt}
                  disabled={!!feedback}
                  onClick={() => answer(opt)}
                  className={`font-display font-extrabold text-2xl text-white py-6 rounded-2xl transition active:scale-95 ${style}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <div className={feedback?.explanation ? "min-h-10" : "h-6"}>
            {feedback && (
              <div className={`font-display font-bold text-sm text-center ${feedback.correct ? "text-emerald-300" : "text-rose-300"}`}>
                {feedback.correct ? "✦ Правильно! ✦" : "Неправильно"}
              </div>
            )}
            {feedback?.explanation && (
              <p className="font-body text-xs text-amber-100 text-center leading-snug mt-1 max-w-xs">{feedback.explanation}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
