import { useEffect, useRef, useState } from "react";
import { AVATARS } from "../data/cosmetics.js";
import { generatePracticeQuestion } from "../game/practice.js";
import { rand } from "../game/random.js";
import { playCorrect, playWrong, playWin } from "../game/sound.js";
import ArtImage from "../components/ArtImage.jsx";
import ExitConfirmModal from "../components/ExitConfirmModal.jsx";

const MAX_ROUNDS = 7;
const TIME_LIMIT = 6;
const FINISH = 100;

const RIVALS = [
  { id: "rivalA", name: "Їжак-бешкетник", img: "/assets/monsters/2.png", fallback: "🦔", fillClass: "hp-fill" },
  { id: "rivalB", name: "Гірський яструб", img: "/assets/monsters/4.png", fallback: "🦅", fillClass: "race-fill-teal" },
];

// "Гумова" логіка наздоганяння (як у гоночних іграх): що більше гравець
// відривається — то швидше суперник підтягується; якщо гравець відстає —
// суперник трохи сповільнюється. Без цього перегони або вигравались "в
// одну хвіртку" (сильний гравець), або були б безнадійними (слабкий).
function rivalGain([baseMin, baseMax], gap) {
  const catchUp = Math.max(-6, Math.min(14, gap * 0.35));
  const min = Math.max(4, baseMin + catchUp);
  const max = Math.max(min + 2, baseMax + catchUp);
  return rand(Math.round(min), Math.round(max));
}

function Lane({ name, imgSrc, fallback, pct, fillClass, highlight }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-[11px] text-white/60 mb-1 px-0.5">
        <span className={`font-semibold ${highlight ? "text-amber-200" : ""}`}>{name}</span>
        <span>{Math.min(100, Math.round(pct))}%</span>
      </div>
      <div className="h-6 xp-track rounded-full overflow-hidden relative">
        <div className={`h-full ${fillClass} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, pct)}%` }} />
        <div className="race-runner" style={{ left: `${Math.min(96, pct)}%` }}>
          <ArtImage src={imgSrc} fallback={fallback} alt="" className="w-6 h-6 object-contain drop-shadow-[0_0_4px_rgba(0,0,0,0.6)]" />
        </div>
      </div>
    </div>
  );
}

export default function RaceScreen({ avatar, onBack, onComplete }) {
  const heroIcon = AVATARS.find((av) => av.id === avatar)?.icon ?? "🧙";

  const [round, setRound] = useState(0);
  const [positions, setPositions] = useState({ player: 0, rivalA: 0, rivalB: 0 });
  const [question, setQuestion] = useState(() => generatePracticeQuestion(null));
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [finished, setFinished] = useState(false);
  const [placement, setPlacement] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const answeredRef = useRef(false);
  const exitConfirmRef = useRef(false);

  useEffect(() => {
    exitConfirmRef.current = showExitConfirm;
  }, [showExitConfirm]);

  useEffect(() => {
    window.history.pushState({ activeAttempt: "race" }, "");
    function handlePopState() {
      if (exitConfirmRef.current) {
        setShowExitConfirm(false);
      } else {
        setShowExitConfirm(true);
      }
      window.history.pushState({ activeAttempt: "race" }, "");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (feedback || finished || showExitConfirm) return;
    if (timeLeft <= 0) { handleAnswer(null); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, feedback, finished, showExitConfirm]);

  function handleAnswer(option) {
    if (answeredRef.current || finished) return;
    answeredRef.current = true;
    const correct = option === question.correct;
    const fast = timeLeft > TIME_LIMIT / 2;
    setFeedback({ correct, chosen: option });
    if (correct) playCorrect(); else playWrong();

    const playerGain = correct ? (fast ? 22 : 15) : 0;
    const gapA = positions.player - positions.rivalA;
    const gapB = positions.player - positions.rivalB;
    const nextPositions = {
      player: Math.min(FINISH, positions.player + playerGain),
      rivalA: Math.min(FINISH, positions.rivalA + rivalGain([10, 18], gapA)),
      rivalB: Math.min(FINISH, positions.rivalB + rivalGain([8, 16], gapB)),
    };
    setPositions(nextPositions);

    setTimeout(() => {
      const nextRound = round + 1;
      const raceOver = nextPositions.player >= FINISH || nextPositions.rivalA >= FINISH || nextPositions.rivalB >= FINISH || nextRound >= MAX_ROUNDS;
      if (raceOver) {
        const ranked = [
          { id: "player", dist: nextPositions.player },
          { id: "rivalA", dist: nextPositions.rivalA },
          { id: "rivalB", dist: nextPositions.rivalB },
        ].sort((a, b) => b.dist - a.dist);
        const place = ranked.findIndex((r) => r.id === "player") + 1;
        setPlacement(place);
        setFinished(true);
        if (place === 1) playWin();
        return;
      }
      setRound(nextRound);
      setQuestion(generatePracticeQuestion(question.pair));
      setTimeLeft(TIME_LIMIT);
      setFeedback(null);
      answeredRef.current = false;
    }, 600);
  }

  function retry() {
    setRound(0);
    setPositions({ player: 0, rivalA: 0, rivalB: 0 });
    setQuestion(generatePracticeQuestion(null));
    setTimeLeft(TIME_LIMIT);
    setFeedback(null);
    setFinished(false);
    setPlacement(null);
    answeredRef.current = false;
  }

  const reward = placement === 1 ? { coins: 40, xp: 40 } : placement === 2 ? { coins: 20, xp: 20 } : { coins: 10, xp: 10 };
  const placementText = placement === 1 ? "🥇 Ти прийшов першим!" : placement === 2 ? "🥈 Друге місце!" : "🥉 Третє місце";

  return (
    <div className={`relative overflow-hidden min-h-dvh screen-in ${showExitConfirm ? "attempt-paused" : ""}`}>
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-5 py-8 pb-14 min-h-dvh flex flex-col">
        <div className="battle-header">
          <button onClick={() => setShowExitConfirm(true)} aria-label="Назад" className="rpg-panel rpg-panel-gold w-11 h-11 rounded-xl flex items-center justify-center text-xl text-amber-100 active:scale-95 transition">←</button>
          <div className="rpg-panel rpg-panel-gold battle-title rounded-xl px-4 py-2 text-center">
            <div className="font-display gold-text font-extrabold text-base leading-tight truncate">✦ Перегони ✦</div>
            <div className="text-[11px] text-violet-200 font-semibold mt-0.5 truncate">Раунд {Math.min(round + 1, MAX_ROUNDS)} з {MAX_ROUNDS}</div>
          </div>
          <div className="rpg-panel rounded-xl px-2.5 py-2 flex items-center justify-center text-lg shrink-0">🏁</div>
        </div>

        <div className="rpg-panel rpg-panel-gold rounded-3xl p-4 mt-4">
          <Lane name="Ти" imgSrc={`/assets/avatars/${avatar}.png`} fallback={heroIcon} pct={positions.player} fillClass="xp-fill" highlight />
          {RIVALS.map((r) => (
            <Lane key={r.id} name={r.name} imgSrc={r.img} fallback={r.fallback} pct={positions[r.id]} fillClass={r.fillClass} />
          ))}
        </div>

        {!finished && (
          <>
            <div className="flex items-center gap-2 mt-3 px-1">
              <span className="text-xs text-amber-300/80 shrink-0">⏱</span>
              <div className="h-2 timer-track rounded-full overflow-hidden flex-1">
                <div className="h-full timer-fill transition-all duration-1000 linear" style={{ width: `${(timeLeft / TIME_LIMIT) * 100}%` }} />
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-6 mt-4">
              <div className="quest-page relative text-indigo-950 rounded-3xl px-8 py-9 max-w-full">
                <span className="absolute top-2 left-3 text-lg text-amber-700/30 font-display">×</span>
                <span className="absolute top-2 right-3 text-lg text-amber-700/30 font-display">?</span>
                <span className="absolute bottom-2 left-3 text-lg text-amber-700/30 font-display">🏁</span>
                <span className="absolute bottom-2 right-3 text-lg text-amber-700/30 font-display">+</span>
                <div className="text-xs text-center text-amber-800/70 font-semibold mb-1.5 tracking-wide">Швидко відповідай і випереджай!</div>
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
                    {feedback.correct ? "✦ Прискорення! ✦" : "Промах — суперники наздоганяють"}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {finished && (
          <div className="rpg-panel rpg-panel-gold rounded-3xl p-5 mt-5 text-center screen-in">
            <div className="font-display gold-text font-extrabold text-xl mb-1">{placementText}</div>
            <div className="text-violet-200 text-sm mb-4">Нагорода: {reward.coins} монет, {reward.xp} XP</div>
            <div className="flex flex-col gap-3">
              <button onClick={() => onComplete(reward.coins, reward.xp)} className="play-button w-full text-indigo-950 font-display font-extrabold text-lg py-3.5 rounded-2xl">
                Забрати нагороду
              </button>
              <button onClick={retry} className="rpg-panel rounded-2xl py-3 text-white/80 font-semibold text-sm">
                Спробувати ще раз (без нагороди)
              </button>
            </div>
          </div>
        )}
      </div>

      {showExitConfirm && (
        <ExitConfirmModal
          modeType="training"
          levelName="Перегони"
          currentProgress={round}
          totalProgress={MAX_ROUNDS}
          destination="training"
          destinationLabel="Вийти до тренувань"
          onContinue={() => setShowExitConfirm(false)}
          onExit={onBack}
        />
      )}
    </div>
  );
}
