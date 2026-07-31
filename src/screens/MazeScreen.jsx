import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "../data/cosmetics.js";
import { CELL, generateMaze, tierForCompletions, cellNeighbors, mainPathAnchorIndex } from "../game/mazeGen.js";
import { generateMazeQuestion, pickKind } from "../game/mazeQuestions.js";
import { shuffle } from "../game/random.js";
import { setMusicIntensity } from "../game/music.js";
import {
  preloadSfxGroup, playAnswerCorrect, playAnswerWrong, playHeartLost, playDefeat, playModalOpen,
  playMazeMove, playKeyPickup, playChestOpen, playHintSfx, playCoin, playTrapSfx, playPortal, playMazeExit,
} from "../game/sfx.js";
import ArtImage from "../components/ArtImage.jsx";
import MazeIcon from "../components/MazeIcon.jsx";
import ExitConfirmModal from "../components/ExitConfirmModal.jsx";

const BASE_COINS = 20;
const BASE_XP = 25;
const TIER_BONUS = 10;
const MOVE_MS = 420; // синхронізовано з CSS-переходом .maze-hero-overlay (0.42s)

// Типи клітинок, що варто позначати монеткою (можлива нагорода) на карті.
const BONUS_TYPES = new Set([
  CELL.COIN, CELL.CHEST, CELL.SECRET, CELL.HEART, CELL.HINT, CELL.TREASURE, CELL.PORTAL, CELL.KEY,
]);

const NAMED_LABEL = {
  [CELL.KEY]: "Перейти до ключа",
  [CELL.CHEST]: "Перейти до скрині",
  [CELL.SECRET]: "Перейти до таємної скрині",
  [CELL.TRAP]: "Перейти ризикованим шляхом",
  [CELL.PORTAL]: "Перейти до порталу",
  [CELL.TREASURE]: "Перейти до кімнати скарбів",
  [CELL.HEART]: "Перейти до джерела життя",
  [CELL.HINT]: "Перейти до порадника",
  [CELL.COIN]: "Перейти за монетами",
  [CELL.EXIT]: "Перейти до виходу",
};
const DIR_LABEL = {
  up: "Перейти у комірку зверху", down: "Перейти у комірку знизу",
  left: "Перейти у комірку ліворуч", right: "Перейти у комірку праворуч",
};
const DIR_ARROW = { up: "▲", down: "▼", left: "◀", right: "▶" };

// Грід із подвійною кількістю доріжок: парні — клітинки, непарні — вузькі
// "коридори" між ними. Це дає справжню мінікарту без ручних обчислень пікселів.
// Клітинка не менша за 64px (мінімальна зручна область натискання на телефоні),
// коридор — не вужчий за 8px (мінімальний проміжок між клітинками).
function buildTemplate(n) {
  return Array.from({ length: n * 2 - 1 }, (_, i) => (i % 2 === 0 ? "minmax(64px, 1fr)" : "clamp(8px,2vw,14px)")).join(" ");
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

// Напрямок від однієї клітинки до сусідньої — вже видно з їх розташування
// на карті, тому текст на екрані не повторює "ліворуч/праворуч" (це лише
// для читачів екрана й для маленької стрілки-підказки).
function directionOf(maze, fromKey, toKey) {
  const from = maze.cells[fromKey], to = maze.cells[toKey];
  if (to.row < from.row) return "up";
  if (to.row > from.row) return "down";
  if (to.col < from.col) return "left";
  return "right";
}
function cellAriaLabel(maze, fromKey, toKey) {
  const type = maze.cells[toKey].type;
  return NAMED_LABEL[type] ?? DIR_LABEL[directionOf(maze, fromKey, toKey)];
}
function cellBadge(maze, key) {
  const type = maze.cells[key].type;
  if (type === CELL.TRAP) return "lightning";
  if (type === CELL.KEY) return "key";
  if (BONUS_TYPES.has(type)) return "coin";
  if (maze.mainPathIndex.has(key)) return "shield";
  return null;
}
function cellRiskClass(maze, key) {
  const type = maze.cells[key].type;
  if (type === CELL.TRAP) return "maze-cell-risky";
  if (BONUS_TYPES.has(type)) return "maze-cell-bonus";
  return "";
}

function questionCardTitle(forwardOptions, maze) {
  const types = forwardOptions.map((k) => maze.cells[k].type);
  if (types.includes(CELL.KEY)) return "Знайди ключ";
  if (types.includes(CELL.EXIT)) return "Відкрий фінальні двері";
  if (types.includes(CELL.SECRET)) return "Таємний шлях...";
  if (types.includes(CELL.CHEST)) return "Відкрий скриню";
  if (types.includes(CELL.TREASURE)) return "Кімната скарбів попереду";
  if (types.includes(CELL.PORTAL)) return "Загадковий портал";
  if (types.includes(CELL.TRAP)) return "Обережно, попереду небезпека!";
  return "Розв'яжи, щоб відкрити шлях";
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

// Кнопки варіантів відповіді — той самий вигляд і для звичайного питання,
// і для кімнати скарбів, і для зустрічі з пасткою.
function AnswerGrid({ options, correct, feedback, eliminated, onAnswer, trapFlavor }) {
  return (
    <div className="flex flex-wrap justify-center gap-3.5 w-full">
      {options.filter((opt) => !eliminated?.has(opt)).map((opt) => {
        let style = "answer-btn hover:brightness-110";
        let mark = null;
        if (feedback) {
          if (opt === correct) { style = "answer-btn-correct"; mark = "✓"; }
          else if (opt === feedback.chosenValue) { style = trapFlavor && feedback.trap ? "maze-trap-flash text-white" : "answer-btn-wrong"; mark = "✕"; }
          else style = "answer-btn-dim opacity-50";
        }
        return (
          <button key={opt} disabled={!!feedback} onClick={() => onAnswer(opt)} className={`relative font-display font-extrabold text-white text-2xl py-6 rounded-2xl transition active:scale-95 w-[47%] ${style}`}>
            {opt}{mark && <span className="absolute top-1.5 right-2.5 text-base">{mark}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function MazeScreen({ avatar, completions = 0, onBack, onComplete }) {
  const heroIcon = AVATARS.find((av) => av.id === avatar)?.icon ?? "🧙";

  const [maze, setMaze] = useState(() => generateMaze(tierForCompletions(completions)));
  const [hero, setHero] = useState(() => maze.startKey);
  const [heroDisplayKey, setHeroDisplayKey] = useState(() => maze.startKey);
  const [heroBox, setHeroBox] = useState(null);
  const [moving, setMoving] = useState(false);
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
  const [question, setQuestion] = useState(null);
  const [unlockedForward, setUnlockedForward] = useState(false);
  const [strongPulse, setStrongPulse] = useState(false);
  const [questionSeed, setQuestionSeed] = useState(0);
  const [trapCellKey, setTrapCellKey] = useState(null);
  const [trapQuestion, setTrapQuestion] = useState(null);
  const [trapSeed, setTrapSeed] = useState(0);
  const [portalPending, setPortalPending] = useState(null);
  const [treasureRound, setTreasureRound] = useState(null);
  const [treasureQuestion, setTreasureQuestion] = useState(null);
  const [toast, setToast] = useState(null);
  const [phase, setPhase] = useState("playing");
  const [finaleStep, setFinaleStep] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const exitConfirmRef = useRef(false);
  const lastPairRef = useRef(null);
  const gridRef = useRef(null);
  const cellRefs = useRef(new Map());
  const inTreasure = !!treasureRound;
  const inTrap = !!trapCellKey;

  // Той самий головний мотив грає й тут — лише трохи енергійніше (лабіринт).
  useEffect(() => {
    setMusicIntensity("active");
    preloadSfxGroup("maze");
    return () => setMusicIntensity("calm");
  }, []);

  useEffect(() => { if (phase === "failed") playDefeat(); }, [phase]);

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

  const neighborsOfHero = useMemo(() => cellNeighbors(maze, hero), [maze, hero]);
  const visitedNeighbors = neighborsOfHero.filter((k) => visited.has(k));
  const unvisitedNeighbors = neighborsOfHero.filter((k) => !visited.has(k));
  const forwardOptions = maze.requiresKey && !hasKey ? unvisitedNeighbors.filter((k) => k !== maze.exitKey) : unvisitedNeighbors;
  const tappable = useMemo(() => {
    const s = new Set(visitedNeighbors);
    if (unlockedForward) for (const k of forwardOptions) s.add(k);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, visited, unlockedForward, maze, hasKey]);
  const canInteract = !moving && !feedback;

  // Точна позиція героя-накладки рахується з реальних розмірів DOM-клітинок
  // (не з відсотків "N-та з M рівних колонок" — колонки нерівні: клітинки й
  // тонкі коридори чергуються), тому анімація плавно "приїжджає" в центр
  // саме тієї клітинки, куди рухається герой, на будь-якому екрані.
  function measureHero() {
    const gridEl = gridRef.current;
    const cellEl = cellRefs.current.get(heroDisplayKey);
    if (!gridEl || !cellEl) return;
    const gridRect = gridEl.getBoundingClientRect();
    const cellRect = cellEl.getBoundingClientRect();
    setHeroBox({
      left: cellRect.left - gridRect.left + cellRect.width / 2,
      top: cellRect.top - gridRect.top + cellRect.height / 2,
      width: cellRect.width * 0.74,
      height: cellRect.height * 0.74,
    });
  }
  useLayoutEffect(measureHero, [heroDisplayKey, maze]);
  useEffect(() => {
    window.addEventListener("resize", measureHero);
    return () => window.removeEventListener("resize", measureHero);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroDisplayKey, maze]);

  // Будує нове завдання щоразу, коли герой опиняється на новій клітинці —
  // або коли друга поспіль помилка вимагає нового прикладу на тому ж місці.
  useEffect(() => {
    if (phase !== "playing" || inTreasure || inTrap || portalPending) return;
    setFeedback(null);
    setWrongStrikes(0);
    setEliminated(new Set());
    setUnlockedForward(false);
    if (forwardOptions.length === 0) { setQuestion(null); return; }
    const kind = pickKind(maze.kinds, lastPairRef.current?.kind);
    const q = generateMazeQuestion(kind, lastPairRef.current?.pair, 4);
    lastPairRef.current = q;
    setQuestion(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, questionSeed, phase, maze, inTreasure, inTrap, portalPending]);

  // Якщо шлях відкрито й доступна рівно одна клітинка — за секунду підсилюємо
  // пульс (сильніша підказка), але НЕ переходимо туди автоматично.
  useEffect(() => {
    setStrongPulse(false);
    if (!unlockedForward || tappable.size !== 1) return;
    const t = setTimeout(() => setStrongPulse(true), 1000);
    return () => clearTimeout(t);
  }, [unlockedForward, tappable, hero]);

  // Зустріч із пасткою — власне окреме завдання "Уникни пастки".
  useEffect(() => {
    if (!trapCellKey) return;
    const kind = pickKind(maze.kinds, lastPairRef.current?.kind);
    const q = generateMazeQuestion(kind, lastPairRef.current?.pair, 4);
    lastPairRef.current = q;
    setTrapQuestion(q);
    setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trapCellKey, trapSeed, maze]);

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
        if (!already) { markCollected(k); setCoins((c) => c + 5); showToast("+5 монет"); playCoin(); }
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
            playHintSfx();
            return g + 1;
          });
        }
        break;
      case CELL.KEY:
        if (!already) { markCollected(k); setHasKey(true); showToast("Ключ здобуто!"); playKeyPickup(); }
        break;
      case CELL.CHEST:
        if (!already) { markCollected(k); setChestsFound((c) => c + 1); setCoins((c) => c + 15); showToast("Скриню відкрито! +15 монет"); playChestOpen(); }
        break;
      case CELL.SECRET:
        if (!already) { markCollected(k); setChestsFound((c) => c + 1); setSecretFound(true); setCoins((c) => c + 25); showToast("Таємну скриню знайдено!"); playChestOpen(); }
        break;
      case CELL.TRAP:
        if (!already) { setTrapCellKey(k); playTrapSfx(); } // окрема зустріч "Уникни пастки"
        break;
      case CELL.PORTAL:
        if (!already) { markCollected(k); setPortalPending(k); }
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
    playMazeExit();
    setPhase("finale");
    setFinaleStep(0);
  }

  // Єдина точка руху героя — і вперед (після правильної відповіді), і назад
  // (на вже відвідану клітинку). Аватар героя — окремий шар над картою, що
  // плавно "їде" між координатами клітинок, замість миттєвого перескоку.
  function beginMove(targetKey) {
    if (moving) return;
    playMazeMove();
    setMoving(true);
    setHeroDisplayKey(targetKey);
    setTimeout(() => {
      setMoveCount((n) => n + 1);
      setVisited((v) => new Set(v).add(targetKey));
      setHero(targetKey);
      setMoving(false);
      applyCellEffect(targetKey);
    }, MOVE_MS);
  }

  function handleCellTap(targetKey) {
    if (!canInteract || showExitConfirm || phase !== "playing" || inTreasure || inTrap || portalPending) return;
    if (!tappable.has(targetKey)) return;
    beginMove(targetKey);
  }

  // Керування стрілками: фокус переходить лише на клітинку-сусіда, яка й так
  // доступна для тапу — Enter/Пробіл підтверджують перехід нативно (це вже
  // вміє звичайний <button>, окремого коду для підтвердження не треба).
  function handleGridKeyDown(e) {
    const dirMap = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const delta = dirMap[e.key];
    if (!delta) return;
    const focusedKey = document.activeElement?.dataset?.cellKey;
    const from = focusedKey && maze.cells[focusedKey];
    if (!from) return;
    const targetKey = `${from.row + delta[0]},${from.col + delta[1]}`;
    const targetBtn = cellRefs.current.get(targetKey);
    if (targetBtn && tappable.has(targetKey) && canInteract) {
      e.preventDefault();
      targetBtn.focus();
    }
  }

  function resolveAttempt(correct, chosenValue) {
    if (feedback || showExitConfirm || phase !== "playing") return;
    if (correct) {
      setFeedback({ correct: true });
      playAnswerCorrect();
      setTimeout(() => { setFeedback(null); setUnlockedForward(true); }, 500);
      return;
    }
    const nextStrikes = wrongStrikes + 1;
    if (nextStrikes >= 2) playHeartLost(); else playAnswerWrong();
    if (nextStrikes >= 2) {
      setFeedback({ correct: false, chosenValue, lifeLost: true });
      setLives((l) => l - 1);
      setMistakes((m) => m + 1);
      setTimeout(() => {
        setEliminated(new Set());
        setQuestionSeed((s) => s + 1);
      }, 800);
    } else {
      setFeedback({ correct: false, chosenValue, lifeLost: false });
      setWrongStrikes(nextStrikes);
      setTimeout(() => setFeedback(null), 750);
    }
  }

  function handleAnswer(value) {
    if (!question) return;
    resolveAttempt(value === question.correct, value);
  }

  // Пастка — окреме "ризиковане" завдання: перша ж помилка коштує життя
  // (без безкоштовної спроби), бо саме тут ризик має бути справжнім.
  function handleTrapAnswer(value) {
    if (feedback || showExitConfirm || !trapCellKey || !trapQuestion) return;
    const correct = value === trapQuestion.correct;
    if (correct) playAnswerCorrect(); else playHeartLost();
    setFeedback({ correct, chosenValue: value, trap: true, lifeLost: !correct });
    if (correct) {
      setTimeout(() => {
        setFeedback(null);
        markCollected(trapCellKey);
        setTrapCellKey(null);
        showToast("Уникнув пастки!");
      }, 650);
    } else {
      setLives((l) => l - 1);
      setMistakes((m) => m + 1);
      setTimeout(() => {
        setFeedback(null);
        setTrapSeed((s) => s + 1);
      }, 800);
    }
  }

  function handlePortalConfirm() {
    if (!portalPending) return;
    playPortal();
    const target = maze.portalTarget;
    setPortalPending(null);
    showToast("Портал переносить тебе вперед!");
    setMoveCount((n) => n + 1);
    setVisited((v) => new Set(v).add(target));
    setHero(target);
    setHeroDisplayKey(target);
    applyCellEffect(target);
  }

  function handleUseHint() {
    if (hints <= 0 || feedback || showExitConfirm || !question) return;
    const wrongVals = question.options.filter((v) => v !== question.correct && !eliminated.has(v));
    if (wrongVals.length <= 1) return;
    const toRemove = shuffle(wrongVals).slice(1);
    setEliminated((e) => new Set([...e, ...toRemove]));
    setHints((h) => h - 1);
    playHintSfx();
  }

  function handleTreasureAnswer(value) {
    if (feedback || showExitConfirm || !treasureRound || !treasureQuestion) return;
    const correct = value === treasureQuestion.correct;
    if (correct) playAnswerCorrect(); else playAnswerWrong();
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
    cellRefs.current = new Map();
    setMaze(fresh);
    setHero(fresh.startKey);
    setHeroDisplayKey(fresh.startKey);
    setHeroBox(null);
    setMoving(false);
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
    setQuestion(null);
    setUnlockedForward(false);
    setTrapCellKey(null);
    setTrapQuestion(null);
    setPortalPending(null);
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

  const showQuestionCard = phase === "playing" && !inTreasure && !inTrap && !portalPending && question && !unlockedForward;
  const showMoveHint = phase === "playing" && !inTreasure && !inTrap && !portalPending && (unlockedForward || !question) && tappable.size > 0;

  return (
    <div className={`relative overflow-hidden min-h-dvh screen-in ${showExitConfirm ? "attempt-paused" : ""}`}>
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-5 py-8 pb-14 min-h-dvh flex flex-col">
        <div className="battle-header">
          <button onClick={() => { if (canInteract) { playModalOpen(); setShowExitConfirm(true); } }} aria-label="Назад" className="rpg-panel w-11 h-11 rounded-xl flex items-center justify-center text-xl text-amber-100 active:scale-95 transition">←</button>
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
                ref={gridRef}
                onKeyDown={handleGridKeyDown}
                className="relative mx-auto"
                style={{ display: "grid", gridTemplateColumns: buildTemplate(maze.cols), gridTemplateRows: buildTemplate(maze.rows), width: "100%", aspectRatio: `${maze.cols} / ${maze.rows}` }}
              >
                {Object.values(maze.cells).map((cell) => {
                  const isCurrent = cell.key === hero;
                  const isVisited = visited.has(cell.key);
                  const isRevealed = revealedSet.has(cell.key);
                  const displayType = !isVisited && cell.type === CELL.SECRET ? CELL.CORRIDOR : cell.type;
                  const isLockedExit = cell.type === CELL.EXIT && maze.requiresKey && !hasKey;
                  const isTappable = canInteract && tappable.has(cell.key);
                  const isNew = isTappable && !isVisited;
                  const badge = isNew ? cellBadge(maze, cell.key) : null;
                  const dir = isTappable ? directionOf(maze, hero, cell.key) : null;
                  const stateClass = isCurrent ? "maze-cell-current" : isVisited ? "maze-cell-visited" : isRevealed ? "maze-cell-known" : "maze-cell-fog";
                  const riskClass = isTappable ? cellRiskClass(maze, cell.key) : "";
                  return (
                    <button
                      key={cell.key}
                      ref={(el) => { if (el) cellRefs.current.set(cell.key, el); }}
                      type="button"
                      disabled={!isTappable}
                      tabIndex={isTappable ? 0 : -1}
                      data-cell-key={cell.key}
                      aria-label={isTappable ? cellAriaLabel(maze, hero, cell.key) : undefined}
                      onClick={() => handleCellTap(cell.key)}
                      style={{ gridColumn: cell.col * 2 + 1, gridRow: cell.row * 2 + 1 }}
                      className={`maze-cell ${stateClass} ${riskClass} ${isTappable ? "maze-cell-tappable" : ""} ${isTappable && strongPulse && tappable.size === 1 ? "maze-cell-strong-pulse" : ""} ${isLockedExit ? "maze-cell-locked" : ""}`}
                    >
                      {!isCurrent && (isVisited || isRevealed) && displayType !== CELL.CORRIDOR && displayType !== CELL.START && (
                        <div className="w-[58%] h-[58%]"><MazeIcon type={displayType} className="w-full h-full" /></div>
                      )}
                      {!isCurrent && isVisited && (displayType === CELL.CORRIDOR || displayType === CELL.START) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300/50" />
                      )}
                      {isLockedExit && (isVisited || isRevealed) && <span className="absolute -top-1.5 -right-1.5 w-5 h-5"><MazeIcon type="lock" className="w-full h-full" /></span>}
                      {badge && (
                        <span className="maze-door-badge">
                          <MazeIcon type={badge} className="w-full h-full" />
                        </span>
                      )}
                      {dir && <span className={`maze-cell-arrow maze-cell-arrow-${dir}`} aria-hidden="true">{DIR_ARROW[dir]}</span>}
                    </button>
                  );
                })}
                {renderedEdges.map((e) => {
                  const isActive = (e.a === hero && tappable.has(e.b)) || (e.b === hero && tappable.has(e.a));
                  const isKnown = revealedSet.has(e.a) && revealedSet.has(e.b);
                  return (
                    <div
                      key={e.id}
                      style={{ gridColumn: e.col, gridRow: e.row }}
                      className={`self-center justify-self-center ${e.dir === "h" ? "w-full h-1.5" : "w-1.5 h-full"} rounded-full ${isActive ? "maze-corridor-active" : isKnown ? "maze-corridor" : "maze-corridor-fog"}`}
                    />
                  );
                })}
                {heroBox && (
                  <div className="maze-hero-overlay" style={{ left: heroBox.left, top: heroBox.top, width: heroBox.width, height: heroBox.height }}>
                    <ArtImage src={`/assets/avatars/${avatar}.png`} fallback={heroIcon} alt="" className="maze-hero-token w-full h-full object-contain gentle-bounce" />
                  </div>
                )}
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
                  <AnswerGrid options={treasureQuestion.options} correct={treasureQuestion.correct} feedback={feedback} onAnswer={handleTreasureAnswer} />
                </>
              )}

              {inTrap && trapQuestion && (
                <>
                  <div className="maze-treasure-banner rounded-2xl px-4 py-2 text-center text-sky-100 text-xs font-bold" style={{ borderColor: "rgba(56,189,248,0.5)" }}>
                    ✦ Уникни пастки! ✦
                  </div>
                  <QuestCard prompt={trapQuestion.prompt} />
                  <AnswerGrid options={trapQuestion.options} correct={trapQuestion.correct} feedback={feedback} onAnswer={handleTrapAnswer} trapFlavor />
                </>
              )}

              {!!portalPending && (
                <div className="rpg-panel rpg-panel-gold rounded-3xl p-5 text-center w-full">
                  <div className="w-14 h-14 mx-auto mb-2"><MazeIcon type="portal" className="w-full h-full" /></div>
                  <div className="font-display font-bold text-amber-100 mb-3">Портал веде далі лабіринтом!</div>
                  <button onClick={handlePortalConfirm} className="play-button w-full text-indigo-950 font-display font-extrabold text-base py-3 rounded-2xl">
                    Стрибнути →
                  </button>
                </div>
              )}

              {showQuestionCard && (
                <>
                  <QuestCard title={questionCardTitle(forwardOptions, maze)} prompt={question.prompt} />
                  <AnswerGrid options={question.options} correct={question.correct} feedback={feedback} eliminated={eliminated} onAnswer={handleAnswer} />
                </>
              )}

              {showMoveHint && (
                <div className="maze-move-hint rounded-2xl px-5 py-3 text-center screen-in">
                  {unlockedForward ? "✦ Шлях відкрито — обери сусідню комірку ✦" : "Обери сусідню комірку"}
                </div>
              )}

              {showQuestionCard && (
                <button onClick={handleUseHint} disabled={hints <= 0 || !!feedback} className="maze-hint-btn rounded-xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-amber-100">
                  <ArtImage src="/assets/icons/ui/hint_lightbulb.png" fallback="💡" alt="" className="w-4 h-4 object-contain" />
                  Підказка ×{hints}
                </button>
              )}

              <div className="h-6 feedback-pop" key={feedback ? (feedback.correct ? "ok" : feedback.trap ? "trap" : "no") : "none"}>
                {feedback && (
                  <div className={`font-display font-bold text-sm ${feedback.correct ? "text-emerald-300" : feedback.trap ? "text-sky-300" : "text-rose-300"}`}>
                    {feedback.correct
                      ? feedback.treasure ? "+10 монет!" : "✦ Правильно! ✦"
                      : feedback.treasure ? "Цього разу без бонусу"
                      : feedback.trap ? "Ой, це коштувало життя…"
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
                <button onClick={() => onComplete(totalCoins, totalXp, { chestsFound, secretFound })} className="play-button w-full text-indigo-950 font-display font-extrabold text-lg py-3.5 rounded-2xl">
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
