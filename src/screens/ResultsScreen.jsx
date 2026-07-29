import { LEVEL_META, REGIONS } from "../data/regions.js";
import { heroLevelFromXp } from "../game/progress.js";
import ArtImage from "../components/ArtImage.jsx";

const levelIds = Object.keys(LEVEL_META).map(Number).sort((a, b) => a - b);

function regionForLevel(levelId) {
  return REGIONS.find((r) => r.levels.includes(levelId));
}

function victoryActionFor(levelId) {
  const currentIndex = levelIds.indexOf(levelId);
  const nextLevelId = levelIds[currentIndex + 1];
  if (!nextLevelId) {
    return {
      label: "До карти королівства",
      subtitle: "Уся доступна карта завершена",
      targetLevelId: null,
    };
  }

  const currentRegion = regionForLevel(levelId);
  const nextRegion = regionForLevel(nextLevelId);
  const nextMeta = LEVEL_META[nextLevelId];
  if (currentRegion?.id !== nextRegion?.id) {
    return {
      label: "Відкрити новий регіон",
      subtitle: `${nextRegion.name}: ${nextMeta.title}`,
      targetLevelId: nextLevelId,
    };
  }

  return {
    label: "Наступний виклик",
    subtitle: `${nextMeta.title} — виклик ${nextLevelId}/${levelIds.length}`,
    targetLevelId: nextLevelId,
  };
}

export default function ResultsScreen({ outcome, progress, onContinue, onRetry, onNextChallenge }) {
  const meta = LEVEL_META[outcome.levelId];
  const heroInfo = heroLevelFromXp(progress.xp);

  if (!outcome.won) {
    const region = REGIONS.find((r) => r.levels.includes(outcome.levelId));

    return (
      <div className="relative overflow-hidden min-h-dvh screen-in">
        {region && (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `url(/assets/backgrounds/${region.id}.png)`, backgroundSize: "cover", backgroundPosition: "center" }}
          />
        )}
        <div className="battle-vignette" />

        <div className="relative z-10 max-w-md mx-auto px-6 py-8 min-h-dvh flex flex-col items-center text-center">
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 mt-2 mb-3 shrink-0">
            <div className="enemy-stand-glow" />
            <ArtImage
              src={`/assets/monsters/${outcome.levelId}.png`}
              fallback={meta.enemy.icon}
              className="relative w-full h-full object-contain flex items-center justify-center text-8xl gentle-bounce"
            />
          </div>

          <h2 className="font-display coral-text font-extrabold text-3xl mb-5 flex items-center gap-2">
            <span className="text-lg text-amber-200/70">❖</span> Цього разу не вийшло <span className="text-lg text-amber-200/70">❖</span>
          </h2>

          <div className="w-full rpg-panel rpg-panel-gold rounded-3xl p-5 mb-5">
            <div className="flex items-start gap-3 text-left">
              <span className="text-2xl shrink-0">🍃</span>
              <p className="text-white text-sm leading-relaxed">
                {meta.enemy.name} встояв — правильних відповідей:{" "}
                <span className="font-bold coral-text text-base">{outcome.correctCount}/8</span>
              </p>
            </div>
            <div className="flex items-center gap-2 my-3.5">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
              <span className="text-amber-400/80 text-xs shrink-0">◆</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
            </div>
            <div className="flex items-start gap-3 text-left">
              <span className="text-2xl shrink-0">💡</span>
              <p className="text-violet-100 text-sm leading-relaxed">
                <span className="font-bold text-amber-200">Спробуй ще раз</span> — слабкі приклади тепер траплятимуться частіше.
              </p>
            </div>
          </div>

          <div className="w-full rpg-panel rpg-panel-gold rounded-3xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber-400/40" />
              <span className="font-display font-bold text-amber-200 text-sm shrink-0">✦ Прогрес рівня ✦</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-amber-400/40" />
            </div>
            <div className="flex justify-between gap-1">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm ${
                      i < outcome.correctCount ? "medallion-correct text-emerald-950 font-bold" : "medallion-future"
                    }`}
                  >
                    {i < outcome.correctCount ? "✓" : ""}
                  </div>
                  <span className="text-[11px] text-violet-200 font-semibold">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-violet-200 text-xs mb-6 flex items-center gap-1.5 justify-center">
            <ArtImage src="/assets/icons/ui/star.png" fallback="" alt="" className="w-4 h-4 object-contain" />
            Правильних відповідей: {outcome.correctCount}. Наступного разу буде ще краще!
          </p>

          <div className="w-full flex flex-col gap-3 mt-auto">
            <button onClick={onRetry} className="play-button relative w-full text-indigo-950 font-display font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-3">
              <span className="retry-arrow-badge w-9 h-9 rounded-full flex items-center justify-center text-lg text-amber-100 shrink-0">↻</span>
              Спробувати ще раз
            </button>
            <button onClick={onContinue} className="rpg-panel rpg-panel-gold hover:brightness-110 active:scale-[0.98] transition w-full rounded-2xl py-3.5 font-display font-bold text-base flex items-center justify-center gap-2.5">
              <ArtImage src="/assets/icons/ui/map_scroll.png" fallback="🗺️" alt="" className="w-6 h-6 object-contain" />
              До карти
            </button>
          </div>
        </div>
      </div>
    );
  }

  const victoryAction = victoryActionFor(outcome.levelId);

  return (
    <div className="max-w-md mx-auto px-6 py-10 min-h-dvh flex flex-col items-center screen-in">
      <div className="relative w-28 h-28 mb-3 shrink-0">
        <div className="victory-orbit" />
        <div className="victory-spark victory-spark-a" />
        <div className="victory-spark victory-spark-b" />
        <ArtImage
          src={`/assets/monsters/${outcome.levelId}.png`}
          fallback=""
          alt={meta.enemy.name}
          className="relative z-10 w-full h-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]"
        />
      </div>
      <h2 className="font-display font-bold text-2xl text-amber-300 mb-1">Перемога!</h2>
      <p className="text-white/60 mb-6">{meta.enemy.name} переможено</p>

      <div className="flex gap-2 mb-6">
        {[0, 1, 2].map((i) => (
          <ArtImage
            key={i}
            src="/assets/icons/ui/star.png"
            fallback=""
            alt=""
            className={`w-14 h-14 object-contain ${i < outcome.newStars ? "star-pop" : "opacity-20 grayscale"}`}
            style={i < outcome.newStars ? { animationDelay: `${i * 0.15}s` } : undefined}
          />
        ))}
      </div>

      <div className="w-full rpg-panel rounded-2xl p-4 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/60">Монети</span>
          <span className="font-bold text-amber-300 flex items-center gap-1.5">
            +{outcome.coinGain}
            <ArtImage src="/assets/icons/ui/coin.png" fallback="" alt="" className="w-5 h-5 object-contain" />
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Досвід</span>
          <span className="font-bold text-violet-300">+{outcome.xpGain} XP</span>
        </div>
      </div>

      <div className="w-full mb-8">
        <div className="flex justify-between text-xs text-white/50 mb-1">
          <span className="flex items-center gap-1.5">
            <ArtImage src="/assets/icons/ui/trophy.png" fallback="" alt="" className="w-4 h-4 object-contain" />
            Рівень героя {heroInfo.level}
          </span>
          {outcome.leveledUp && <span className="text-amber-300 font-bold">Новий рівень!</span>}
        </div>
        <div className={`h-2 bg-black/30 rounded-full overflow-hidden border border-white/5 ${outcome.leveledUp ? "level-flash" : ""}`}>
          <div className="h-full bg-gradient-to-r from-violet-500 to-violet-300 bar-grow" style={{ width: `${(heroInfo.into / heroInfo.need) * 100}%` }} />
        </div>
      </div>

      <div className="w-full flex flex-col gap-3">
        <button
          onClick={() => onNextChallenge(victoryAction.targetLevelId)}
          className="next-challenge-button relative w-full rounded-2xl px-4 py-4 text-indigo-950 font-display overflow-hidden"
        >
          <span className="next-challenge-shine" />
          <span className="relative z-10 grid grid-cols-[1fr_3rem] items-center gap-3">
            <span className="min-w-0 text-left">
              <span className="block text-xl font-extrabold leading-tight">{victoryAction.label}</span>
              <span className="block text-xs sm:text-sm font-body font-extrabold text-amber-950/75 mt-0.5 truncate">{victoryAction.subtitle}</span>
            </span>
            <span className="next-challenge-arrow" aria-hidden="true" />
          </span>
        </button>

        <button onClick={onRetry} className="retry-button w-full rounded-2xl py-3.5 font-display font-bold text-base flex items-center justify-center gap-2.5">
          <span className="retry-arrow-badge w-8 h-8 rounded-full flex items-center justify-center text-base text-amber-100 shrink-0">↻</span>
          Зіграти ще раз
        </button>

        <button onClick={onContinue} className="map-ghost-button w-full rounded-2xl py-3 font-display font-bold text-base flex items-center justify-center gap-2.5">
          <ArtImage src="/assets/icons/ui/map_scroll.png" fallback="" alt="" className="w-5 h-5 object-contain" />
          До карти
        </button>
      </div>
    </div>
  );
}
