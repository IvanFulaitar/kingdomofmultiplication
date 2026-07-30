import { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "../data/cosmetics.js";
import { CELL, generateMaze, tierForCompletions, cellNeighbors, mainPathAnchorIndex } from "../game/mazeGen.js";
import { generateMazeQuestion, pickKind, pickForkKind } from "../game/mazeQuestions.js";
import { shuffle } from "../game/random.js";
import { playCorrect, playWrong, playWin } from "../game/sound.js";
import ArtImage from "../components/ArtImage.jsx";
import MazeIcon from "../components/MazeIcon.jsx";
import ExitConfirmModal from "../components/ExitConfirmModal.jsx";

const BASE_COINS = 20;
const BASE_XP = 25;
const TIER_BONUS = 10;

// Типи клітинок, що варто позначати монеткою (бонус) на дверях-розвилках.
const BONUS_TYPES = new Set([
  CELL.COIN, CELL.CHEST, CELL.SECRET, CELL.HEART, CELL.HINT, CELL.TREASURE, CELL.PORTAL, CELL.KEY,
]);

// Грід із подвійною кількістю доріжок: парні — клітинки, непарні — вузькі
// "коридори" між ними. Це дає справжню мінікарту без ручних обчислень пікселів.
function buildTemplate(n) {
  return Array.from({ length: n * 2 - 1 }, (_, i) => (i % 2 === 0 ? "1fr" : "clamp(6px,2vw,14px)")).join(" ");
}

function buildEdgeList(maze) {
  const out = [];
  for (const e of maze.edges) {
    const [a, b] = e.split("|");
    const [r1, c1] = a.split(",").map(Number);
    const [r2, c2] = b.split(",").map(Number);
    if (r1 === r2) out.push({ id: e, row: r1 * 2 + 1, col: Math.min(c1, c2) * 2 + 2, dir: "h", a, b });
    else out.push({ id: e, row: Math.min(r1, r2) * 2 + 2, col: c1 * 2 + 1, dir: "v", a, b });
  }
  return out;
}

function doorBadge(maze, neighborKey) {
  const type = maze.cells[neighborKey].type;
  if (type === CELL.TRAP) return "lightning";
  if (BONUS_TYPES.has(type)) return "coin";
  if (maze.mainPathIndex.has(neighborKey)) return "shield";
  return null;
}
function doorRiskClass(maze, neighborKey) {
  const type = maze.cells[neighborKey].type;
  if (type === CELL.TRAP) return "maze-door-risky";
  if (BONUS_TYPES.has(type)) return "maze-door-bonus";
  return "";
}

// Коли шляхів назад декілька (гравець на розвилці з циклом), однакові
// кнопки "← Назад" не можна відрізнити одну від одної — тому підписуємо
// напрямом, куди саме веде кожна.
function backtrackLabel(maze, fromKey, toKey, multiple) {
  if (!multiple) return "← Назад";
  const from = maze.cells[fromKey];
  const to = maze.cells[toKey];
  if (to.row < from.row) return "↑ Назад (вгору)";
  if (to.row > from.row) return "↓ Назад (вниз)";
  if (to.col < from.col) return "← Назад (ліворуч)";
  return "→ Назад (праворуч)";
}

function taskCardTitle(activeQuestion, maze) {
  if (!activeQuestion) return "";
  if (activeQuestion.mode === "deadend") return "Глухий кут — час повернутися";
  const targets = activeQuestion.mode === "fork" ? activeQuestion.doors.map((d) => d.neighborKey) : [activeQuestion.target];
  const types = targets.map((k) => maze.cells[k].type);
  if (types.includes(CELL.KEY)) return "Знайди ключ";
  if (types.includes(CELL.EXIT)) return "Відкрий фінальні двері";
  if (types.includes(CELL.SECRET)) return "Таємний шлях...";
  if (types.includes(CELL.CHEST)) return "Відкрий скриню";
  if (types.includes(CELL.TREASURE)) return "Кімната скарбів попереду";
  if (types.includes(CELL.PORTAL)) return "Загадковий портал";
  if (types.includes(CELL.TRAP)) return "Обережно, попереду небезпека!";
  if (activeQuestion.mode === "fork") return "Обери правильний шлях";
  return "Розв'яжи, щоб зробити крок";
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

function QuestCard({ title, prompt }) {
  return (
    <div className="w-full">
      {title && (
        <div className="text-center text-[11px] font-display font-bold text-amber-200/90 tracking-wide mb-2 uppercase">
          {title}
        </div>
      )}
      <div className="quest-page relative text-indigo-950 rounded-3xl px-6 py-8 max-w-full">
        <span className="absolute top-2 left-3 text-lg text-amber-700/30 font-display">×</span>
        <span className="absolute top-2 right-3 text-lg text-amber-700/30 font-display">?</span>
        <span className="absolute bottom-2 left-3 text-lg text-amber-700/30 font-display">−</span>
        <span className="absolute bottom-2 right-3 text-lg text-amber-700/30 font-display">+</span>
        <div className={`font-display font-extrabold text-center tracking-wide leading-snug ${prompt.length > 16 ? "text-2xl" : "text-4xl"}`}>
          {prompt}
        </div>
      </div>
    </div>
  );
}

export default function MazeScreen({ avatar, completions = 0, onBack, onComplete }) {
  const heroIcon = AVATARS.find((av) => av.id === avatar)?.icon ?? "🧙";

  const [maze, setMaze] = useState(() => generateMaze(tierForCompletions(completions)));
  const [hero, setHero] = useState(() => maze.startKey);
  const [visited, setVisited] = useState(() => new Set([maze.startKey]));
  const [collected, setCollected] = useState(() => new Set());
  const [lives, setLives] = useState(3);
  const [hasKey, setHasKey] = useState(false);
  const [coins, setCoins] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [secretFound, setSecretFound] = useState(false);
  const [chestsFound, setChestsFound] = useState(0);
  const [hints, setHints] = useState(1);
  const [hintsGranted, setHintsGranted] = useState(1);
  const [eliminated, setEliminated] = useState(() => new Set());
  const [wrongStrikes, setWrongStrikes] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [questionSeed, setQuestionSeed] = useState(0);
  const [treasureRound, setTreasureRound] = useState(null);
  const [treasureQuestion, setTreasureQuestion] = useState(null);
  const [toast, setToast] = useState(null);
  const [phase, setPhase] = useState("playing");
  const [finaleStep, setFinaleStep] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const exitConfirmRef = useRef(false);
  const lastPairRef = useRef(null);
  const inTreasure = !!treasureRound;

  useEffect(() => { exitConfirmRef.current = showExitConfirm; }, [showExitConfirm]);

  useEffect(() => {
    window.history.pushState({ activeAttempt: "maze" }, "");
    function handlePopState() {
      if (exitConfirmRef.current) setShowExitConfirm(false);
      else setShowExitConfirm(true);
      window.history.pushState({ activeAttempt: "maze" }, "");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Будує нове завдання щоразу, коли герой опиняється на новій клітинці —
  // або коли друга поспіль помилка вимагає нового прикладу на тому ж місці.
  useEffect(() => {
    if (phase !== "playing") return;
    setFeedback(null);
    setWrongStrikes(0);
    setEliminated(new Set());
    if (inTreasure) { setActiveQuestion(null); return; }

    const neighbors = cellNeighbors(maze, hero);
    const unvisited = neighbors.filter((k) => !visited.has(k));
    const forward = maze.requiresKey && !hasKey ? unvisited.filter((k) => k !== maze.exitKey) : unvisited;

    if (forward.length === 0) {
      setActiveQuestion({ mode: "deadend" });
      return;
    }
    if (forward.length >= 2) {
      const shuffledOpts = shuffle(forward.slice(0, 3));
      const kind = pickForkKind(maze.kinds, lastPairRef.current?.kind);
      const q = generateMazeQuestion(kind, lastPairRef.current?.pair, shuffledOpts.length);
      lastPairRef.current = q;
      const doors = shuffledOpts.map((neighborKey, i) => ({
        neighborKey, value: q.options[i], isCorrect: q.options[i] === q.correct,
      }));
      setActiveQuestion({ mode: "fork", question: q, doors });
    } else {
      const kind = pickKind(maze.kinds, lastPairRef.current?.kind);
      const q = generateMazeQuestion(kind, lastPairRef.current?.pair, 4);
      lastPairRef.current = q;
      setActiveQuestion({ mode: "straight", question: q, target: forward[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, questionSeed, phase, maze, inTreasure]);

  // Кімната скарбів: власна коротка серія з трьох питань, окремо від карти.
  useEffect(() => {
    if (!treasureRound) return;
    const kind = pickKind(maze.kinds, lastPairRef.current?.kind);
    const q = generateMazeQuestion(kind, lastPairRef.current?.pair, 4);
    lastPairRef.current = q;
    setTreasureQuestion(q);
    setFeedback(null);
    setEliminated(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treasureRound?.step, maze]);

  useEffect(() => {
    if (lives <= 0 && phase === "playing") setPhase("failed");
  }, [lives, phase]);

  useEffect(() => {
    if (phase !== "finale" || finaleStep >= 4) return;
    const t = setTimeout(() => setFinaleStep((s) => s + 1), 950);
    return () => clearTimeout(t);
  }, [phase, finaleStep]);

  const revealedSet = useMemo(() => {
    if (maze.fullyRevealed) return new Set(Object.keys(maze.cells));
    const s = new Set(visited);
    for (const vk of visited) for (const nb of cellNeighbors(maze, vk)) s.add(nb);
    return s;
  }, [visited, maze]);

  const renderedEdges = useMemo(() => buildEdgeList(maze), [maze]);
  const chestsTotal = useMemo(
    () => Object.values(maze.cells).filter((c) => c.type === CELL.CHEST || c.type === CELL.SECRET).length,
    [maze]
  );
  const neighborsOfHero = useMemo(() => cellNeighbors(maze, hero), [maze, hero]);
  const visitedNeighbors = neighborsOfHero.filter((k) => visited.has(k));
  const currentMainIndex = mainPathAnchorIndex(maze, hero);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
  }

  function markCollected(k) { setCollected((c) => new Set(c).add(k)); }

  function applyCellEffect(k) {
    const cell = maze.cells[k];
    const already = collected.has(k);
    switch (cell.type) {
      case CELL.COIN:
        if (!already) { markCollected(k); setCoins((c) => c + 5); showToast("+5 монет"); }
        break;
      case CELL.HEART:
        if (!already) {
          markCollected(k);
          setLives((l) => {
            if (l < 3) { showToast("Джерело відновило життя!"); return l + 1; }
            showToast("Джерело сяє, але життя й так повні");
            return l;
          });
        }
        break;
      case CELL.HINT:
        if (!already) {
          markCollected(k);
          setHintsGranted((g) => {
            if (g >= 3) { showToast("Гном лише махає рукою — підказок і так максимум"); return g; }
            setHints((h) => h + 1);
            showToast("Мандрівний гном дає підказку!");
            return g + 1;
          });
        }
        break;
      case CELL.KEY:
        if (!already) { markCollected(k); setHasKey(true); showToast("Ключ здобуто!"); }
        break;
      case CELL.CHEST:
        if (!already) { markCollected(k); setChestsFound((c) => c + 1); setCoins((c) => c + 15); showToast("Скриню відкрито! +15 монет"); }
        break;
      case CELL.SECRET:
        if (!already) { markCollected(k); setChestsFound((c) => c + 1); setSecretFound(true); setCoins((c) => c + 25); showToast("Таємну скриню знайдено!"); }
        break;
      case CELL.TRAP:
        if (!already) { markCollected(k); showToast("Фух, пронесло! Небезпека позаду"); }
        break;
      case CELL.PORTAL:
        if (!already) {
          markCollected(k);
          showToast("Портал переносить тебе вперед!");
          setTimeout(() => {
            setMoveCount((n) => n + 1);
            setVisited((v) => new Set(v).add(maze.portalTarget));
            setHero(maze.portalTarget);
            applyCellEffect(maze.portalTarget);
          }, 550);
        }
        break;
      case CELL.TREASURE:
        if (!already) { markCollected(k); setTreasureRound({ step: 1, bonus: 0 }); }
        break;
      case CELL.EXIT:
        startFinale();
        break;
      default:
        break;
    }
  }

  function startFinale() {
    playWin();
    setPhase("finale");
    setFinaleStep(0);
  }

  function commitMove(targetKey) {
    setMoveCount((n) => n + 1);
    setVisited((v) => new Set(v).add(targetKey));
    setHero(targetKey);
    applyCellEffect(targetKey);
  }

  function resolveAttempt(correct, targetKey, chosenValue) {
    if (feedback || showExitConfirm || phase !== "playing") return;
    const targetIsTrap = maze.cells[targetKey]?.type === CELL.TRAP;

    if (correct) {
      setFeedback({ correct: true });
      playCorrect();
      setTimeout(() => commitMove(targetKey), 650);
      return;
    }

    playWrong();
    const nextStrikes = wrongStrikes + 1;
    if (nextStrikes >= 2) {
      setFeedback({ correct: false, chosenValue, trap: targetIsTrap, lifeLost: true });
      setLives((l) => l - 1);
      setMistakes((m) => m + 1);
      setTimeout(() => {
        setEliminated(new Set());
        setQuestionSeed((s) => s + 1);
      }, 800);
    } else {
      setFeedback({ correct: false, chosenValue, trap: targetIsTrap, lifeLost: false });
      setWrongStrikes(nextStrikes);
      setTimeout(() => setFeedback(null), 750);
    }
  }

  function handleStraightAnswer(value) {
    if (!activeQuestion || activeQuestion.mode !== "straight") return;
    resolveAttempt(value === activeQuestion.question.correct, activeQuestion.target, value);
  }
  function handleDoorTap(door) {
    resolveAttempt(door.isCorrect, door.neighborKey, door.value);
  }
  function handleBacktrack(targetKey) {
    if (feedback || showExitConfirm || phase !== "playing" || inTreasure) return;
    setMoveCount((n) => n + 1);
    setHero(targetKey);
  }
  function handleUseHint() {
    if (hints <= 0 || feedback || showExitConfirm || !activeQuestion || activeQuestion.mode === "deadend" || inTreasure) return;
    const isFork = activeQuestion.mode === "fork";
    const values = isFork ? activeQuestion.doors.map((d) => d.value) : activeQuestion.question.options;
    const correctVal = isFork ? activeQuestion.doors.find((d) => d.isCorrect).value : activeQuestion.question.correct;
    const wrongVals = values.filter((v) => v !== correctVal && !eliminated.has(v));
    if (wrongVals.length <= 1) return;
    const toRemove = shuffle(wrongVals).slice(1);
    setEliminated((e) => new Set([...e, ...toRemove]));
    setHints((h) => h - 1);
  }

  function handleTreasureAnswer(value) {
    if (feedback || showExitConfirm || !treasureRound || !treasureQuestion) return;
    const correct = value === treasureQuestion.correct;
    if (correct) playCorrect(); else playWrong();
    setFeedback({ correct, chosenValue: value, treasure: true });
    setTimeout(() => {
      setFeedback(null);
      setTreasureRound((t) => {
        if (!t) return null;
        const bonus = t.bonus + (correct ? 10 : 0);
        if (t.step >= 3) {
          setCoins((c) => c + bonus);
          showToast(`Скарбниця: +${bonus} монет!`);
          setQuestionSeed((s) => s + 1);
          return null;
        }
        return { step: t.step + 1, bonus };
      });
    }, 650);
  }

  function handleRetry() {
    const fresh = generateMaze(maze.tier);
    setMaze(fresh);
    setHero(fresh.startKey);
    setVisited(new Set([fresh.startKey]));
    setCollected(new Set());
    setLives(3);
    setHasKey(false);
    setCoins(0);
    setMoveCount(0);
    setMistakes(0);
    setSecretFound(false);
    setChestsFound(0);
    setHints(1);
    setHintsGranted(1);
    setEliminated(new Set());
    setWrongStrikes(0);
    setFeedback(null);
    setActiveQuestion(null);
    setTreasureRound(null);
    setTreasureQuestion(null);
    setToast(null);
    setFinaleStep(0);
    setPhase("playing");
    setQuestionSeed((s) => s + 1);
    lastPairRef.current = null;
  }

  const starsEarned = phase === "finale"
    ? [true, lives === 3, secretFound || moveCount <= maze.mainPathLength].filter(Boolean).length
    : 0;
  const totalCoins = BASE_COINS + maze.tier * TIER_BONUS + coins;
  const totalXp = BASE_XP + maze.tier * TIER_BONUS + starsEarned * 10;

  return (
    <div className={`relative overflow-hidden min-h-dvh screen-in ${showExitConfirm ? "attempt-paused" : ""}`}>
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-5 py-8 pb-14 min-h-dvh flex flex-col">
        <div className="battle-header">
          <button onClick={() => setShowExitConfirm(true)} aria-label="Назад" className="rpg-panel rpg-panel-gold w-11 h-11 rounded-xl flex items-center justify-center text-xl text-amber-100 active:scale-95 transition">←</button>
          <div className="rpg-panel rpg-panel-gold battle-title rounded-xl px-4 py-2 text-center">
            <div className="font-display gold-text font-extrabold text-base leading-tight truncate">✦ Лабіринт ✦</div>
            <div className="text-[11px] text-violet-200 font-semibold mt-0.5 truncate">
              {phase === "playing" ? `Крок ${moveCount + 1} з ${maze.mainPathLength}` : maze.tierName}
            </div>
          </div>
          <div className="rpg-panel battle-lives rounded-xl px-2.5 py-2">
            {[0, 1, 2].map((i) => <MazeHeart key={i} filled={i < lives} />)}
          </div>
        </div>

        {phase === "playing" && (maze.requiresKey || chestsTotal > 0) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {maze.requiresKey && (
              <div className="rpg-panel rounded-xl px-3 py-1.5 maze-status-pill text-violet-100">
                <span className="w-4 h-4 inline-block shrink-0"><MazeIcon type="key" className="w-full h-full" /></span>
                Ключ: {hasKey ? "1/1" : "0/1"}
              </div>
            )}
            {chestsTotal > 0 && (
              <div className="rpg-panel rounded-xl px-3 py-1.5 maze-status-pill text-violet-100">
                <span className="w-4 h-4 inline-block shrink-0"><MazeIcon type="chest" className="w-full h-full" /></span>
                Скрині: {chestsFound}/{chestsTotal}
              </div>
            )}
          </div>
        )}

        {phase === "playing" && (
          <>
            <div className="rpg-panel rpg-panel-gold rounded-3xl p-3 mt-3">
              <div
                className="relative mx-auto"
                style={{ display: "grid", gridTemplateColumns: buildTemplate(maze.cols), gridTemplateRows: buildTemplate(maze.rows), width: "100%", aspectRatio: `${maze.cols} / ${maze.rows}` }}
              >
                {Object.values(maze.cells).map((cell) => {
                  const isCurrent = cell.key === hero;
                  const isVisited = visited.has(cell.key);
                  const isRevealed = revealedSet.has(cell.key);
                  const displayType = !isVisited && cell.type === CELL.SECRET ? CELL.CORRIDOR : cell.type;
                  const isLocked = cell.type === CELL.EXIT && maze.requiresKey && !hasKey;
                  const stateClass = isCurrent ? "maze-cell-current" : isVisited ? "maze-cell-visited" : isRevealed ? "maze-cell-known" : "maze-cell-fog";
                  return (
                    <div key={cell.key} style={{ gridColumn: cell.col * 2 + 1, gridRow: cell.row * 2 + 1 }} className={`maze-cell ${stateClass} ${isLocked ? "maze-cell-locked" : ""}`}>
                      {isCurrent && (
                        <ArtImage src={`/assets/avatars/${avatar}.png`} fallback={heroIcon} alt="" className="maze-hero-token w-[74%] h-[74%] object-contain gentle-bounce" />
                      )}
                      {!isCurrent && (isVisited || isRevealed) && displayType !== CELL.CORRIDOR && displayType !== CELL.START && (
                        <div className="w-[58%] h-[58%]"><MazeIcon type={displayType} className="w-full h-full" /></div>
                      )}
                      {!isCurrent && isVisited && (displayType === CELL.CORRIDOR || displayType === CELL.START) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300/50" />
                      )}
                      {isLocked && <span className="absolute -top-1.5 -right-1.5 w-5 h-5"><MazeIcon type="lock" className="w-full h-full" /></span>}
                    </div>
                  );
                })}
                {renderedEdges.map((e) => (
                  <div
                    key={e.id}
                    style={{ gridColumn: e.col, gridRow: e.row }}
                    className={`self-center justify-self-center ${e.dir === "h" ? "w-full h-1.5" : "w-1.5 h-full"} ${revealedSet.has(e.a) && revealedSet.has(e.b) ? "maze-corridor" : "maze-corridor-fog"} rounded-full`}
                  />
                ))}
              </div>
            </div>

            <div className="maze-trail mt-3">
              {maze.mainPath.map((k, i) => (
                <span key={k} className={`maze-diamond ${i < currentMainIndex ? "maze-diamond-done" : i === currentMainIndex ? "maze-diamond-current" : "maze-diamond-future"}`} />
              ))}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-3.5 mt-4">
              {toast && <div className="rpg-panel rpg-panel-gold rounded-xl px-4 py-2 text-sm font-bold text-amber-100 screen-in">{toast}</div>}

              {inTreasure && treasureQuestion && (
                <>
                  <div className="maze-treasure-banner rounded-2xl px-4 py-2 text-center text-emerald-100 text-xs font-bold">
                    ✦ Кімната скарбів — питання {treasureRound.step}/3 ✦
                  </div>
                  <QuestCard prompt={treasureQuestion.prompt} />
                  <div className="flex flex-wrap justify-center gap-3.5 w-full">
                    {treasureQuestion.options.map((opt) => {
                      let style = "answer-btn hover:brightness-110";
                      let mark = null;
                      if (feedback) {
                        if (opt === treasureQuestion.correct) { style = "answer-btn-correct"; mark = "✓"; }
                        else if (opt === feedback.chosenValue) { style = "answer-btn-wrong"; mark = "✕"; }
                        else style = "answer-btn-dim opacity-50";
                      }
                      return (
                        <button key={opt} disabled={!!feedback} onClick={() => handleTreasureAnswer(opt)} className={`relative font-display font-extrabold text-white text-2xl py-6 rounded-2xl transition active:scale-95 w-[47%] ${style}`}>
                          {opt}{mark && <span className="absolute top-1.5 right-2.5 text-base">{mark}</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {!inTreasure && activeQuestion?.mode === "straight" && (
                <>
                  <QuestCard title={taskCardTitle(activeQuestion, maze)} prompt={activeQuestion.question.prompt} />
                  <div className="flex flex-wrap justify-center gap-3.5 w-full">
                    {activeQuestion.question.options.filter((opt) => !eliminated.has(opt)).map((opt) => {
                      let style = "answer-btn hover:brightness-110";
                      let mark = null;
                      if (feedback) {
                        if (opt === activeQuestion.question.correct) { style = "answer-btn-correct"; mark = "✓"; }
                        else if (opt === feedback.chosenValue) { style = feedback.trap ? "maze-trap-flash text-white" : "answer-btn-wrong"; mark = "✕"; }
                        else style = "answer-btn-dim opacity-50";
                      }
                      return (
                        <button key={opt} disabled={!!feedback} onClick={() => handleStraightAnswer(opt)} className={`relative font-display font-extrabold text-white text-2xl py-6 rounded-2xl transition active:scale-95 w-[47%] ${style}`}>
                          {opt}{mark && <span className="absolute top-1.5 right-2.5 text-base">{mark}</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {!inTreasure && activeQuestion?.mode === "fork" && (
                <>
                  <QuestCard title={taskCardTitle(activeQuestion, maze)} prompt={activeQuestion.question.prompt} />
                  <div className="flex flex-wrap justify-center gap-3 w-full">
                    {activeQuestion.doors.filter((d) => !eliminated.has(d.value)).map((door) => {
                      const badge = doorBadge(maze, door.neighborKey);
                      let style = `maze-door-btn ${doorRiskClass(maze, door.neighborKey)}`;
                      let mark = null;
                      if (feedback) {
                        if (door.isCorrect) { style = "answer-btn-correct"; mark = "✓"; }
                        else if (door.value === feedback.chosenValue) { style = feedback.trap ? "maze-trap-flash text-white" : "answer-btn-wrong"; mark = "✕"; }
                        else style = "answer-btn-dim opacity-50";
                      }
                      const wide = activeQuestion.doors.length <= 2 ? "w-[46%]" : "w-[30%] min-w-[84px]";
                      return (
                        <button key={door.neighborKey} disabled={!!feedback} onClick={() => handleDoorTap(door)} className={`relative font-display font-extrabold text-white text-2xl py-7 rounded-2xl transition active:scale-95 ${wide} ${style}`}>
                          {badge && !feedback && (
                            <span className="maze-door-badge">
                              <MazeIcon type={badge} className="w-full h-full" />
                            </span>
                          )}
                          {door.value}{mark && <span className="absolute top-1.5 right-2.5 text-base">{mark}</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {!inTreasure && activeQuestion?.mode === "deadend" && (
                <div className="rpg-panel rounded-2xl p-4 text-center text-violet-100 text-sm max-w-xs">
                  Тут більше нічого немає — обери напрям і повернися назад.
                </div>
              )}

              {!inTreasure && visitedNeighbors.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {visitedNeighbors.map((k) => (
                    <button key={k} disabled={!!feedback} onClick={() => handleBacktrack(k)} className="rpg-panel rounded-xl px-3 py-1.5 text-xs text-violet-200/80 active:scale-95 transition">
                      {backtrackLabel(maze, hero, k, visitedNeighbors.length > 1)}
                    </button>
                  ))}
                </div>
              )}

              {!inTreasure && activeQuestion && activeQuestion.mode !== "deadend" && (
                <button onClick={handleUseHint} disabled={hints <= 0 || !!feedback} className="maze-hint-btn rounded-xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-amber-100">
                  <ArtImage src="/assets/icons/ui/hint_lightbulb.png" fallback="💡" alt="" className="w-4 h-4 object-contain" />
                  Підказка ×{hints}
                </button>
              )}

              <div className="h-6 feedback-pop" key={feedback ? (feedback.correct ? "ok" : feedback.trap ? "trap" : "no") : "none"}>
                {feedback && (
                  <div className={`font-display font-bold text-sm ${feedback.correct ? "text-emerald-300" : feedback.trap ? "text-sky-300" : "text-rose-300"}`}>
                    {feedback.correct
                      ? feedback.treasure ? "+10 монет!" : "✦ Крок уперед! ✦"
                      : feedback.treasure ? "Цього разу без бонусу"
                      : feedback.trap && feedback.lifeLost ? "Слизько! Це коштувало життя"
                      : feedback.trap ? "Обережно, тут слизько!"
                      : feedback.lifeLost ? "Ой, це коштувало життя…"
                      : "Не той шлях, спробуй ще раз"}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {phase === "finale" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 mt-4" onClick={() => finaleStep < 4 && setFinaleStep(4)}>
            {finaleStep === 0 && (
              <>
                <div className="maze-finale-doors w-full max-w-xs">
                  <div className="maze-finale-door-leaf left" />
                  <div className="maze-finale-door-leaf right" />
                </div>
                <div className="font-display gold-text font-bold text-lg text-center">Магічні двері відчиняються…</div>
              </>
            )}
            {finaleStep === 1 && (
              <>
                <ArtImage src={`/assets/avatars/${avatar}.png`} fallback={heroIcon} alt="" className="w-28 h-28 object-contain gentle-bounce" />
                <div className="font-display gold-text font-bold text-lg text-center">Герой виходить із лабіринту!</div>
              </>
            )}
            {finaleStep === 2 && (
              <>
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <span className="victory-orbit" />
                  <div className="w-16 h-16"><MazeIcon type="chest" className="w-full h-full" /></div>
                </div>
                <div className="font-display gold-text font-bold text-lg text-center">Скриня відчиняється!</div>
              </>
            )}
            {finaleStep === 3 && (
              <>
                <div className="flex justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <ArtImage
                      key={i}
                      src="/assets/icons/ui/star.png"
                      fallback=""
                      alt=""
                      className={`w-14 h-14 object-contain ${i < starsEarned ? "star-pop" : "opacity-20 grayscale"}`}
                      style={i < starsEarned ? { animationDelay: `${i * 0.15}s` } : undefined}
                    />
                  ))}
                </div>
                <div className="font-display gold-text font-bold text-lg text-center">{starsEarned} з 3 зірок!</div>
              </>
            )}
            {finaleStep < 4 && <div className="text-violet-300/50 text-xs">(тапни, щоб продовжити)</div>}

            {finaleStep >= 4 && (
              <div className="rpg-panel rpg-panel-gold rounded-3xl p-5 text-center screen-in w-full" onClick={(e) => e.stopPropagation()}>
                <div className="font-display gold-text font-extrabold text-xl mb-3">Лабіринт пройдено!</div>
                <div className="flex justify-center gap-2 mb-4">
                  {[0, 1, 2].map((i) => (
                    <ArtImage key={i} src="/assets/icons/ui/star.png" fallback="" alt="" className={`w-11 h-11 object-contain ${i < starsEarned ? "" : "opacity-20 grayscale"}`} />
                  ))}
                </div>
                <div className="exit-progress-panel rounded-2xl px-4 py-3 mb-4 text-left text-sm text-violet-100 space-y-1">
                  <div>Клітинок пройдено: <b className="text-white">{visited.size}</b></div>
                  <div>Скринь знайдено: <b className="text-white">{chestsFound}/{chestsTotal}</b></div>
                  <div>Помилок: <b className="text-white">{mistakes}</b></div>
                  <div>Таємний шлях: <b className="text-white">{secretFound ? "знайдено!" : "не знайдено"}</b></div>
                </div>
                <div className="text-violet-200 text-sm mb-4">Нагорода: {totalCoins} монет, {totalXp} XP</div>
                <button onClick={() => onComplete(totalCoins, totalXp)} className="play-button w-full text-indigo-950 font-display font-extrabold text-lg py-3.5 rounded-2xl">
                  Забрати нагороду
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "failed" && (
          <div className="rpg-panel rounded-3xl p-5 mt-5 text-center screen-in">
            <div className="font-display coral-text font-extrabold text-xl mb-1">Життя закінчились</div>
            <div className="text-violet-200 text-sm mb-4">Спробуй пройти лабіринт ще раз — усе вийде!</div>
            <button onClick={handleRetry} className="play-button w-full text-indigo-950 font-display font-extrabold text-lg py-3.5 rounded-2xl">
              Спробувати ще раз
            </button>
          </div>
        )}
      </div>

      {showExitConfirm && (
        <ExitConfirmModal
          modeType="training"
          levelName="Лабіринт"
          currentProgress={moveCount}
          totalProgress={maze.mainPathLength}
          destination="training"
          destinationLabel="Вийти до тренувань"
          onContinue={() => setShowExitConfirm(false)}
          onExit={onBack}
        />
      )}
    </div>
  );
}
