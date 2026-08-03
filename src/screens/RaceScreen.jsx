import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AVATARS } from "../data/cosmetics.js";
import { RIVALS } from "../data/raceRivals.js";
import { RACE_DIFFICULTIES } from "../data/raceDifficulties.js";
import { generatePracticeQuestion } from "../game/practice.js";
import {
  FINISH, speedTierFor, playerBaseGain, streakBonus,
  opponentGain, pickRaceEvent, rankParticipants, liveStandings, starsForRace,
  computeRaceReward, raceScoreFor, PLACE_HEADLINE_KEY, raceMoodPhrase, raceResultHint,
} from "../game/raceEngine.js";
import { setMusicIntensity } from "../game/music.js";
import {
  preloadSfxGroup, playAnswerCorrect, playAnswerWrong, playModalOpen,
  playRaceStart, playRaceBoost, playRaceOvertake, playRaceFinish, playChestOpen,
} from "../game/sfx.js";
import ArtImage from "../components/ArtImage.jsx";
import ExitConfirmModal from "../components/ExitConfirmModal.jsx";

// Ключі (race.json) — не готові рядки, з тієї ж причини, що й у
// raceEngine.js/mastery.js (модуль обчислюється один раз при завантаженні).
const SPEED_FEEDBACK_KEY = {
  veryFast: "speedVeryFast",
  normal: "speedNormal",
  slow: "speedSlow",
};

const DIFF_HEADER_ICON = { training: "🛡️", adventure: "🏁", champion: "⚡" };

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

// difficulty — id складності, обраної на RaceDifficultyScreen ("training" /
// "adventure" / "champion"); фіксується на весь заїзд, не змінюється
// автоматично від кількості пройдених забігів (це тепер завжди свідомий
// вибір гравця, а не приховане підвищення складності).
export default function RaceScreen({ avatar, difficulty, trainingWinsToday = 0, bestScore = 0, onBack, onComplete, onChangeDifficulty }) {
  const { t } = useTranslation(["race", "regions", "shop", "common"]);
  const heroIcon = AVATARS.find((av) => av.id === avatar)?.icon ?? "🧙";
  const cfg = RACE_DIFFICULTIES[difficulty] ?? RACE_DIFFICULTIES.adventure;
  const MAX_ROUNDS = cfg.rounds;
  const TIME_LIMIT = cfg.timeLimit;

  const [round, setRound] = useState(0);
  const [event, setEvent] = useState(null);
  const [positions, setPositions] = useState({ player: 0, rivalA: 0, rivalB: 0 });
  const [question, setQuestion] = useState(() => generatePracticeQuestion(null, cfg.questionMix));
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [streak, setStreak] = useState(0);
  const [dashing, setDashing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [placement, setPlacement] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);

  const lastAnswerTimeRef = useRef({ player: TIME_LIMIT, rivalA: TIME_LIMIT / 2, rivalB: TIME_LIMIT / 2 });
  const bestStreakRef = useRef(0);
  const statsRef = useRef({ correctCount: 0, missedCount: 0, responseTimeSum: 0, roundsAnswered: 0, bonusCoins: 0 });
  const answeredRef = useRef(false);
  const exitConfirmRef = useRef(false);

  const isFinalStretch = round >= MAX_ROUNDS - 2;

  // Той самий головний мотив грає й тут — лише трохи енергійніше (перегони).
  useEffect(() => {
    setMusicIntensity("active");
    preloadSfxGroup("race");
    playRaceStart();
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
    const speedTier = speedTierFor(timeLeft, TIME_LIMIT);
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

    if (correct) playAnswerCorrect(); else playAnswerWrong();
    if (correct && speedTier === "veryFast") playRaceBoost();

    setStreak(newStreak);
    setFeedback({ correct, chosen: option, gain: playerGain, speedTier, timedOut: !correct && timeLeft <= 0 });
    setDashing(correct && speedTier === "veryFast");

    const nextPlayerPos = positions.player + playerGain;
    const nextPositions = { player: nextPlayerPos, rivalA: positions.rivalA, rivalB: positions.rivalB };
    const overtook = RIVALS.some(
      (rival) => positions.player <= positions[rival.id] && nextPlayerPos > positions[rival.id]
    );
    if (overtook) playRaceOvertake();

    for (const rival of RIVALS) {
      const tierConfig = rival.tiers[difficulty];
      let gain = opponentGain({
        tierConfig, catchupBounds: cfg.catchup,
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
        const avgResponseTime = stats.roundsAnswered ? stats.responseTimeSum / stats.roundsAnswered : 0;
        const gapToSecond = Math.max(0, Math.round(ranked[0].rawProgress - ranked[1].rawProgress));
        const flawless = stats.roundsAnswered > 0 && stats.correctCount === stats.roundsAnswered;
        const score = raceScoreFor({ place, accuracy, avgResponseTime, timeLimit: TIME_LIMIT });
        const isPersonalBest = score > bestScore;

        const reward = computeRaceReward({
          reward: cfg.reward,
          place,
          accuracy,
          flawless,
          isPersonalBest,
          trainingWinsToday,
          isTraining: difficulty === "training",
        });

        let bonusChest = false;
        let finalCoins = reward.totalCoins + stats.bonusCoins;
        if (difficulty === "champion" && cfg.reward.bonusChestChance && Math.random() < cfg.reward.bonusChestChance) {
          bonusChest = true;
          finalCoins += 8;
        }

        setPlacement({
          place, ranked, accuracy, avgResponseTime,
          bestStreak: bestStreakRef.current,
          bonusCoins: stats.bonusCoins,
          gapToSecond,
          stars: starsForRace({ place, accuracy }),
          flawless, isPersonalBest, score, reward, bonusChest,
          finalCoins, finalXp: reward.totalXp,
        });
        setFinished(true);
        playRaceFinish();
        if (bonusChest || isPersonalBest) setTimeout(playChestOpen, 350);
        return;
      }

      const nextRound = round + 1;
      setRound(nextRound);
      setEvent(pickRaceEvent(nextRound, MAX_ROUNDS));
      setQuestion(generatePracticeQuestion(question.pair, cfg.questionMix));
      setTimeLeft(TIME_LIMIT);
      setFeedback(null);
      setDashing(false);
      answeredRef.current = false;
    }, 750);
  }

  function retry() {
    setRound(0);
    setEvent(null);
    setPositions({ player: 0, rivalA: 0, rivalB: 0 });
    lastAnswerTimeRef.current = { player: TIME_LIMIT, rivalA: TIME_LIMIT / 2, rivalB: TIME_LIMIT / 2 };
    bestStreakRef.current = 0;
    statsRef.current = { correctCount: 0, missedCount: 0, responseTimeSum: 0, roundsAnswered: 0, bonusCoins: 0 };
    answeredRef.current = false;
    setQuestion(generatePracticeQuestion(null, cfg.questionMix));
    setTimeLeft(TIME_LIMIT);
    setStreak(0);
    playRaceStart();
    setFeedback(null);
    setDashing(false);
    setFinished(false);
    setPlacement(null);
  }

  const standings = liveStandings(positions);

  const feedbackText = feedback
    ? feedback.correct
      ? `${t(`race:${SPEED_FEEDBACK_KEY[feedback.speedTier]}`)} +${feedback.gain}`
      : feedback.timedOut ? t("race:timeUpCatching") : t("race:rivalsCatching")
    : "";

  return (
    <div className={`relative overflow-hidden min-h-dvh screen-in ${showExitConfirm ? "attempt-paused" : ""}`}>
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-5 py-8 pb-14 min-h-dvh flex flex-col">
        <div className="battle-header">
          <button onClick={() => { playModalOpen(); setShowExitConfirm(true); }} aria-label={t("common:back")} className="rpg-panel w-11 h-11 rounded-xl flex items-center justify-center text-xl text-amber-100 active:scale-95 transition">←</button>
          <div className="rpg-panel rpg-panel-gold battle-title rounded-xl px-4 py-2 text-center">
            <div className="font-display gold-text font-extrabold text-base leading-tight truncate">{t("race:raceTitle")}</div>
            <div className="text-[11px] text-violet-200 font-semibold mt-0.5 truncate">
              {finished ? t(`race:${cfg.labelKey}`) : t("race:roundProgress", { current: Math.min(round + 1, MAX_ROUNDS), total: MAX_ROUNDS, label: t(`race:${cfg.labelKey}`) })}
            </div>
          </div>
          <div className="rpg-panel rounded-xl px-2.5 py-2 flex items-center justify-center text-lg shrink-0">{DIFF_HEADER_ICON[difficulty] ?? "🏁"}</div>
        </div>

        <div className={`race-arena rounded-3xl p-4 mt-4 ${isFinalStretch && !finished ? "race-arena-urgent" : ""}`}>
          <Lane
            name={t("race:youLabel")} imgSrc={`/assets/avatars/${avatar}.png`} fallback={heroIcon}
            pct={positions.player} place={standings.player} fillClass="xp-fill" highlight
            dashing={dashing}
          />
          {RIVALS.map((r) => (
            <Lane
              key={r.id} name={t(`regions:${r.nameKey}`)} imgSrc={r.img} fallback={r.fallback}
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
                  <span className="font-display font-extrabold text-sm text-rose-100 tracking-wide">{t("race:finishClose")}</span>
                </div>
              )}

              {event && (
                <div className="race-event-banner rounded-2xl px-4 py-2 flex items-center gap-2.5 screen-in">
                  <span className="text-xl shrink-0">{event.icon}</span>
                  <div className="text-left leading-tight">
                    <div className="font-display font-bold text-sm text-amber-100">{t(`race:${event.labelKey}`)}</div>
                    <div className="text-[11px] text-violet-200">{t(`race:${event.descKey}`)}</div>
                  </div>
                </div>
              )}

              <div className="quest-page relative text-indigo-950 rounded-3xl px-8 py-9 max-w-full">
                <span className="absolute top-2 left-3 text-lg text-amber-700/30 font-display">×</span>
                <span className="absolute top-2 right-3 text-lg text-amber-700/30 font-display">?</span>
                <span className="absolute bottom-2 left-3 text-lg text-amber-700/30 font-display">🏁</span>
                <span className="absolute bottom-2 right-3 text-lg text-amber-700/30 font-display">+</span>
                <div className="text-xs text-center text-amber-800/70 font-semibold mb-1.5 tracking-wide">{t("race:answerFastHint")}</div>
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
            {/* 2.2 Підсумок результату */}
            <div className="font-display gold-text font-extrabold text-xl mb-1">{t(`race:${PLACE_HEADLINE_KEY[placement.place]}`)}</div>
            <div className="text-[11px] text-violet-200 font-semibold mb-2">{t(`race:${cfg.labelKey}`)}</div>

            <div className="flex justify-center gap-2 mb-2">
              {[0, 1, 2].map((i) => (
                <ArtImage key={i} src="/assets/icons/ui/star.png" fallback="⭐" alt="" className={`w-9 h-9 object-contain ${i < placement.stars ? "" : "opacity-20 grayscale"}`} />
              ))}
            </div>
            <div className="race-result-mood text-sm mb-4">{raceMoodPhrase(t, { place: placement.place, accuracy: placement.accuracy })}</div>

            {/* 2.3 Таблиця учасників */}
            <div className="exit-progress-panel rounded-2xl px-4 py-3 mb-4 text-left space-y-1.5">
              {placement.ranked.map((r, i) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between text-sm py-0.5 ${
                    r.id === "player" ? "race-participant-me text-amber-200 font-bold" : "text-violet-100"
                  }`}
                >
                  <span className="flex items-center gap-2"><PlaceBadge place={i + 1} /> {r.id === "player" ? t("race:youLabel") : t(`regions:${RIVALS.find((rv) => rv.id === r.id)?.nameKey}`)}</span>
                  <span>{Math.min(100, Math.round(r.rawProgress))}%</span>
                </div>
              ))}
            </div>

            {/* 2.4 Статистика гравця — охайна сітка 2×2 */}
            <div className="race-stat-grid mb-4">
              <div className="race-stat-cell text-left">
                <div className="race-stat-cell-label">{t("race:statAccuracy")}</div>
                <div className="race-stat-cell-value">{Math.round(placement.accuracy * 100)}%</div>
              </div>
              <div className="race-stat-cell text-left">
                <div className="race-stat-cell-label">{t("race:statAvgTime")}</div>
                <div className="race-stat-cell-value">{placement.avgResponseTime.toFixed(1)} {t("race:secondsUnit")}</div>
              </div>
              <div className="race-stat-cell text-left">
                <div className="race-stat-cell-label">{t("race:statBestStreak")}</div>
                <div className="race-stat-cell-value">{placement.bestStreak}</div>
              </div>
              <div className="race-stat-cell text-left">
                <div className="race-stat-cell-label">{t("race:statGap")}</div>
                <div className="race-stat-cell-value">{placement.gapToSecond}%</div>
              </div>
            </div>

            {/* 2.5 Блок нагород */}
            <div className="exit-progress-panel rounded-2xl px-4 py-3 mb-3 text-left text-sm text-violet-100 space-y-1">
              <div className="flex justify-between"><span>{t("race:rewardBase")}</span><span className="text-white font-semibold">{placement.reward.baseCoins} {t("shop:coinsAlt")}</span></div>
              {placement.reward.multiplier > 1 && (
                <div className="flex justify-between"><span>{t("race:rewardDifficultyBonus", { multiplier: placement.reward.multiplier })}</span><span className="text-emerald-300 font-semibold">+{placement.reward.difficultyCoinBonus}</span></div>
              )}
              {placement.place !== 1 && (
                <div className="flex justify-between"><span>{t("race:rewardPlaceFactor", { place: placement.place, percent: Math.round(placement.reward.placeFactor * 100) })}</span><span className="text-white font-semibold">{placement.reward.placedCoins} {t("shop:coinsAlt")}</span></div>
              )}
              {placement.reward.accuracyBonusCoins > 0 && (
                <div className="flex justify-between"><span>{t("race:rewardPerfectAccuracy")}</span><span className="text-emerald-300 font-semibold">+{placement.reward.accuracyBonusCoins}</span></div>
              )}
              {placement.reward.flawlessBonusXp > 0 && (
                <div className="flex justify-between"><span>{t("race:rewardFlawlessStreak")}</span><span className="text-emerald-300 font-semibold">+{placement.reward.flawlessBonusXp} XP</span></div>
              )}
              {placement.reward.personalBestBonusCoins > 0 && (
                <div className="flex justify-between"><span>{t("race:rewardPersonalBest")}</span><span className="text-emerald-300 font-semibold">+{placement.reward.personalBestBonusCoins}</span></div>
              )}
              {placement.bonusChest && (
                <div className="flex justify-between"><span>{t("race:rewardBonusChest")}</span><span className="text-emerald-300 font-semibold">+8</span></div>
              )}
              {placement.reward.farmReduced && (
                <div className="text-[11px] text-amber-200/80 pt-1">{t("race:farmReducedNote")}</div>
              )}
            </div>

            {/* Фінальна сума — окремий акцентний рядок з золотою підсвіткою */}
            <div className="race-reward-total rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
              <span className="font-display font-bold text-sm text-amber-100">{t("race:rewardTotal")}</span>
              <span className="font-display font-extrabold text-lg text-amber-200">{placement.finalCoins} {t("shop:coinsAlt")} • {placement.finalXp} XP</span>
            </div>

            {/* 4. UX-підказка на екрані результату — лише порада */}
            {raceResultHint(t, { place: placement.place, accuracy: placement.accuracy, difficulty }) && (
              <div className="race-diff-hint-banner rounded-xl px-3 py-2 mb-4 text-xs font-semibold">
                {raceResultHint(t, { place: placement.place, accuracy: placement.accuracy, difficulty })}
              </div>
            )}

            {/* 2.6 Кнопки дій */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  // Захист від подвійного натискання (launch-plan.md, розділ 16) —
                  // без цього швидкий подвійний тап міг би нарахувати нагороду двічі.
                  if (rewardClaimed) return;
                  setRewardClaimed(true);
                  onComplete(placement.finalCoins, placement.finalXp, {
                    difficulty, place: placement.place, accuracy: placement.accuracy,
                    avgResponseTime: placement.avgResponseTime, bestStreak: placement.bestStreak,
                    gapToSecond: placement.gapToSecond, score: placement.score,
                  });
                }}
                disabled={rewardClaimed}
                className="play-button w-full text-indigo-950 font-display font-extrabold text-lg py-3.5 rounded-2xl disabled:opacity-70"
              >
                {rewardClaimed ? t("race:claimingReward") : t("race:claimReward")}
              </button>
              <button onClick={retry} className="map-ghost-button w-full rounded-2xl py-3 font-display font-bold text-sm">
                {t("race:retryNoReward")}
              </button>
              {onChangeDifficulty && (
                <button onClick={onChangeDifficulty} className="race-tertiary-link text-xs text-center mt-0.5">
                  {t("race:toDifficultySelect")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showExitConfirm && (
        <ExitConfirmModal
          modeType="training"
          levelName={t("race:raceLevelName")}
          currentProgress={round}
          totalProgress={MAX_ROUNDS}
          destination="training"
          destinationLabel={t("race:exitToTraining")}
          onContinue={() => setShowExitConfirm(false)}
          onExit={onBack}
        />
      )}
    </div>
  );
}
