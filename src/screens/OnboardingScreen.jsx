import { useState, useRef } from "react";
import { generateQuestion, factsUsedIn } from "../game/generateQuestion.js";
import { playUiClick, playUiPrimary, playAttack, playEnemyHit, playHeartLost, playVictory } from "../game/sfx.js";
import ArtImage from "../components/ArtImage.jsx";

// launch-plan.md, розділ 4 "Повністю переробити перші 5 хвилин гри".
// Перший запуск нового гравця — 4 кроки: коротке знайомство, вибір
// навчальної впевненості (НЕ вік/особисті дані), коротка діагностика без
// покарань, і короткий інтерактивний tutorial-бій. Показується РІВНО один
// раз — App.jsx перевіряє progress.onboardingComplete і більше сюди не
// повертає (старі збереження мігрують як onboardingComplete=true, щоб
// нинішні гравці цього екрана взагалі не побачили).
//
// Свідомо СПРОЩЕНО відносно повного духу плану: результат діагностики НЕ
// перестрибує гравця далі по карті (карта й далі лінійна — рівень N
// вимагає завершення N-1), лише живить progress.facts тими самими даними,
// якими вже користується адаптивний вибір прикладів (generateQuestion.js/
// getWeakFacts). Це набагато безпечніше, ніж міняти логіку розблокування
// рівнів "заднім числом" без окремого дизайн-рішення.

const DIAGNOSTIC_QUESTIONS = 10;

const CONFIDENCE_LEVELS = [
  { id: "beginner", icon: "🌱", label: "Я тільки вчу таблицю множення", levelId: 1 },
  { id: "intermediate", icon: "🌿", label: "Я вже трохи знаю", levelId: 4 },
  { id: "confident", icon: "🔥", label: "Я хочу перевірити себе", levelId: 7 },
];

// Ті самі kind, що НЕ відповідають одному факту "AxB" (App.jsx, recordFact) —
// не включаємо їх у facts, зібрані під час діагностики.
const NON_FACT_KINDS = ["combined", "compare"];

function StepDot({ active, done }) {
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full inline-block transition ${
        done ? "bg-emerald-400" : active ? "bg-amber-300" : "bg-white/15"
      }`}
    />
  );
}

function Heart({ filled }) {
  return <span className={`text-xl ${filled ? "" : "opacity-30 grayscale"}`}>❤️</span>;
}

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState("welcome"); // welcome | confidence | diagnostic | tutorial
  const [confidence, setConfidence] = useState(null);

  // ---- Діагностика: 10 прикладів без покарань і часу ----
  const [dIndex, setDIndex] = useState(0);
  const [dQuestion, setDQuestion] = useState(null);
  const [dFeedback, setDFeedback] = useState(null);
  const [dCorrect, setDCorrect] = useState(0);
  const factsRef = useRef({});
  const recentRef = useRef([]);
  const lastPairRef = useRef(null);

  // ---- Tutorial-бій: 1 гарантовано простий приклад ----
  const [tLives, setTLives] = useState(3);
  const [tFeedback, setTFeedback] = useState(null);
  const [tWon, setTWon] = useState(false);
  const TUTORIAL_QUESTION = { prompt: "2 × 3 = ?", correct: 6, options: [5, 6, 7, 4] };

  function startConfidence() {
    playUiPrimary();
    setStep("confidence");
  }

  function chooseConfidence(level) {
    playUiClick();
    setConfidence(level);
    const q = generateQuestion(level.levelId, null, [], []);
    lastPairRef.current = q.pair;
    recentRef.current = factsUsedIn(q);
    setDQuestion(q);
    setStep("diagnostic");
  }

  function answerDiagnostic(option) {
    if (dFeedback) return;
    const correct = option === dQuestion.correct;
    setDFeedback({ correct, chosen: option });
    if (correct) setDCorrect((c) => c + 1);

    if (!NON_FACT_KINDS.includes(dQuestion.kind)) {
      const existing = factsRef.current[dQuestion.pair] ?? { correct: 0, wrong: 0 };
      const key = correct ? "correct" : "wrong";
      factsRef.current = { ...factsRef.current, [dQuestion.pair]: { ...existing, [key]: existing[key] + 1 } };
    }

    setTimeout(() => {
      const nextIndex = dIndex + 1;
      if (nextIndex >= DIAGNOSTIC_QUESTIONS) {
        setStep("tutorial");
        return;
      }
      const q = generateQuestion(confidence.levelId, lastPairRef.current, [], recentRef.current);
      lastPairRef.current = q.pair;
      recentRef.current = [...recentRef.current, ...factsUsedIn(q)].slice(-2);
      setDIndex(nextIndex);
      setDQuestion(q);
      setDFeedback(null);
    }, 550);
  }

  function answerTutorial(option) {
    if (tFeedback || tWon) return;
    const correct = option === TUTORIAL_QUESTION.correct;
    setTFeedback({ correct, chosen: option });
    if (correct) {
      playAttack();
      setTimeout(playEnemyHit, 90);
    } else {
      playHeartLost();
    }
    setTimeout(() => {
      if (correct) {
        setTWon(true);
        playVictory();
      } else {
        // Демо не повинно "провалюватись" насправді — це показ механіки,
        // а не справжній тест. Просто показуємо втрату серця й даємо
        // спробувати ще раз (мінімум 1, лишається видимим для наочності).
        setTLives((l) => Math.max(1, l - 1));
        setTFeedback(null);
      }
    }, 700);
  }

  function finish() {
    playUiPrimary();
    onComplete({ facts: factsRef.current, confidenceLevel: confidence?.id ?? "beginner" });
  }

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />
      <div className="relative z-10 max-w-md mx-auto px-6 py-10 min-h-dvh flex flex-col">
        {step === "welcome" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
            <ArtImage
              src="/assets/avatars/wizard.png"
              fallback="🧙"
              alt=""
              className="w-40 h-40 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
            />
            <div>
              <h1 className="font-display gold-text text-3xl font-extrabold tracking-wide mb-2">
                Ласкаво просимо до Королівства Математики!
              </h1>
              <p className="text-violet-200 text-base leading-relaxed">
                Розв'язуй завдання, перемагай охоронців і відкривай нові землі.
              </p>
            </div>
            <button onClick={startConfidence} className="next-challenge-button w-full py-4 rounded-2xl font-display font-extrabold text-lg mt-4">
              Почати пригоду
            </button>
          </div>
        )}

        {step === "confidence" && (
          <div className="flex-1 flex flex-col justify-center gap-5">
            <div className="text-center mb-2">
              <h2 className="font-display gold-text text-2xl font-extrabold mb-1.5">Наскільки добре ти знаєш множення?</h2>
              <p className="text-violet-200 text-sm">Це допоможе підібрати перші приклади якраз для тебе</p>
            </div>
            <div className="flex flex-col gap-3.5">
              {CONFIDENCE_LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => chooseConfidence(lvl)}
                  className="rpg-panel rpg-panel-gold hover:brightness-110 active:scale-[0.98] transition rounded-2xl p-4 flex items-center gap-4 text-left"
                >
                  <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 bg-indigo-950/50 border border-white/10">
                    {lvl.icon}
                  </span>
                  <span className="font-display font-bold text-base flex-1">{lvl.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "diagnostic" && dQuestion && (
          <div className="flex-1 flex flex-col">
            <div className="text-center mb-1">
              <span className="text-xs text-violet-200/80 font-semibold">Коротка перевірка — без штрафів</span>
            </div>
            <div className="flex justify-center gap-1.5 mt-2 mb-6">
              {Array.from({ length: DIAGNOSTIC_QUESTIONS }).map((_, i) => (
                <StepDot key={i} active={i === dIndex} done={i < dIndex} />
              ))}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="quest-page relative text-indigo-950 rounded-3xl px-8 py-9 max-w-full">
                <div className="text-xs text-center text-amber-800/70 font-semibold mb-1.5 tracking-wide">
                  Приклад {dIndex + 1} з {DIAGNOSTIC_QUESTIONS}
                </div>
                <div className={`font-display font-extrabold text-center tracking-wide ${dQuestion.prompt.length > 40 ? "text-lg" : dQuestion.prompt.length > 14 ? "text-3xl" : "text-5xl"}`}>
                  {dQuestion.prompt}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5 w-full">
                {dQuestion.options.map((opt) => {
                  let style = "answer-btn hover:brightness-110";
                  if (dFeedback) {
                    if (opt === dQuestion.correct) style = "answer-btn-correct";
                    else if (opt === dFeedback.chosen) style = "answer-btn-wrong";
                    else style = "answer-btn-dim opacity-50";
                  }
                  return (
                    <button
                      key={opt}
                      disabled={!!dFeedback}
                      onClick={() => answerDiagnostic(opt)}
                      className={`font-display font-extrabold text-2xl text-white py-6 rounded-2xl transition active:scale-95 ${style}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === "tutorial" && (
          <div className="flex-1 flex flex-col">
            {!tWon && (
              <>
                <div className="text-center mb-4">
                  <h2 className="font-display gold-text text-xl font-extrabold mb-1">Твій перший бій!</h2>
                  <p className="text-violet-200 text-sm">Обери правильну відповідь, щоб завдати шкоди</p>
                </div>
                <div className="rpg-panel rpg-panel-gold rounded-3xl p-5 mb-5 flex items-center justify-center gap-6">
                  <ArtImage
                    src="/assets/avatars/wizard.png"
                    fallback="🧙"
                    className={`w-20 h-20 object-contain ${tFeedback && !tFeedback.correct ? "shake-hit" : ""}`}
                  />
                  <span className="text-2xl opacity-50">⚔️</span>
                  <ArtImage
                    src="/assets/monsters/1.png"
                    fallback="🐛"
                    className={`w-20 h-20 object-contain ${tFeedback && tFeedback.correct ? "pop-hit" : ""}`}
                  />
                </div>
                <div className="flex justify-center gap-2 mb-6">
                  {[0, 1, 2].map((i) => <Heart key={i} filled={i < tLives} />)}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                  <div className="quest-page relative text-indigo-950 rounded-3xl px-8 py-9">
                    <div className="font-display font-extrabold text-center text-5xl tracking-wide">{TUTORIAL_QUESTION.prompt}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5 w-full">
                    {TUTORIAL_QUESTION.options.map((opt) => {
                      let style = "answer-btn hover:brightness-110";
                      if (tFeedback) {
                        if (opt === TUTORIAL_QUESTION.correct) style = "answer-btn-correct";
                        else if (opt === tFeedback.chosen) style = "answer-btn-wrong";
                        else style = "answer-btn-dim opacity-50";
                      }
                      return (
                        <button
                          key={opt}
                          disabled={!!tFeedback}
                          onClick={() => answerTutorial(opt)}
                          className={`font-display font-extrabold text-2xl text-white py-6 rounded-2xl transition active:scale-95 ${style}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {tWon && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
                <span className="text-6xl">🎉</span>
                <h2 className="font-display gold-text text-2xl font-extrabold">Перемога!</h2>
                <p className="text-violet-200 text-sm max-w-xs">
                  Ось так це працює: правильна відповідь завдає шкоди ворогу, а перемога дає зірки, монети й досвід.
                </p>
                <div className="rpg-panel rounded-2xl px-5 py-3 flex items-center gap-5 text-sm">
                  <span>⭐ +1</span>
                  <span>🪙 +15</span>
                  <span>✨ +30 XP</span>
                </div>
                <button onClick={finish} className="next-challenge-button w-full py-4 rounded-2xl font-display font-extrabold text-lg mt-2">
                  До Королівства!
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
