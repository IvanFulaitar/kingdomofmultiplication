import { useEffect, useRef, useState } from "react";
import { AVATARS } from "../data/cosmetics.js";
import { RIVALS } from "../data/raceRivals.js";
import { generatePracticeQuestion } from "../game/practice.js";
import {
  MAX_ROUNDS, TIME_LIMIT, FINISH,
  tierForCompletions, TIER_LABEL, speedTierFor, playerBaseGain, streakBonus,
  opponentGain, pickRaceEvent, rankParticipants, liveStandings, starsForRace,
} from "../game/raceEngine.js";
import { playCorrect, playWrong, playWin, playFinalStretch } from "../game/sound.js";
import { setMusicIntensity } from "../game/music.js";
import ArtImage from "../components/ArtImage.jsx";
import ExitConfirmModal from "../components/ExitConfirmModal.jsx";

const SPEED_FEEDBACK = {
  veryFast: "Блискавична відповідь!",
  normal: "Прудка відповідь!",
  slow: "Правильно!",
};

const NAMES = { player: "Ти", rivalA: "Їжак-бешкетник", rivalB: "Гірський яструб" };

// Синтетичний "час останньої відповіді" суперника — потрібен лише як
// детермінований запасний критерій для розбору точної нічиї (спец вимагає
// "не призначати переможця випадково"). Більший приріст цього раунду
// трактується як "швидша" умовна відповідь.
function syntheticRivalTime(gain, tierConfig) {
  const [lo, hi] = tierConfig.base;
  const mid = (lo + hi) / 2;
  const spread = Math.max(1, hi - lo);
  const t = Math.max(0, Math.min(1, (mid + spread - gain) / (spread * 2)));
  return 1 + t * 4;
}

function PlaceBadge({ place }) {
  const tone = place === 1 ? "race-place-gold" : place === 2 ? "race-place-silver" : "race-place-bronze";
  return <span className={`race-place-badge ${tone}`}>{place}</span>;
}

function Lane({ name, imgSrc, fallback, pct, place, fillClass, highlight, dashing }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-1.5 px-0.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <PlaceBadge place={place} />
          <span className={`font-semibold text-[13px] truncate ${highlight ? "text-amber-200" : "text-white/70"}`}>{name}</span>
        </div>
        <span className="text-[13px] font-bold text-white/85 shrink-0">{Math.min(100, Math.round(pct))}%</span>
      </div>
      <div className="race-track-lane rounded-full overflow-hidden relative h-9">
        <span className="race-flag absolute right-1 top-1/2 -translate-y-1/2 z-10 rounded-sm" aria-hidden="true" />
        <div className={`h-full ${fillClass} race-track-fill rounded-full`} style={{ width: `${Math.min(100, pct)}%` }} />
        <div className={`race-runner ${dashing ? "race-runner-dash" : ""}`} style={{ left: `${Math.min(95, pct)}%` }}>
          {place === 1 && <span className="race-crown absolute -top-3 left-1/2 -translate-x-1/2" aria-hidden="true" />}
          <ArtImage src={imgSrc} fallback={fallback} alt="" className="w-7 h-7 object-contain drop-shadow-[0_0_4px_rgba(0,0,0,0.6)]" />
        </div>
      </div>
    </div>
  );
}

export default function RaceScreen({ avatar, completions = 0, onBack, onComplete }) {
  const heroIcon = AVATARS.find((av) => av.id === avatar)?.icon ?? "🧙";
  const [tier] = useState(() => tierForCompletions(completions)); // фіксується на весь заїзд

  const [round, setRound] = useState(0);
  const [event, setEvent] = useState(null);
  const [positions, setPositions] = useState({ player: 0, rivalA: 0, rivalB: 0 });
  const [question, setQuestion] = useState(() => generatePracticeQuestion(null));
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [streak, setStreak] = useState(0);
  const [dashing, setDashing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [placement, setPlacement] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const lastAnswerTimeRef = useRef({ player: TIME_LIMIT, rivalA: TIME_LIMIT / 2, rivalB: TIME_LIMIT / 2 });
  const bestStreakRef = useRef(0);
  const statsRef = useRef({ correctCount: 0, missedCount: 0, responseTimeSum: 0, roundsAnswered: 0, bonusCoins: 0 });
  const answeredRef = useRef(false);
  const exitConfirmRef = useRef(false);
  const finalStretchSoundRef = useRef(false);

  const isFinalStretch = round >= MAX_ROUNDS - 2;

  // Той самий головний мотив грає й тут — лише трохи енергійніше (перегони).
  useEffect(() => {
    setMusicIntensity("active");
    return () => setMusicIntensity("calm");
  }, []);

  useEffect(() => { exitConfirmRef.current = showExitConfirm; }, [showExitConfirm]);

  useEffect(() => {
    window.history.pushState({ activeAttempt: "race" }, "");
    function handlePopState() {
      if (exitConfirmRef.current) setShowExitConfirm(false);
      else setShowExitConfirm(true);
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
    const speedTier = speedTierFor(timeLeft);
    const stats = statsRef.current;
    const currentEvent = event;

    let playerGain = 0;
    let newStreak = streak;
    if (correct) {
      newStreak = streak + 1;
      playerGain = playerBaseGain(speedTier) + streakBonus(newStreak);
      if (currentEvent?.id === "boost" && speedTier === "veryFast") playerGain += 3;
      if (currentEvent?.id === "dash" && round === MAX_ROUNDS - 1) playerGain += 2;
      stats.correctCount += 1;
      if (currentEvent?.id === "star") stats.bonusCoins += 1;
    } else {
      newStreak = 0;
      if (timeLeft <= 0) stats.missedCount += 1;
    }
    if (currentEvent?.id === "turn") playerGain = Math.round(playerGain * 0.7);

    bestStreakRef.current = Math.max(bestStreakRef.current, newStreak);
    stats.responseTimeSum += TIME_LIMIT - timeLeft;
    stats.roundsAnswered += 1;

    if (correct) playCorrect(); else playWrong();

    setStreak(newStreak);
    setFeedback({ correct, chosen: option, gain: playerGain, speedTier, timedOut: !correct && timeLeft <= 0 });
    setDashing(correct && speedTier === "veryFast");

    const nextPlayerPos = positions.player + playerGain;
    const nextPositions = { player: nextPlayerPos, rivalA: positions.rivalA, rivalB: positions.rivalB };

    for (const rival of RIVALS) {
      const tierConfig = rival.tiers[tier];
      let gain = opponentGain({
        tierConfig, tier,
        playerProgress: nextPlayerPos,
        opponentProgress: positions[rival.id],
        isFinalStretch,
      });
      if (currentEvent?.id === "turn") gain = Math.max(1, Math.round(gain * 0.7));
      nextPositions[rival.id] = positions[rival.id] + gain;
      lastAnswerTimeRef.current[rival.id] = syntheticRivalTime(gain, tierConfig);
    }
    lastAnswerTimeRef.current.player = correct ? { veryFast: 1, normal: 3, slow: 5 }[speedTier] : TIME_LIMIT;

    setPositions(nextPositions);

    setTimeout(() => {
      const raceOver =
        nextPositions.player >= FINISH || nextPositions.rivalA >= FINISH || nextPositions.rivalB >= FINISH ||
        round + 1 >= MAX_ROUNDS;

      if (raceOver) {
        const entries = [
          { id: "player", rawProgress: nextPositions.player, lastAnswerTime: lastAnswerTimeRef.current.player },
          { id: "rivalA", rawProgress: nextPositions.rivalA, lastAnswerTime: lastAnswerTimeRef.current.rivalA },
          { id: "rivalB", rawProgress: nextPositions.rivalB, lastAnswerTime: lastAnswerTimeRef.current.rivalB },
        ];
        const ranked = rankParticipants(entries);
        const place = ranked.findIndex((r) => r.id === "player") + 1;
        const accuracy = stats.roundsAnswered ? stats.correctCount / stats.roundsAnswered : 0;
        setPlacement({
          place,
          ranked,
          accuracy,
          avgResponseTime: stats.roundsAnswered ? stats.responseTimeSum / stats.roundsAnswered : 0,
          bestStreak: bestStreakRef.current,
          bonusCoins: stats.bonusCoins,
          gapToSecond: Math.max(0, Math.round(ranked[0].rawProgress - ranked[1].rawProgress)),
          stars: starsForRace({ place, accuracy, missedCount: stats.missedCount }),
        });
        setFinished(true);
        if (place === 1) playWin();
        return;
      }

      const nextRound = round + 1;
      setRound(nextRound);
      setEvent(pickRaceEvent(nextRound, MAX_ROUNDS));
      setQuestion(generatePracticeQuestion(question.pair));
      setTimeLeft(TIME_LIMIT);
      setFeedback(null);
      setDashing(false);
      answeredRef.current = false;
      if (nextRound === MAX_ROUNDS - 2 && !finalStretchSoundRef.current) {
        finalStretchSoundRef.current = true;
        playFinalStretch();
      }
    }, 750);
  }

  function retry() {
    setRound(0);
    setEvent(null);
    setPositions({ player: 0, rivalA: 0, rivalB: 0 });
    lastAnswerTimeRef.current = { player: TIME_LIMIT, rivalA: TIME_LIMIT / 2, rivalB: TIME_LIMIT / 2 };
    bestStreakRef.current = 0;
    statsRef.current = { correctCount: 0, missedCount: 0, responseTimeSum: 0, roundsAnswered: 0, bonusCoins: 0 };
    finalStretchSoundRef.current = false;
    answeredRef.current = false;
    setQuestion(generatePracticeQuestion(null));
    setTimeLeft(TIME_LIMIT);
    setStreak(0);
    setFeedback(null);
    setDashing(false);
    setFinished(false);
    setPlacement(null);
  }

  const standings = liveStandings(positions);
  const placementText = placement?.place === 1 ? "🥇 Ти прийшов першим!" : placement?.place === 2 ? "🥈 Друге місце!" : "🥉 Третє місце";
  const baseReward = placement?.place === 1 ? { coins: 40, xp: 40 } : placement?.place === 2 ? { coins: 20, xp: 20 } : { coins: 10, xp: 10 };
  const totalCoins = baseReward.coins + (placement?.bonusCoins ?? 0);

  const feedbackText = feedback
    ? feedback.correct
      ? `${SPEED_FEEDBACK[feedback.speedTier]} +${feedback.gain}`
      : feedback.timedOut ? "Час вийшов! Суперники наближаються…" : "Суперники наближаються!"
    : "";

  return (
    <div className={`relative overflow-hidden min-h-dvh screen-in ${showExitConfirm ? "attempt-paused" : ""}`}>
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-5 py-8 pb-14 min-h-dvh flex flex-col">
        <div className="battle-header">
          <button onClick={() => setShowExitConfirm(true)} aria-label="Назад" className="rpg-panel rpg-panel-gold w-11 h-11 rounded-xl flex items-center justify-center text-xl text-amber-100 active:scale-95 transition">←</button>
          <div className="rpg-panel rpg-panel-gold battle-title rounded-xl px-4 py-2 text-center">
            <div className="font-display gold-text font-extrabold text-base leading-tight truncate">✦ Перегони ✦</div>
            <div className="text-[11px] text-violet-200 font-semibold mt-0.5 truncate">
              {finished ? TIER_LABEL[tier] : `Раунд ${Math.min(round + 1, MAX_ROUNDS)} з ${MAX_ROUNDS} · ${TIER_LABEL[tier]}`}
            </div>
          </div>
          <div className="rpg-panel rounded-xl px-2.5 py-2 flex items-center justify-center text-lg shrink-0">🏁</div>
        </div>

        <div className={`race-arena rounded-3xl p-4 mt-4 ${isFinalStretch && !finished ? "race-arena-urgent" : ""}`}>
          <Lane
            name="Ти" imgSrc={`/assets/avatars/${avatar}.png`} fallback={heroIcon}
            pct={positions.player} place={standings.player} fillClass="xp-fill" highlight
            dashing={dashing}
          />
          {RIVALS.map((r) => (
            <Lane
              key={r.id} name={r.name} imgSrc={r.img} fallback={r.fallback}
              pct={positions[r.id]} place={standings[r.id]} fillClass={r.fillClass}
            />
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

            <div className="flex-1 flex flex-col items-center justify-center gap-4 mt-3">
              {isFinalStretch && (
                <div className="race-finish-banner rounded-2xl px-4 py-1.5 text-center screen-in">
                  <span className="font-display font-extrabold text-sm text-rose-100 tracking-wide">🔥 Фініш близько!</span>
                </div>
              )}

              {event && (
                <div className="race-event-banner rounded-2xl px-4 py-2 flex items-center gap-2.5 screen-in">
                  <span className="text-xl shrink-0">{event.icon}</span>
                  <div className="text-left leading-tight">
                    <div className="font-display font-bold text-sm text-amber-100">{event.label}</div>
                    <div className="text-[11px] text-violet-200">{event.desc}</div>
                  </div>
                </div>
              )}

              <div className="quest-page relative text-indigo-950 rounded-3xl px-8 py-9 max-w-full">
                <span className="absolute top-2 left-3 text-lg text-amber-700/30 font-display">×</span>
                <span className="absolute top-2 right-3 text-lg text-amber-700/30 font-display">?</span>
                <span className="absolute bottom-2 left-3 text-lg text-amber-700/30 font-display">🏁</span>
                <span className="absolute bottom-2 right-3 text-lg text-amber-700/30 font-display">+</span>
                <div className="text-xs text-center text-amber-800/70 font-semibold mb-1.5 tracking-wide">Відповідай швидко та виривайся вперед!</div>
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
                    {feedbackText}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {finished && placement && (
          <div className="rpg-panel rpg-panel-gold rounded-3xl p-5 mt-5 text-center screen-in">
            <div className="font-display gold-text font-extrabold text-xl mb-2">{placementText}</div>

            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2].map((i) => (
                <ArtImage key={i} src="/assets/icons/ui/star.png" fallback="⭐" alt="" className={`w-9 h-9 object-contain ${i < placement.stars ? "" : "opacity-20 grayscale"}`} />
              ))}
            </div>

            <div className="exit-progress-panel rounded-2xl px-4 py-3 mb-4 text-left space-y-1.5">
              {placement.ranked.map((r, i) => (
                <div key={r.id} className={`flex items-center justify-between text-sm ${r.id === "player" ? "text-amber-200 font-bold" : "text-violet-100"}`}>
                  <span className="flex items-center gap-2"><PlaceBadge place={i + 1} /> {NAMES[r.id]}</span>
                  <span>{Math.min(100, Math.round(r.rawProgress))}%</span>
                </div>
              ))}
            </div>

            <div className="exit-progress-panel rounded-2xl px-4 py-3 mb-4 text-left text-sm text-violet-100 space-y-1">
              <div>Точність: <b className="text-white">{Math.round(placement.accuracy * 100)}%</b></div>
              <div>Середній час відповіді: <b className="text-white">{(placement.avgResponseTime).toFixed(1)} с</b></div>
              <div>Найкраща серія: <b className="text-white">{placement.bestStreak}</b></div>
              <div>Відрив 1-го місця від 2-го: <b className="text-white">{placement.gapToSecond}%</b></div>
            </div>

            <div className="text-violet-200 text-sm mb-4">
              Нагорода: {totalCoins} монет{placement.bonusCoins ? ` (+${placement.bonusCoins} бонусних)` : ""}, {baseReward.xp} XP
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => onComplete(totalCoins, baseReward.xp)} className="play-button w-full text-indigo-950 font-display font-extrabold text-lg py-3.5 rounded-2xl">
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
