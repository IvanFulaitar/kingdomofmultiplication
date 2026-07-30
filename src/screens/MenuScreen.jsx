import { useEffect, useRef, useState } from "react";
import { AVATARS } from "../data/cosmetics.js";
import { QUESTS } from "../data/rewards.js";
import { heroLevelFromXp } from "../game/progress.js";
import { isSoundEnabled, setSoundEnabled, playClick } from "../game/sound.js";
import { isMusicEnabled, setMusicEnabled } from "../game/music.js";
import { APP_VERSION, LAST_UPDATE } from "../version.js";
import StarIcon from "../components/StarIcon.jsx";
import ArtImage from "../components/ArtImage.jsx";

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 ${checked ? "bg-emerald-500/90" : "bg-white/15"}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export default function MenuScreen({ progress, onPlay, onBadges, onShop, onTraining }) {
  const avatar = AVATARS.find((a) => a.id === progress.avatar) ?? AVATARS[0];
  const { level, into, need } = heroLevelFromXp(progress.xp);
  const [sfxOn, setSfxOn] = useState(() => isSoundEnabled());
  const [musicOn, setMusicOn] = useState(() => isMusicEnabled());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const xpPct = (into / need) * 100;

  function toggleSfx(next) {
    setSfxOn(next);
    setSoundEnabled(next);
    if (next) playClick();
  }

  function toggleMusic(next) {
    setMusicOn(next);
    setMusicEnabled(next);
    if (sfxOn) playClick();
  }

  useEffect(() => {
    if (!settingsOpen) return;
    function onOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setSettingsOpen(false);
    }
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />

      <div ref={settingsRef} className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          aria-label="Налаштування звуку"
          aria-expanded={settingsOpen}
          className="rpg-panel rpg-panel-gold w-10 h-10 rounded-xl flex items-center justify-center text-lg active:scale-95 transition"
        >
          {sfxOn || musicOn ? "🔊" : "🔇"}
        </button>
        {settingsOpen && (
          <div className="absolute right-0 mt-2 menu-panel rounded-2xl p-3 w-48 flex flex-col gap-2.5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-white">Музика</span>
              <ToggleSwitch checked={musicOn} onChange={toggleMusic} label="Увімкнути/вимкнути музику" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-white">Звуки</span>
              <ToggleSwitch checked={sfxOn} onChange={toggleSfx} label="Увімкнути/вимкнути звукові ефекти" />
            </div>
          </div>
        )}
      </div>

      <span className="app-version-tag absolute top-4 left-4 z-20 select-none leading-tight" aria-hidden="true">
        v{APP_VERSION}<br />{LAST_UPDATE}
      </span>

      <div className="relative z-10 max-w-md mx-auto px-7 py-10 flex flex-col items-center gap-6 pb-14">
        <div className="text-center relative">
          <div className="staff-glow" />
          <ArtImage
            key={avatar.id}
            src={`/assets/avatars/${avatar.id}.png`}
            fallback={avatar.icon}
            alt={avatar.id}
            fetchPriority="high"
            className="relative w-56 sm:w-64 h-56 sm:h-64 mx-auto mb-1 object-contain flex items-center justify-center text-8xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
          />
          <h1 className="font-display gold-text text-4xl font-extrabold mt-2 tracking-wide">Королівство Математики</h1>
          <p className="text-violet-200 mt-1.5 text-base">Мандруй, розв'язуй, опановуй магію чисел</p>
        </div>

        <div className="w-full grid grid-cols-3 gap-3">
          <div className="menu-resource-pill rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2">
            <StarIcon filled /> <span className="font-extrabold text-xl">{progress.totalStars}</span>
          </div>
          <div className="menu-resource-pill-gold rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2 text-indigo-950">
            <ArtImage src="/assets/icons/ui/coin.png" fallback="🪙" alt="монети" className="w-6 h-6 object-contain inline-flex items-center justify-center" />
            <span className="font-extrabold text-2xl">{progress.coins}</span>
          </div>
          <div className="menu-resource-pill rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2">
            <ArtImage src="/assets/icons/ui/flame.png" fallback="🔥" alt="стрік" className="w-6 h-6 object-contain inline-flex items-center justify-center" />
            <span className="font-extrabold text-xl">{progress.streak.current}</span>
          </div>
        </div>

        <div className="w-full menu-panel rounded-3xl px-5 py-4">
          <div className="flex items-center gap-3.5 mb-2">
            <div className="menu-level-badge w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-indigo-950 text-lg shrink-0">
              {level}
            </div>
            <span className="font-display font-bold text-lg flex-1">Рівень героя {level}</span>
            <span className="text-sm text-violet-100 font-semibold">{into}/{need} XP</span>
          </div>
          <div className="h-5 menu-xp-track rounded-full relative">
            <div className="h-full menu-xp-fill rounded-full transition-all" style={{ width: `${xpPct}%` }} />
            <span className="menu-xp-glow-dot absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${xpPct}% - 5px)` }} aria-hidden="true" />
          </div>
        </div>

        <div className="w-full menu-panel rounded-3xl pt-8 pb-4 px-4 relative">
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 menu-quest-banner px-8 py-1 whitespace-nowrap">
            <span className="font-display font-bold text-amber-300 text-xs">✦ Щоденні завдання ✦</span>
          </div>
          <div className="flex flex-col mt-2 divide-y divide-white/10">
            {QUESTS.map((q) => {
              const p = q.progress(progress.daily);
              const done = progress.daily.claimed.includes(q.id) || p >= q.target;
              return (
                <div key={q.id} className={`flex items-center gap-3 text-sm py-2.5 px-1.5 -mx-1.5 rounded-lg ${done ? "" : "bg-white/[0.03]"}`}>
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 border ${done ? "bg-emerald-600/25 border-emerald-400/50 menu-quest-check-glow" : "bg-indigo-950/60 border-amber-400/30"}`}>
                    {done ? "✅" : q.icon}
                  </span>
                  <span className={`flex-1 ${done ? "text-violet-200/65 line-through decoration-1" : "text-white"}`}>{q.label}</span>
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 border ${done ? "text-emerald-300 bg-emerald-600/20 border-emerald-400/40" : "text-white/80 menu-quest-badge-active"}`}>
                    {Math.min(p, q.target)}/{q.target}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative w-full">
          <button onClick={() => { playClick(); onPlay(); }} className="hero-play-button relative w-full min-h-[66px]">
            <span className="hero-play-shine" aria-hidden="true" />
            <span className="relative z-10 grid grid-cols-[1.5rem_1fr_1.5rem] items-center gap-2 px-8 h-full">
              <span className="hero-play-diamond justify-self-start" aria-hidden="true" />
              <span className="hero-play-text font-display font-extrabold text-4xl tracking-wide justify-self-center">ГРАТИ</span>
              <span className="hero-play-diamond justify-self-end" aria-hidden="true" />
            </span>
          </button>
          <span className="hero-play-sparkle hero-play-sparkle-tl" aria-hidden="true" />
          <span className="hero-play-sparkle hero-play-sparkle-tr" aria-hidden="true" />
          <span className="hero-play-sparkle hero-play-sparkle-bl" aria-hidden="true" />
          <span className="hero-play-sparkle hero-play-sparkle-br" aria-hidden="true" />
        </div>

        <div className="w-full grid grid-cols-3 gap-3">
          <button onClick={() => { playClick(); onBadges(); }} className="menu-nav-button rounded-[20px] py-4 flex flex-col items-center gap-1.5">
            <ArtImage src="/assets/icons/ui/trophy.png" fallback="🏆" alt="" className="text-3xl w-9 h-9 object-contain flex items-center justify-center" />
            <span className="font-bold text-sm text-white">Досягнення</span>
          </button>
          <button onClick={() => { playClick(); onShop(); }} className="menu-nav-button rounded-[20px] py-4 flex flex-col items-center gap-1.5">
            <ArtImage src="/assets/icons/ui/shop.png" fallback="🛍️" alt="" className="text-3xl w-9 h-9 object-contain flex items-center justify-center" />
            <span className="font-bold text-sm text-white">Магазин</span>
          </button>
          <button onClick={() => { playClick(); onTraining(); }} className="menu-nav-button rounded-[20px] py-4 flex flex-col items-center gap-1.5">
            <ArtImage src="/assets/icons/ui/target.png" fallback="🎯" alt="" className="text-3xl w-9 h-9 object-contain flex items-center justify-center" />
            <span className="font-bold text-sm text-white">Тренування</span>
          </button>
        </div>

        <a
          className="creator-link"
          href="https://www.instagram.com/ivan_stepanowich"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram автора гри Ivan Stepanowich"
        >
          <span className="creator-link__icon" aria-hidden="true">◎</span>
          <span><span className="creator-link__label">Автор гри </span><strong>@ivan_stepanowich</strong></span>
        </a>
      </div>
    </div>
  );
}
