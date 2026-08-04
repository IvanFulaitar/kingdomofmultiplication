import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { generateQuestion, factsUsedIn } from "../game/generateQuestion.js";
import { trackEvent } from "../game/analytics.js";
import {
  playUiClick, playUiPrimary, playAttack, playEnemyHit, playHeartLost,
  playVictory, playStar, playCoin, playXpGain,
} from "../game/sfx.js";
import ArtImage from "../components/ArtImage.jsx";
import StarIcon from "../components/StarIcon.jsx";
import LanguagePickerModal from "../components/LanguagePickerModal.jsx";
import { REGIONS } from "../data/regions.js";

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

// labelKey (не готовий рядок) — той самий принцип, що й у mastery.js/
// regions.js: цей масив обчислюється один раз при завантаженні модуля.
const CONFIDENCE_LEVELS = [
  { id: "beginner", icon: "🌱", labelKey: "confidenceBeginner", levelId: 1 },
  { id: "intermediate", icon: "🌿", labelKey: "confidenceIntermediate", levelId: 4 },
  { id: "confident", icon: "🔥", labelKey: "confidenceConfident", levelId: 7 },
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
  const { t } = useTranslation(["onboarding", "regions"]);
  const [step, setStep] = useState("welcome"); // welcome | confidence | diagnostic | tutorial
  // Компактний перемикач мови — лише на першому екрані (розділ 5 брифу
  // локалізації), щоб дитина могла виправити автовизначену мову ще ДО
  // проходження навчання.
  const [langPickerOpen, setLangPickerOpen] = useState(false);
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
  // Захист від подвійного нарахування нагороди (розділ 6 брифу) —
  // подвійний тап/клік по "ПОЧАТИ ПРИГОДУ" не повинен викликати onComplete
  // двічі. Перезавантаження сторінки після завершення захищене окремо, на
  // рівні App.jsx: progress.onboardingComplete=true більше не пускає сюди.
  const [finishing, setFinishing] = useState(false);
  const TUTORIAL_QUESTION = { prompt: "2 × 3 = ?", correct: 6, options: [5, 6, 7, 4] };

  // Короткий каскад звуків нагороди (розділ 10 брифу) — зірка, монета, XP
  // одна за одною, синхронно з появою відповідних карток (--kr-delay
  // нижче в JSX). playVictory() уже приглушує музику сам (music.js
  // duckMusic через IMPORTANT-список у sfx.js) — тут лише додаткові
  // короткі акценти, без повторного приглушення.
  useEffect(() => {
    if (!tWon) return;
    const timers = [
      setTimeout(playStar, 380),
      setTimeout(playCoin, 520),
      setTimeout(playXpGain, 660),
    ];
    return () => timers.forEach(clearTimeout);
  }, [tWon]);

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
        trackEvent("diagnostic_completed", { correct: dCorrect + (correct ? 1 : 0), total: DIAGNOSTIC_QUESTIONS });
        trackEvent("tutorial_started");
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
        trackEvent("tutorial_completed");
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
    if (finishing) return; // подвійний тап — ігноруємо, нагорода вже в дорозі
    setFinishing(true);
    playUiPrimary();
    onComplete({ facts: factsRef.current, confidenceLevel: confidence?.id ?? "beginner" });
  }

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />
      {step === "welcome" && (
        <button
          type="button"
          onClick={() => { playUiClick(); setLangPickerOpen(true); }}
          aria-label="Language / Мова / Język"
          className="system-icon-button rpg-panel absolute z-30 w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ top: "max(1rem, env(safe-area-inset-top))", right: "max(1.25rem, env(safe-area-inset-right))" }}
        >
          <ArtImage
            src="/assets/icons/ui/globe.png"
            fallback="🌐"
            alt=""
            className="system-icon-glow w-8 h-8 object-contain flex items-center justify-center text-base"
          />
        </button>
      )}
      {langPickerOpen && <LanguagePickerModal onClose={() => setLangPickerOpen(false)} />}
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
                {t("onboarding:welcomeTitle")}
              </h1>
              <p className="text-violet-200 text-base leading-relaxed">
                {t("onboarding:welcomeSubtitle")}
              </p>
            </div>
            <button onClick={startConfidence} className="next-challenge-button w-full py-4 rounded-2xl font-display font-extrabold text-lg mt-4">
              {t("onboarding:startAdventure")}
            </button>
          </div>
        )}

        {step === "confidence" && (
          <div className="flex-1 flex flex-col justify-center gap-5">
            <div className="text-center mb-2">
              <h2 className="font-display gold-text text-2xl font-extrabold mb-1.5">{t("onboarding:confidenceTitle")}</h2>
              <p className="text-violet-200 text-sm">{t("onboarding:confidenceSubtitle")}</p>
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
                  <span className="font-display font-bold text-base flex-1">{t(`onboarding:${lvl.labelKey}`)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "diagnostic" && dQuestion && (
          <div className="flex-1 flex flex-col">
            <div className="text-center mb-1">
              <span className="text-xs text-violet-200/80 font-semibold">{t("onboarding:diagnosticBadge")}</span>
            </div>
            <div className="flex justify-center gap-1.5 mt-2 mb-6">
              {Array.from({ length: DIAGNOSTIC_QUESTIONS }).map((_, i) => (
                <StepDot key={i} active={i === dIndex} done={i < dIndex} />
              ))}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="quest-page relative text-indigo-950 rounded-3xl px-8 py-9 max-w-full">
                <div className="text-xs text-center text-amber-800/70 font-semibold mb-1.5 tracking-wide">
                  {t("onboarding:diagnosticProgress", { current: dIndex + 1, total: DIAGNOSTIC_QUESTIONS })}
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
                  <h2 className="font-display gold-text text-xl font-extrabold mb-1">{t("onboarding:tutorialTitle")}</h2>
                  <p className="text-violet-200 text-sm">{t("onboarding:tutorialSubtitle")}</p>
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
              <div className="flex-1 flex flex-col items-center text-center gap-5 py-2">
                {/* 1. Святкова fantasy-ілюстрація — реальна іконка (не emoji),
                    у тому самому круглому медальйоні, що й на екрані
                    завершення тренування "Мої знання" (перевикористано, не
                    вигадано заново). */}
                <div className="knowledge-result-medallion relative">
                  <ArtImage
                    src="/assets/icons/ui/trophy.png"
                    fallback="🏆"
                    alt=""
                    className="w-10 h-10 object-contain flex items-center justify-center text-4xl"
                  />
                  <span className="knowledge-result-twinkle knowledge-result-twinkle-1" aria-hidden="true">✦</span>
                  <span className="knowledge-result-twinkle knowledge-result-twinkle-2" aria-hidden="true">✦</span>
                </div>

                {/* 2-3. Заголовок + підзаголовок + коротке пояснення (2 рядки) */}
                <div className="knowledge-result-fade-up" style={{ "--kr-delay": "0.1s" }}>
                  <h2 className="font-display gold-text text-3xl font-extrabold">{t("onboarding:doneTitle")}</h2>
                  <p className="font-body text-violet-100 text-base font-semibold mt-1.5">{t("onboarding:doneSubtitle")}</p>
                  <p className="font-body text-violet-200/80 text-sm mt-1.5 max-w-xs mx-auto leading-relaxed">
                    {t("onboarding:doneBody")}
                  </p>
                </div>

                {/* Другорядний цикл гри в 3 коротких кроки — не перевантажує
                    екран, короткі однослівні підписи, щоб рядок вміщався й
                    на 320px. */}
                <div
                  className="knowledge-result-fade-up flex items-center justify-center gap-2"
                  style={{ "--kr-delay": "0.18s" }}
                >
                  <div className="flex flex-col items-center gap-1 w-[72px]">
                    <ArtImage src="/assets/icons/ui/book.png" fallback="📖" alt="" className="w-7 h-7 object-contain flex items-center justify-center text-xl" />
                    <span className="text-[11px] font-semibold text-violet-200/80 leading-tight">{t("onboarding:cycleStep1")}</span>
                  </div>
                  <span className="text-amber-300/70 text-sm -mt-4" aria-hidden="true">→</span>
                  <div className="flex flex-col items-center gap-1 w-[72px]">
                    <StarIcon filled />
                    <span className="text-[11px] font-semibold text-violet-200/80 leading-tight">{t("onboarding:cycleStep2")}</span>
                  </div>
                  <span className="text-amber-300/70 text-sm -mt-4" aria-hidden="true">→</span>
                  <div className="flex flex-col items-center gap-1 w-[72px]">
                    <ArtImage src="/assets/icons/ui/map_scroll.png" fallback="🗺️" alt="" className="w-7 h-7 object-contain flex items-center justify-center text-xl" />
                    <span className="text-[11px] font-semibold text-violet-200/80 leading-tight">{t("onboarding:cycleStep3")}</span>
                  </div>
                </div>

                {/* 4. Перша нагорода — три симетричні картки, справжні
                    іконки (StarIcon/coin.png), назви текстом (не лише
                    іконка), як і всюди в грі. */}
                <div className="w-full knowledge-result-fade-up" style={{ "--kr-delay": "0.28s" }}>
                  <h3 className="font-display font-bold text-sm text-violet-100 mb-2">{t("onboarding:firstRewardTitle")}</h3>
                  <div className="rpg-panel rounded-2xl w-full grid grid-cols-3 divide-x divide-white/10 px-2 py-4">
                    <div className="flex flex-col items-center px-1.5 gap-1">
                      <StarIcon filled />
                      <span className="font-display font-extrabold text-xl gold-text">+1</span>
                      <span className="text-[11px] text-violet-200/70 leading-tight">{t("onboarding:rewardStar")}</span>
                    </div>
                    <div className="flex flex-col items-center px-1.5 gap-1">
                      <ArtImage src="/assets/icons/ui/coin.png" fallback="🪙" alt="" className="w-6 h-6 object-contain flex items-center justify-center" />
                      <span className="font-display font-extrabold text-xl gold-text">+15</span>
                      <span className="text-[11px] text-violet-200/70 leading-tight">{t("onboarding:rewardCoins")}</span>
                    </div>
                    <div className="flex flex-col items-center px-1.5 gap-1">
                      <span className="text-xl" aria-hidden="true">✨</span>
                      <span className="font-display font-extrabold text-xl gold-text">+30</span>
                      <span className="text-[11px] text-violet-200/70 leading-tight">{t("onboarding:rewardXp")}</span>
                    </div>
                  </div>
                </div>

                {/* 5. Відкриття першого регіону — назва береться з REGIONS
                    (data/regions.js), не хардкодиться окремим текстом. */}
                <div
                  className="rpg-panel rpg-panel-emerald knowledge-result-fade-up rounded-2xl w-full px-4 py-3 flex items-center gap-3 text-left"
                  style={{ "--kr-delay": "0.36s" }}
                >
                  <ArtImage
                    src="/assets/backgrounds/A.png"
                    fallback={REGIONS[0].icon}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover shrink-0 text-2xl flex items-center justify-center"
                  />
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-emerald-200">{t("onboarding:regionUnlocked", { name: t(`regions:${REGIONS[0].nameKey}`) })}</p>
                    <p className="text-xs text-violet-200/70 mt-0.5">{t("onboarding:regionUnlockedSubtitle")}</p>
                  </div>
                </div>

                {/* 6. Головна дія — єдина кнопка екрана, з одноразовим
                    золотим pulse (не зациклюється, prefers-reduced-motion
                    вимикає). */}
                <div className="w-full knowledge-result-fade-up mt-1" style={{ "--kr-delay": "0.46s" }}>
                  <button
                    onClick={finish}
                    disabled={finishing}
                    aria-label={t("onboarding:finishAria")}
                    className="next-challenge-button onboarding-cta-pulse w-full py-4 rounded-2xl font-display font-extrabold text-xl min-h-[64px] disabled:opacity-80 disabled:pointer-events-none"
                    style={{ animationDelay: "0.46s" }}
                  >
                    {t("onboarding:finishButton")}
                  </button>
                  <p className="text-xs text-violet-300/70 mt-2">{t("onboarding:finishHint")}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
