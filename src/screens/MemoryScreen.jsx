import { useEffect, useRef, useState } from "react";
import { buildMemoryCards } from "../game/memory.js";
import {
  preloadSfxGroup, playCardFlip, playPairMatch, playPairWrong, playMemoryComplete, playHintSfx, playModalOpen,
} from "../game/sfx.js";
import ArtImage from "../components/ArtImage.jsx";
import ExitConfirmModal from "../components/ExitConfirmModal.jsx";

export default function MemoryScreen({ onBack, onComplete }) {
  const [cards] = useState(() => buildMemoryCards());
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [lastWrong, setLastWrong] = useState(false);
  const [resultMsg, setResultMsg] = useState(null); // "match" | "miss" | null
  const [hints, setHints] = useState(3);
  const [hintIds, setHintIds] = useState([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const busyRef = useRef(false);
  const exitConfirmRef = useRef(false);

  const done = matched.length === cards.length;
  const pairsTotal = cards.length / 2;
  const pairsFound = matched.length / 2;

  useEffect(() => {
    exitConfirmRef.current = showExitConfirm;
  }, [showExitConfirm]);

  useEffect(() => {
    preloadSfxGroup("memory");
  }, []);

  useEffect(() => {
    if (done) playMemoryComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  useEffect(() => {
    window.history.pushState({ activeAttempt: "memory" }, "");
    function handlePopState() {
      if (exitConfirmRef.current) {
        setShowExitConfirm(false);
      } else {
        setShowExitConfirm(true);
      }
      window.history.pushState({ activeAttempt: "memory" }, "");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function handleFlip(card) {
    if (showExitConfirm || busyRef.current || flipped.includes(card.id) || matched.includes(card.id) || hintIds.length) return;
    playCardFlip();
    const next = [...flipped, card.id];
    setFlipped(next);

    if (next.length === 2) {
      setMoves((m) => m + 1);
      busyRef.current = true;
      const first = cards.find((c) => c.id === next[0]);
      const second = cards.find((c) => c.id === next[1]);
      const isMatch = first.matchId === second.matchId && first.kind !== second.kind;
      if (isMatch) {
        setResultMsg("match");
        setMatched((m) => [...m, first.id, second.id]);
        playPairMatch();
      } else {
        setTimeout(() => {
          setLastWrong(true);
          setResultMsg("miss");
          playPairWrong();
        }, 550);
      }
      setTimeout(() => {
        setFlipped([]);
        setLastWrong(false);
        setResultMsg(null);
        busyRef.current = false;
      }, isMatch ? 600 : 900);
    }
  }

  function giveHint() {
    if (showExitConfirm || hints <= 0 || busyRef.current || hintIds.length) return;
    const pool = cards.filter((c) => !matched.includes(c.id));
    const byMatch = {};
    pool.forEach((c) => { (byMatch[c.matchId] ??= []).push(c.id); });
    const pairs = Object.values(byMatch).filter((arr) => arr.length === 2);
    if (!pairs.length) return;
    const pick = pairs[Math.floor(Math.random() * pairs.length)];
    setHints((h) => h - 1);
    busyRef.current = true;
    setHintIds(pick);
    playHintSfx();
    setTimeout(() => { setHintIds([]); busyRef.current = false; }, 1200);
  }

  return (
    <div className={`relative overflow-hidden min-h-dvh screen-in ${showExitConfirm ? "attempt-paused" : ""}`}>
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-4 py-8 pb-10 min-h-dvh flex flex-col">
        <div className="flex items-start gap-2 w-full min-w-0">
          <button onClick={() => { playModalOpen(); setShowExitConfirm(true); }} className="rpg-panel rpg-panel-gold rounded-xl w-11 h-11 flex items-center justify-center text-xl text-amber-100 active:scale-95 transition shrink-0 mt-2">←</button>

          <div className="flex-1 min-w-0 relative mt-6">
            <div className="modal-ornament absolute -top-9 left-1/2 -translate-x-1/2 z-10" style={{ width: "3.25rem", height: "3.25rem", fontSize: "1.5rem", background: "linear-gradient(180deg, #fbcfe8, #f472b6 60%, #db2777)" }}>
              <ArtImage src="/assets/icons/achievements/brain.png" fallback="🧠" alt="" className="w-8 h-8 object-contain" />
            </div>
            <div className="rpg-panel rpg-panel-gold rounded-2xl px-4 py-3 text-center">
              <h2 className="font-display gold-text font-extrabold text-base sm:text-lg tracking-wide truncate">✦ Математична пам'ять ✦</h2>
            </div>
          </div>

          <button
            onClick={giveHint}
            disabled={hints <= 0}
            className="rpg-panel rpg-panel-gold rounded-xl w-14 sm:w-16 py-2 flex flex-col items-center gap-0.5 shrink-0 mt-2 relative active:scale-95 transition disabled:opacity-40"
          >
            <span className="hint-count-badge absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white">{hints}</span>
            <ArtImage src="/assets/icons/ui/hint_lightbulb.png" fallback="💡" alt="" className="w-6 h-6 object-contain" />
            <span className="text-[10px] font-semibold text-white/80">Підказки</span>
          </button>
        </div>

        <div className="rpg-panel rounded-2xl px-4 py-3 mt-4 flex items-center">
          <div className="flex-1 flex items-center gap-2 justify-center">
            <span className="text-lg">👣</span>
            <span className="text-sm text-white/70">Ходів: <span className="text-lg font-bold text-white">{moves}</span></span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 px-2">
            <div className="w-px h-6 bg-amber-400/40" />
            <span className="text-amber-400/70 text-xs">◆</span>
            <div className="w-px h-6 bg-amber-400/40" />
          </div>
          <div className="flex-1 flex items-center gap-2 justify-center">
            <span className="text-lg">⭐</span>
            <span className="text-sm text-white/70">Пар: <span className="text-lg font-bold text-white">{pairsFound}/{pairsTotal}</span></span>
          </div>
        </div>

        <div className="flex gap-1 mt-2.5 px-1">
          {Array.from({ length: pairsTotal }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < pairsFound ? "bg-gradient-to-r from-amber-300 to-emerald-400" : "bg-white/10"}`} />
          ))}
        </div>

        <div className="h-7 text-center mt-4 feedback-pop" key={resultMsg ?? "none"}>
          {resultMsg === "match" && <span className="text-emerald-300 font-display font-bold text-sm">Пара знайдена!</span>}
          {resultMsg === "miss" && <span className="text-rose-300 font-display font-bold text-sm">Спробуй запам'ятати їх</span>}
        </div>

        <div className="grid grid-cols-3 gap-2.5 mt-1">
          {cards.map((card) => {
            const isFaceUp = flipped.includes(card.id) || matched.includes(card.id) || hintIds.includes(card.id);
            const isMatched = matched.includes(card.id);
            const isWrong = lastWrong && flipped.includes(card.id);
            const isHinted = hintIds.includes(card.id);
            const isWaiting = isFaceUp && !isMatched && !isWrong && flipped.length === 1 && flipped.includes(card.id);
            const isChecking = flipped.length === 2 || hintIds.length > 0;
            const disabled = isMatched || isChecking || busyRef.current;

            let faceClass = "memory-card-back";
            if (isMatched) faceClass = `memory-card-face memory-card-${card.kind} memory-card-matched`;
            else if (isWrong) faceClass = `memory-card-face memory-card-${card.kind} memory-card-wrong`;
            else if (isFaceUp) faceClass = `memory-card-face memory-card-${card.kind} ${isWaiting ? "memory-card-waiting" : ""}`;

            return (
              <button
                key={`${card.id}-${isFaceUp}`}
                onClick={() => handleFlip(card)}
                disabled={disabled}
                className={`memory-card card-flip relative aspect-square rounded-2xl flex items-center justify-center font-display font-extrabold ${faceClass} ${
                  isHinted ? "ring-2 ring-amber-300" : ""
                }`}
              >
                {!isFaceUp && (
                  <>
                    <span className="memory-card-symbol memory-card-symbol-top">×</span>
                    <span className="memory-card-symbol memory-card-symbol-left">7</span>
                    <span className="memory-card-symbol memory-card-symbol-right">+</span>
                    <span className="memory-card-symbol memory-card-symbol-bottom">=</span>
                    <span className="memory-card-diamond" />
                    <span className="memory-card-spark" />
                  </>
                )}
                {isFaceUp && <span className={`memory-card-type-icon ${card.kind === "expr" ? "memory-card-type-book" : "memory-card-type-crystal"}`} />}
                {(isMatched || isWrong) && <span className={`memory-card-status ${isMatched ? "memory-card-status-ok" : "memory-card-status-bad"}`}>{isMatched ? "✓" : "×"}</span>}
                <span className="memory-card-value">{isFaceUp ? card.label : "?"}</span>
                {isMatched && <span className="memory-card-match-line" />}
              </button>
            );
          })}
        </div>

        {!done && (
          <div className="rpg-panel rpg-panel-gold rounded-3xl pt-2 pb-4 px-4 mt-4 relative overflow-visible flex items-end gap-3">
            <ArtImage
              src="/assets/avatars/wizard.png"
              fallback="🧙"
              className="text-6xl w-20 h-20 object-contain shrink-0 -mt-8 drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]"
            />
            <div className="flex-1 min-w-0 pb-1">
              <div className="font-display font-bold text-amber-300 text-sm flex items-center gap-1.5">
                <span className="text-base">💡</span> Порада чарівника
              </div>
              <div className="text-xs text-violet-100 mt-1 leading-relaxed">Запам'ятовуй позиції карток, щоб знаходити пари швидше!</div>
            </div>
            <div className="shrink-0 w-14 h-16 rounded-md bg-gradient-to-br from-amber-100 to-amber-300 border-2 border-amber-600/60 shadow-lg flex flex-col items-center justify-center relative mb-1">
              <div className="absolute -top-1 right-1.5 w-2 h-3 bg-violet-600 rounded-b" />
              <span className="text-indigo-950 font-display font-bold text-[10px] leading-tight text-center px-0.5">2×3<br/>=6</span>
            </div>
          </div>
        )}

        {done && (
          <div className="rpg-panel rpg-panel-gold rounded-3xl p-5 mt-4 text-center screen-in">
            <div className="font-display gold-text font-extrabold text-xl mb-1">Усі пари знайдено! 🎉</div>
            <div className="text-violet-200 text-sm mb-4">Нагорода: 20 монет, 20 XP</div>
            <button onClick={() => onComplete(20, 20)} className="play-button w-full text-indigo-950 font-display font-extrabold text-lg py-3.5 rounded-2xl">
              Забрати нагороду
            </button>
          </div>
        )}
      </div>
      {showExitConfirm && (
        <ExitConfirmModal
          modeType="training"
          levelName="Математична пам'ять"
          currentProgress={pairsFound}
          totalProgress={pairsTotal}
          destination="training"
          destinationLabel="Вийти до тренувань"
          onContinue={() => setShowExitConfirm(false)}
          onExit={onBack}
        />
      )}
    </div>
  );
}
