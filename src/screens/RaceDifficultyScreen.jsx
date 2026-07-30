import { useState } from "react";
import {
  RACE_DIFFICULTY_ORDER, RACE_DIFFICULTIES,
  getSavedRaceDifficulty, saveRaceDifficulty,
} from "../data/raceDifficulties.js";
import { isChampionRaceUnlocked, getRaceRecommendation } from "../game/progress.js";
import { playUiClick, playUiPrimary } from "../game/sfx.js";
import TopBar from "../components/TopBar.jsx";
import LockBadge from "../components/LockBadge.jsx";
import ArtImage from "../components/ArtImage.jsx";

function DiffIcon({ theme, icon }) {
  return (
    <span className={`race-diff-icon race-diff-icon-${theme}`}>
      {icon === "shield" && <span className="race-diff-shield" />}
      {icon === "flag" && <span className="race-diff-flag" />}
      {icon === "bolt" && <span className="race-diff-bolt" />}
    </span>
  );
}

// Три великі картки складності + кнопка запуску — не пускає заїзд одним
// натисканням на картку (щоб дитина випадково не обрала не той режим):
// спершу оберіть картку, потім підтвердіть окремою кнопкою "ПОЧАТИ ЗАЇЗД".
export default function RaceDifficultyScreen({ progress, onBack, onStart }) {
  const championUnlocked = isChampionRaceUnlocked(progress);
  const recommendation = getRaceRecommendation(progress.raceHistory ?? []);

  const [selected, setSelected] = useState(() => {
    const saved = getSavedRaceDifficulty();
    if (saved === "champion" && !championUnlocked) return null;
    return saved;
  });

  function pick(id, unlocked) {
    if (!unlocked) return;
    playUiClick();
    setSelected(id);
  }

  function handleStart() {
    if (!selected) return;
    playUiPrimary();
    saveRaceDifficulty(selected);
    onStart(selected);
  }

  const chosenCfg = selected ? RACE_DIFFICULTIES[selected] : null;

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-40 min-h-dvh flex flex-col">
        <div className="relative mb-7">
          <div className="modal-ornament absolute -top-5 left-1/2 -translate-x-1/2 z-10" style={{ width: "2.5rem", height: "2.5rem", fontSize: "1rem" }}>
            🏁
          </div>
          <div className="rpg-panel rpg-panel-gold rounded-2xl py-3 px-1">
            <TopBar onBack={onBack} title="Обери складність" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {RACE_DIFFICULTY_ORDER.map((id) => {
            const cfg = RACE_DIFFICULTIES[id];
            const unlocked = id !== "champion" || championUnlocked;
            const isSelected = selected === id;
            const showRecoPill = recommendation && recommendation.to === id;

            return (
              <button
                key={id}
                type="button"
                disabled={!unlocked}
                onClick={() => pick(id, unlocked)}
                className={`race-diff-card rpg-panel rounded-3xl p-4 flex flex-col gap-3 w-full race-diff-card-${cfg.theme} ${
                  isSelected ? "race-diff-card-selected" : ""
                } ${unlocked ? "" : "race-diff-card-locked"}`}
              >
                {isSelected && <span className="race-diff-check">✓</span>}
                {showRecoPill && unlocked && (
                  <span className="race-diff-reco-pill">
                    {recommendation.type === "harder" ? "Спробуй складніше!" : "Рекомендуємо тренувальний заїзд"}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <DiffIcon theme={cfg.theme} icon={cfg.icon} />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-extrabold text-base text-white">{cfg.label}</span>
                      <span className="text-[11px] text-violet-200/80 font-semibold">«{cfg.tagline}»</span>
                    </div>
                    <p className="text-xs text-violet-100/90 leading-snug mt-1">{cfg.description}</p>
                  </div>
                  {!unlocked && <LockBadge />}
                </div>

                {unlocked ? (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`race-diff-badge ${
                        cfg.theme === "training" ? "race-diff-badge-training" : cfg.theme === "champion" ? "race-diff-badge-risk" : "race-diff-badge-recommended"
                      }`}
                    >
                      {cfg.footerNote}
                    </span>
                    <span className="flex items-center gap-2 text-xs font-bold text-amber-200 shrink-0">
                      <ArtImage src="/assets/icons/ui/coin.png" fallback="🪙" alt="" className="w-4 h-4 object-contain" />
                      {cfg.reward.coins}
                      <span className="text-violet-300">·</span>
                      {cfg.reward.xp} XP
                      <span className="text-violet-300">·</span>
                      ×{cfg.reward.multiplier}
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-200/90 font-semibold">🔒 {cfg.lockHint}</div>
                )}

                {isSelected && unlocked && (
                  <div className="exit-progress-panel rounded-xl px-3 py-2 text-left text-[11px] text-violet-100 leading-relaxed screen-in">
                    {cfg.rounds} раундів · {cfg.timeLimit} с на відповідь · {cfg.theme === "champion" ? "змішані приклади" : "приклади в межах теми"}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 bg-gradient-to-t from-indigo-950 via-indigo-950/95 to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleStart}
            disabled={!chosenCfg}
            className="next-challenge-button relative w-full rounded-2xl px-4 py-4 text-indigo-950 font-display overflow-hidden disabled:opacity-45 disabled:grayscale disabled:pointer-events-none"
          >
            {chosenCfg && <span className="next-challenge-shine" />}
            <span className="relative z-10 block text-center">
              <span className="block text-xl font-extrabold leading-tight tracking-wide">ПОЧАТИ ЗАЇЗД</span>
              <span className="block text-xs sm:text-sm font-body font-extrabold text-amber-950/75 mt-0.5">
                {chosenCfg ? `${chosenCfg.label} · нагорода ×${chosenCfg.reward.multiplier}` : "Спершу обери картку вище"}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
