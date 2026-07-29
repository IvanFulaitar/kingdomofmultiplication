import { REGIONS, LEVEL_META, isLevelUnlocked } from "../data/regions.js";
import TopBar from "../components/TopBar.jsx";
import ArtImage from "../components/ArtImage.jsx";

function LevelStar({ filled }) {
  return filled ? (
    <ArtImage
      src="/assets/icons/ui/star.png"
      fallback="⭐"
      alt=""
      className="w-6 h-6 object-contain drop-shadow-[0_0_6px_rgba(245,185,66,0.6)]"
    />
  ) : (
    <span className="star-slot-empty w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white/25 shrink-0">★</span>
  );
}

export default function MapScreen({ progress, onBack, onSelect }) {
  let activeAssigned = false;

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-16">
        <div className="relative mb-9">
          <div className="modal-ornament absolute -top-5 left-1/2 -translate-x-1/2 z-10" style={{ width: "2.5rem", height: "2.5rem", fontSize: "1rem" }}>
            👑
          </div>
          <div className="rpg-panel rpg-panel-gold rounded-2xl py-3 px-1">
            <TopBar onBack={onBack} title="Карта королівства" />
          </div>
        </div>

        <div className="flex flex-col gap-10">
          {REGIONS.map((region, regionIndex) => {
            const locked = !isLevelUnlocked(region.levels[0], progress);
            const doneCount = region.levels.filter((id) => (progress.levels[id]?.stars ?? 0) > 0).length;
            const total = region.levels.length;
            const completed = doneCount === total;
            const isActive = !locked && !completed && !activeAssigned;
            if (isActive) activeAssigned = true;
            const prevRegion = REGIONS[regionIndex - 1];

            const frameClass = completed ? "region-completed-frame" : isActive ? "region-active-frame" : "region-locked-frame";

            return (
              <div key={region.id}>
                <div className={`relative overflow-hidden rounded-3xl shadow-lg ${frameClass}`}>
                  <div
                    className={`absolute inset-0 ${locked ? "region-locked-art" : ""}`}
                    style={{ backgroundImage: `url(/assets/backgrounds/${region.id}.png)`, backgroundSize: "cover", backgroundPosition: "center" }}
                  />
                  <div className={`absolute inset-0 bg-gradient-to-r ${region.tint} ${locked ? "opacity-70" : "opacity-45"}`} />
                  <div className="relative px-4 py-5 flex items-center gap-3">
                    <span className="text-4xl drop-shadow-lg shrink-0">{region.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-extrabold text-xl text-white drop-shadow-lg truncate">{region.name}</div>
                      {locked ? (
                        <div className="text-xs text-white/70 mt-0.5 drop-shadow">
                          {prevRegion ? `Пройди всі рівні «${prevRegion.name}»` : "Заблоковано"}
                        </div>
                      ) : (
                        <div className="text-xs text-amber-200 font-semibold mt-0.5 drop-shadow">{doneCount}/{total} рівні пройдено</div>
                      )}
                    </div>
                    <span className="shrink-0">
                      {locked ? (
                        <ArtImage src="/assets/icons/ui/lock.png" fallback="🔒" alt="" className="w-9 h-9 object-contain drop-shadow-lg" />
                      ) : completed ? (
                        <ArtImage src="/assets/icons/achievements/crown.png" fallback="👑" alt="" className="w-9 h-9 object-contain drop-shadow-lg" />
                      ) : (
                        <ArtImage src="/assets/icons/ui/chest.png" fallback="🎁" alt="" className="w-9 h-9 object-contain drop-shadow-lg" />
                      )}
                    </span>
                  </div>
                </div>

                <div className="relative flex flex-col gap-4 mt-5 pl-9">
                  <div className={`absolute left-[15px] top-2 bottom-2 w-0.5 rounded-full ${locked ? "level-path-muted" : "level-path"}`} />
                  {region.levels.map((id) => {
                    const unlocked = isLevelUnlocked(id, progress);
                    const stars = progress.levels[id]?.stars ?? 0;
                    const meta = LEVEL_META[id];
                    const isNext = unlocked && stars === 0;
                    const isDone = unlocked && stars > 0;

                    return (
                      <button
                        key={id}
                        disabled={!unlocked}
                        onClick={() => onSelect(id)}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition ${
                          isDone
                            ? "rpg-panel rpg-panel-gold hover:brightness-110 active:scale-[0.98]"
                            : isNext
                            ? "rpg-panel rpg-panel-gold level-card-next hover:brightness-110 active:scale-[0.98]"
                            : "badge-card-locked"
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center font-display font-extrabold text-lg shrink-0 ${
                            unlocked ? "level-badge text-white" : "level-badge-locked text-white/50"
                          }`}
                        >
                          {unlocked ? id : <ArtImage src="/assets/icons/ui/lock.png" fallback="🔒" alt="" className="w-5 h-5 object-contain" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-display font-bold text-base truncate ${unlocked ? "text-white" : "text-white/70"}`}>{meta.title}</div>
                          <div className={`text-xs mt-0.5 ${unlocked ? "text-violet-200" : "text-white/40"}`}>
                            {id < 10 ? `таблиця ${meta.sub}` : meta.sub}
                          </div>
                          {isNext && <div className="text-[11px] text-amber-300 font-semibold mt-1">➜ Наступний рівень</div>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {[0, 1, 2].map((i) => <LevelStar key={i} filled={unlocked && i < stars} />)}
                        </div>
                        {unlocked && <span className="text-amber-300 text-lg ml-0.5 shrink-0">›</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
