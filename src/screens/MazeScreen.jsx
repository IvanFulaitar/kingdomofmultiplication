import { useEffect, useRef, useState } from "react";
import { generatePracticeQuestion } from "../game/practice.js";
import { playCorrect, playWrong, playWin } from "../game/sound.js";
import ArtImage from "../components/ArtImage.jsx";
import ExitConfirmModal from "../components/ExitConfirmModal.jsx";

const STEPS = 8;
const COLS = 4;
const REWARD_COINS = 25;
const REWARD_XP = 30;

// Клітинки лабіринту розкладені змійкою (як настільна гра): парні ряди
// зліва направо, непарні — справа наліво, щоб шлях виглядав звивистим.
function cellStyle(i) {
  const row = Math.floor(i / COLS);
  const inRow = i % COLS;
  const col = row % 2 === 0 ? inRow : COLS - 1 - inRow;
  return { gridColumn: col + 1, gridRow: row + 1 };
}

function MazeHeart({ filled }) {
  return (
    <ArtImage
      src={filled ? "/assets/icons/ui/heart_full.png" : "/assets/icons/ui/heart_empty.png"}
      fallback={filled ? "❤️" : "🖤"}
      alt=""
      className={`battle-heart-icon object-contain ${filled ? "" : "opacity-50"}`}
    />
  );
}

export default function MazeScreen({ avatar, onBack, onComplete }) {
  const [step, setStep] = useState(0);
  const [lives, setLives] = useState(3);
  const [question, setQuestion] = useState(() => generatePracticeQuestion(null));
  const [feedback, setFeedback] = useState(null);
  const [failed, setFailed] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const exitConfirmRef = useRef(false);

  const done = step >= STEPS && !failed;

  useEffect(() => {
    exitConfirmRef.current = showExitConfirm;
  }, [showExitConfirm]);

  useEffect(() => {
    window.history.pushState({ activeAttempt: "maze" }, "");
    function handlePopState() {
      if (exitConfirmRef.current) {
        setShowExitConfirm(false);
      } else {
        setShowExitConfirm(true);
      }
      window.history.pushState({ activeAttempt: "maze" }, "");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (done) playWin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function handleAnswer(opt) {
    if (showExitConfirm || feedback || done || failed) return;
    const correct = opt === question.correct;
    setFeedback({ correct, chosen: opt });
    if (correct) playCorrect(); else playWrong();

    setTimeout(() => {
      if (correct) {
        const next = step + 1;
        setStep(next);
        if (next < STEPS) setQuestion(generatePracticeQuestion(question.pair));
      } else {
        const newLives = lives - 1;
        setLives(newLives);
        if (newLives <= 0) { setFailed(true); setFeedback(null); return; }
        setQuestion(generatePracticeQuestion(question.pair));
      }
      setFeedback(null);
    }, 650);
  }

  function retry() {
    setStep(0);
    setLives(3);
    setFailed(false);
    setQuestion(generatePracticeQuestion(null));
  }

  return (
    <div className={`relative overflow-hidden min-h-dvh screen-in ${showExitConfirm ? "attempt-paused" : ""}`}>
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-5 py-8 pb-14 min-h-dvh flex flex-col">
        <div className="battle-header">
          <button onClick={() => setShowExitConfirm(true)} aria-label="Назад" className="rpg-panel rpg-panel-gold w-11 h-11 rounded-xl flex items-center justify-center text-xl text-amber-100 active:scale-95 transition">←</button>
          <div className="rpg-panel rpg-panel-gold battle-title rounded-xl px-4 py-2 text-center">
            <div className="font-display gold-text font-extrabold text-base leading-tight truncate">✦ Лабіринт ✦</div>
            <div className="text-[11px] text-violet-200 font-semibold mt-0.5 truncate">Крок {Math.min(step + 1, STEPS)} з {STEPS}</div>
          </div>
          <div className="rpg-panel battle-lives rounded-xl px-2.5 py-2">
            {[0, 1, 2].map((i) => <MazeHeart key={i} filled={i < lives} />)}
          </div>
        </div>

        <div className="rpg-panel rpg-panel-gold rounded-3xl p-4 mt-4">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {Array.from({ length: STEPS }).map((_, i) => {
              const state = i < step ? "done" : i === step ? "current" : "future";
              const isExit = i === STEPS - 1;
              const cls =
                state === "future"
                  ? "badge-card-locked"
                  : state === "done"
                  ? "rpg-panel rpg-panel-gold"
                  : "rpg-panel rpg-panel-gold level-card-next";
              return (
                <div key={i} style={cellStyle(i)} className={`relative aspect-square rounded-xl flex items-center justify-center ${cls}`}>
                  {isExit && state !== "current" && (
                    <ArtImage src="/assets/icons/ui/chest.png" fallback="🚪" alt="" className="w-7 h-7 object-contain" />
                  )}
                  {state === "done" && !isExit && <span className="text-emerald-300 text-sm">✓</span>}
                  {state === "current" && (
                    <ArtImage
                      src={`/assets/avatars/${avatar}.png`}
                      fallback="🧙"
                      alt=""
                      className="w-[85%] h-[85%] object-contain gentle-bounce"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!done && !failed && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 mt-5">
            <div className="quest-page relative text-indigo-950 rounded-3xl px-8 py-9 max-w-full">
              <span className="absolute top-2 left-3 text-lg text-amber-700/30 font-display">×</span>
              <span className="absolute top-2 right-3 text-lg text-amber-700/30 font-display">?</span>
              <span className="absolute bottom-2 left-3 text-lg text-amber-700/30 font-display">−</span>
              <span className="absolute bottom-2 right-3 text-lg text-amber-700/30 font-display">+</span>
              <div className="text-xs text-center text-amber-800/70 font-semibold mb-1.5 tracking-wide">Розв'яжи, щоб зробити крок</div>
              <div className="font-display font-extrabold text-center tracking-wide text-5xl">{question.prompt}</div>
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

            <div className="h-6 feedback-pop" key={feedback ? (feedback.correct ? "ok" : "no") : "none"}>
              {feedback && (
                <div className={`font-display font-bold text-sm ${feedback.correct ? "text-emerald-300" : "text-rose-300"}`}>
                  {feedback.correct ? "✦ Крок уперед! ✦" : "Не той шлях, спробуй ще"}
                </div>
              )}
            </div>
          </div>
        )}

        {done && (
          <div className="rpg-panel rpg-panel-gold rounded-3xl p-5 mt-5 text-center screen-in">
            <div className="font-display gold-text font-extrabold text-xl mb-1">Ти знайшов вихід! 🎉</div>
            <div className="text-violet-200 text-sm mb-4">Нагорода: {REWARD_COINS} монет, {REWARD_XP} XP</div>
            <button onClick={() => onComplete(REWARD_COINS, REWARD_XP)} className="play-button w-full text-indigo-950 font-display font-extrabold text-lg py-3.5 rounded-2xl">
              Забрати нагороду
            </button>
          </div>
        )}

        {failed && (
          <div className="rpg-panel rounded-3xl p-5 mt-5 text-center screen-in">
            <div className="font-display coral-text font-extrabold text-xl mb-1">Життя закінчились</div>
            <div className="text-violet-200 text-sm mb-4">Спробуй пройти лабіринт ще раз — усе вийде!</div>
            <button onClick={retry} className="play-button w-full text-indigo-950 font-display font-extrabold text-lg py-3.5 rounded-2xl">
              Спробувати ще раз
            </button>
          </div>
        )}
      </div>

      {showExitConfirm && (
        <ExitConfirmModal
          modeType="training"
          levelName="Лабіринт"
          currentProgress={step}
          totalProgress={STEPS}
          destination="training"
          destinationLabel="Вийти до тренувань"
          onContinue={() => setShowExitConfirm(false)}
          onExit={onBack}
        />
      )}
    </div>
  );
}
