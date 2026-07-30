import { AVATARS } from "../data/cosmetics.js";
import { QUESTS } from "../data/rewards.js";
import { heroLevelFromXp } from "../game/progress.js";
import StarIcon from "../components/StarIcon.jsx";
import ArtImage from "../components/ArtImage.jsx";

export default function MenuScreen({ progress, onPlay, onBadges, onShop, onTraining }) {
  const avatar = AVATARS.find((a) => a.id === progress.avatar) ?? AVATARS[0];
  const { level, into, need } = heroLevelFromXp(progress.xp);

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-6 py-10 flex flex-col items-center gap-6 pb-14">
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

        <div className="flex gap-3 justify-center">
          <div className="resource-pill rounded-2xl px-5 py-2.5 flex items-center gap-2">
            <StarIcon filled /> <span className="font-bold text-lg">{progress.totalStars}</span>
          </div>
          <div className="resource-pill-gold rounded-2xl px-5 py-2.5 flex items-center gap-2 text-indigo-950">
            <ArtImage src="/assets/icons/ui/coin.png" fallback="🪙" alt="монети" className="w-6 h-6 object-contain inline-flex items-center justify-center" />
            <span className="font-extrabold text-lg">{progress.coins}</span>
          </div>
          <div className="resource-pill rounded-2xl px-5 py-2.5 flex items-center gap-2">
            <ArtImage src="/assets/icons/ui/flame.png" fallback="🔥" alt="стрік" className="w-6 h-6 object-contain inline-flex items-center justify-center" />
            <span className="font-bold text-lg">{progress.streak.current}</span>
          </div>
        </div>

        <div className="w-full rpg-panel rpg-panel-gold rounded-3xl p-5">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-amber-300 to-amber-600 border-2 border-amber-100/80 flex items-center justify-center font-display font-extrabold text-indigo-950 text-lg shrink-0 shadow">
              {level}
            </div>
            <span className="font-display font-bold text-base flex-1">Рівень героя {level}</span>
            <span className="text-sm text-violet-200 font-semibold">{into}/{need} XP</span>
          </div>
          <div className="h-4 xp-track rounded-full overflow-hidden">
            <div className="h-full xp-fill rounded-full transition-all" style={{ width: `${(into / need) * 100}%` }} />
          </div>
        </div>

        <div className="w-full rpg-panel rounded-3xl pt-7 pb-5 px-4 relative">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rpg-banner-fill px-6 py-1.5 whitespace-nowrap">
            <span className="font-display font-bold text-amber-300 text-xs">✦ Щоденні завдання ✦</span>
          </div>
          <div className="flex flex-col gap-3.5 mt-1">
            {QUESTS.map((q) => {
              const p = q.progress(progress.daily);
              const done = progress.daily.claimed.includes(q.id) || p >= q.target;
              return (
                <div key={q.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 border ${done ? "bg-emerald-600/25 border-emerald-400/50" : "bg-indigo-950/60 border-amber-400/30"}`}>
                    {done ? "✅" : q.icon}
                  </span>
                  <span className={`flex-1 ${done ? "text-white/40 line-through" : "text-white"}`}>{q.label}</span>
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 border ${done ? "text-emerald-300 bg-emerald-600/20 border-emerald-400/40" : "text-white/70 rpg-panel"}`}>
                    {Math.min(p, q.target)}/{q.target}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={onPlay} className="play-button relative w-full text-indigo-950 font-display font-extrabold text-xl py-4 rounded-2xl" style={{ clipPath: "polygon(2% 0%, 98% 0%, 100% 50%, 98% 100%, 2% 100%, 0% 50%)" }}>
          <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-white/25 pointer-events-none" />
          <span className="relative grid grid-cols-[2rem_1fr_2rem] items-center px-2">
            <span className="sparkle-spin justify-self-start text-amber-900">✦</span>
            <span>ГРАТИ</span>
            <span className="sparkle-spin justify-self-end text-amber-900">✦</span>
          </span>
        </button>

        <div className="w-full grid grid-cols-3 gap-3">
          <button onClick={onBadges} className="rpg-panel rpg-panel-gold hover:brightness-125 active:scale-95 active:brightness-110 transition rounded-xl py-3.5 flex flex-col items-center gap-1.5">
            <ArtImage src="/assets/icons/ui/trophy.png" fallback="🏆" alt="" className="text-3xl w-8 h-8 object-contain flex items-center justify-center" />
            <span className="font-semibold text-xs text-white">Досягнення</span>
          </button>
          <button onClick={onShop} className="rpg-panel rpg-panel-gold hover:brightness-125 active:scale-95 active:brightness-110 transition rounded-xl py-3.5 flex flex-col items-center gap-1.5">
            <ArtImage src="/assets/icons/ui/shop.png" fallback="🛍️" alt="" className="text-3xl w-8 h-8 object-contain flex items-center justify-center" />
            <span className="font-semibold text-xs text-white">Магазин</span>
          </button>
          <button onClick={onTraining} className="rpg-panel rpg-panel-gold hover:brightness-125 active:scale-95 active:brightness-110 transition rounded-xl py-3.5 flex flex-col items-center gap-1.5">
            <ArtImage src="/assets/icons/ui/target.png" fallback="🎯" alt="" className="text-3xl w-8 h-8 object-contain flex items-center justify-center" />
            <span className="font-semibold text-xs text-white">Тренування</span>
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
          <span>Автор гри <strong>@ivan_stepanowich</strong></span>
        </a>
      </div>
    </div>
  );
}
