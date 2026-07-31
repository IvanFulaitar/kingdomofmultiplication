import { useEffect, useRef, useState } from "react";
import { AVATARS } from "../data/cosmetics.js";
import { LEVEL_META, REGIONS } from "../data/regions.js";
import { generateQuestion, QUESTIONS_PER_LEVEL, timeForLevel } from "../game/generateQuestion.js";
import { explainFromPair } from "../game/explainFact.js";
import { setMusicIntensity } from "../game/music.js";
import { preloadSfxGroup, playAttack, playEnemyHit, playHeartLost, playVictory, playDefeat, playModalOpen } from "../game/sfx.js";
import ArtImage from "../components/ArtImage.jsx";
import ExitConfirmModal from "../components/ExitConfirmModal.jsx";

function LifeHeart({ filled }) {
  return (
    <ArtImage
      src={filled ? "/assets/icons/ui/heart_full.png" : "/assets/icons/ui/heart_empty.png"}
      fallback={filled ? "❤️" : "🖤"}
      alt=""
      className={`battle-heart-icon object-contain flex items-center justify-center text-xl ${filled ? "drop-shadow-[0_0_6px_rgba(248,113,113,0.7)]" : "opacity-50"}`}
    />
  );
}

function ProgressDot({ state }) {
  const cls = state === "done" ? "progress-dot-done" : state === "current" ? "progress-dot-current" : "progress-dot-future";
  return <span className={`w-2.5 h-2.5 rounded-full inline-block ${cls}`} />;
}

export default function GameScreen({ levelId, avatar, weakFacts, onAnswer, onExit, onFinish, onGameOver }) {
  const timeLimit = timeForLevel(levelId);
  const heroIcon = AVATARS.find((av) => av.id === avatar)?.icon ?? "🧙";
  const enemy = LEVEL_META[levelId].enemy;
  const region = REGIONS.find((r) => r.levels.includes(levelId));

  const [qIndex, setQIndex] = useState(0);
  const [question, setQuestion] = useState(() => generateQuestion(levelId, null, weakFacts));
  const [lives, setLives] = useState(3);
  const [mistakes, setMistakes] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [feedback, setFeedback] = useState(null); // {correct: bool, chosen}
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const lastPairRef = useRef(question.pair);
  const answeredRef = useRef(false);
  const exitConfirmRef = useRef(false);

  // Той самий головний мотив грає й тут — лише трохи енергійніше (бій).
  useEffect(() => {
    setMusicIntensity("active");
    preloadSfxGroup("combat");
    return () => setMusicIntensity("calm");
  }, []);

  useEffect(() => {
    if (feedback || showExitConfirm) return;
    if (timeLeft <= 0) { handleAnswer(null); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, feedback, showExitConfirm]);

  useEffect(() => {
    exitConfirmRef.current = showExitConfirm;
  }, [showExitConfirm]);

  useEffect(() => {
    window.history.pushState({ activeAttempt: "game" }, "");
    function handlePopState() {
      if (exitConfirmRef.current) {
        setShowExitConfirm(false);
      } else {
        setShowExitConfirm(true);
      }
      window.history.pushState({ activeAttempt: "game" }, "");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function nextQuestion() {
    const nq = generateQuestion(levelId, lastPairRef.current, weakFacts);
    lastPairRef.current = nq.pair;
    setQuestion(nq);
    setTimeLeft(timeLimit);
    setFeedback(null);
    answeredRef.current = false;
  }

  function handleAnswer(option) {
    if (answeredRef.current) return;
    answeredRef.current = true;
    const correct = option === question.correct;
    // Коротке пояснення факту (launch-plan.md, розділ 6) — лише для
    // звичайних прикладів множення ("AxB"): не для складених ("combined")
    // і не для порівняння двох виразів ("compare", pair — не один факт).
    const explanation = !correct && !["combined", "compare"].includes(question.kind)
      ? explainFromPair(question.pair)
      : null;
    setFeedback({ correct, chosen: option, explanation });
    if (correct) setCorrectCount((c) => c + 1);
    onAnswer(question.pair, correct, question.kind);
    if (correct) {
      playAttack();
      setTimeout(playEnemyHit, 90);
    } else {
      playHeartLost();
    }

    // Помилку без пояснення видно й забуто за долю секунди — даємо трохи
    // більше часу прочитати розклад (2200мс) перед переходом далі.
    // Правильна відповідь так само швидка, як і раніше (700мс).
    setTimeout(() => {
      if (!correct) {
        const newLives = lives - 1;
        const newMistakes = mistakes + 1;
        setLives(newLives);
        setMistakes(newMistakes);
        if (newLives <= 0) { playDefeat(); onGameOver(correctCount); return; }
      }
      const nextIndex = qIndex + 1;
      if (nextIndex >= QUESTIONS_PER_LEVEL) {
        if (correct) playVictory();
        onFinish(correct ? mistakes : mistakes + 1);
      } else {
        setQIndex(nextIndex);
        nextQuestion();
      }
    }, correct ? 700 : 2200);
  }

  const meta = LEVEL_META[levelId];
  const enemyHealthPct = Math.max(0, 100 - (correctCount / QUESTIONS_PER_LEVEL) * 100);

  return (
    <div className={`relative overflow-hidden min-h-dvh flex flex-col screen-in ${showExitConfirm ? "attempt-paused" : ""}`}>
      {region && (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url(/assets/backgrounds/${region.id}.png)`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}
      <div className="battle-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-5 py-6 min-h-dvh flex flex-col w-full">
        <div className="battle-header">
          <button
            onClick={() => { playModalOpen(); setShowExitConfirm(true); }}
            aria-label="Назад"
            className="rpg-panel w-11 h-11 rounded-xl flex items-center justify-center text-xl text-amber-100 active:scale-95 transition"
          >
            ←
          </button>
          <div className="rpg-panel rpg-panel-gold battle-title rounded-xl px-4 py-2 text-center">
            <div className="font-display gold-text font-extrabold text-base leading-tight truncate">{meta.title}</div>
            <div className="text-[11px] text-violet-200 font-semibold mt-0.5 truncate">Завдання {qIndex + 1} з {QUESTIONS_PER_LEVEL}</div>
          </div>
          <div className="rpg-panel battle-lives rounded-xl px-2.5 py-2">
            {[0, 1, 2].map((i) => <LifeHeart key={i} filled={i < lives} />)}
          </div>
        </div>

        <div className="flex justify-center gap-1.5 mt-3.5">
          {Array.from({ length: QUESTIONS_PER_LEVEL }).map((_, i) => (
            <ProgressDot key={i} state={i < qIndex ? "done" : i === qIndex ? "current" : "future"} />
          ))}
        </div>

        <div className="rpg-panel rpg-panel-gold rounded-3xl p-5 mt-4 relative overflow-hidden">
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            <div className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 shrink-0">
              <div className="combatant-glow-hero" />
              <ArtImage
                src={`/assets/avatars/${avatar}.png`}
                fallback={heroIcon}
                className={`relative text-6xl w-full h-full object-contain flex items-center justify-center ${feedback && !feedback.correct ? "shake-hit" : ""}`}
              />
            </div>
            <span className="text-2xl opacity-50 shrink-0">⚔️</span>
            <div className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 shrink-0">
              <div className="combatant-glow-enemy" />
              <ArtImage
                key={levelId}
                src={`/assets/monsters/${levelId}.png`}
                fallback={enemy.icon}
                className={`relative text-6xl w-full h-full object-contain flex items-center justify-center ${feedback && feedback.correct ? "pop-hit" : ""}`}
              />
            </div>
          </div>

          <div className="rpg-panel rounded-lg px-3 py-1 mt-3 mx-auto w-fit text-xs font-display font-bold text-amber-100">
            {enemy.name}
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/50 mt-2.5 mb-1 px-0.5">
            <span>Здоров'я ворога</span>
            <span className="font-semibold text-rose-200">{Math.round(enemyHealthPct)}/100 HP</span>
          </div>
          <div className="h-3.5 hp-track rounded-full overflow-hidden">
            <div className="h-full hp-fill rounded-full transition-all duration-500" style={{ width: `${enemyHealthPct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 px-1">
          <span className="text-xs text-amber-300/80 shrink-0">⏱</span>
          <div className="h-2 timer-track rounded-full overflow-hidden flex-1">
            <div className="h-full timer-fill transition-all duration-1000 linear" style={{ width: `${(timeLeft / timeLimit) * 100}%` }} />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 mt-4">
          <div className="quest-page relative text-indigo-950 rounded-3xl px-8 py-9 max-w-full">
            <span className="absolute top-2 left-3 text-lg text-amber-700/30 font-display">×</span>
            <span className="absolute top-2 right-3 text-lg text-amber-700/30 font-display">+</span>
            <span className="absolute bottom-2 left-3 text-lg text-amber-700/30 font-display">−</span>
            <span className="absolute bottom-2 right-3 text-lg text-amber-700/30 font-display">?</span>
            <div className="text-xs text-center text-amber-800/70 font-semibold mb-1.5 tracking-wide">Обери правильну відповідь</div>
            <div
              className={`font-display font-extrabold text-center tracking-wide ${
                question.prompt.length > 40 ? "text-lg leading-snug" : question.prompt.length > 14 ? "text-3xl" : "text-5xl"
              }`}
            >
              {question.prompt}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 w-full">
            {question.options.map((opt) => {
              let style = "answer-btn hover:brightness-110";
              let mark = null;
              if (feedback) {
                if (opt === question.correct) { style = "answer-btn-correct"; mark = "✓"; }
                else if (opt === feedback.chosen) { style = "answer-btn-wrong"; mark = "✕"; }
                else style = "answer-btn-dim opacity-50";
              }
              return (
                <button
                  key={opt}
                  disabled={!!feedback}
                  onClick={() => handleAnswer(opt)}
                  className={`relative font-display font-extrabold text-2xl text-white py-6 rounded-2xl transition active:scale-95 ${style}`}
                >
                  {opt}
                  {mark && <span className="absolute top-1.5 right-2.5 text-base">{mark}</span>}
                </button>
              );
            })}
          </div>

          <div className={`feedback-pop ${feedback?.explanation ? "min-h-6" : "h-6"}`} key={feedback ? (feedback.correct ? "ok" : "no") : "none"}>
            {feedback && (
              <div className={`font-display font-bold text-sm text-center ${feedback.correct ? "text-emerald-300" : "text-rose-300"}`}>
                {feedback.correct ? "✦ Правильно! ✦" : "Неправильно"}
              </div>
            )}
            {feedback?.explanation && (
              <div className="mt-1.5 rpg-panel rounded-xl px-3.5 py-2 max-w-xs mx-auto">
                <p className="font-body text-xs text-amber-100 text-center leading-snug">{feedback.explanation}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {showExitConfirm && (
        <ExitConfirmModal
          modeType="story"
          levelName={meta.title}
          currentProgress={qIndex}
          totalProgress={QUESTIONS_PER_LEVEL}
          destination="map"
          destinationLabel="Вийти до карти"
          onContinue={() => setShowExitConfirm(false)}
          onExit={onExit}
        />
      )}
    </div>
  );
}
