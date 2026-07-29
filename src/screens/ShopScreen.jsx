import { AVATARS } from "../data/cosmetics.js";
import TopBar from "../components/TopBar.jsx";
import Coin from "../components/Coin.jsx";
import ArtImage from "../components/ArtImage.jsx";
import LockBadge from "../components/LockBadge.jsx";

function SectionTitle({ children }) {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-4">
      <span className="text-amber-400/70 text-xs">✦</span>
      <h3 className="font-display gold-text font-extrabold text-lg tracking-wide">{children}</h3>
      <span className="text-amber-400/70 text-xs">✦</span>
    </div>
  );
}

function StatusBadge({ children, tone = "gold" }) {
  const tones = {
    gold: "bg-gradient-to-b from-amber-300 to-amber-600 text-indigo-950 border-amber-100/70",
    neutral: "bg-white/10 text-white/50 border-white/10",
  };
  return (
    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shadow ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function ShopScreen({ progress, onBuyAvatar, onBack }) {
  return (
    <div className="relative overflow-hidden min-h-screen screen-in">
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-16">
        <TopBar
          onBack={onBack}
          title="Магазин"
          right={
            <div className="resource-pill-gold rounded-full pl-1.5 pr-3 py-1 flex items-center gap-1.5 text-indigo-950">
              <ArtImage src="/assets/icons/ui/coin.png" fallback="🪙" alt="монети" className="w-6 h-6 object-contain" />
              <span className="font-extrabold text-base">{progress.coins}</span>
            </div>
          }
        />

        <div className="mt-8">
          <SectionTitle>Аватари</SectionTitle>
          <div className="grid grid-cols-3 gap-3.5">
            {AVATARS.map((av) => {
              const owned = progress.ownedAvatars.includes(av.id);
              const selected = progress.avatar === av.id;
              return (
                <button
                  key={av.id}
                  onClick={() => onBuyAvatar(av)}
                  className={`relative rounded-2xl p-3.5 pt-4 flex flex-col items-center gap-2 transition ${
                    selected ? "rpg-panel rpg-panel-gold" : owned ? "rpg-panel" : "badge-card-locked"
                  }`}
                >
                  {!owned && <LockBadge />}
                  <ArtImage
                    src={`/assets/avatars/${av.id}.png`}
                    fallback={av.icon}
                    alt={av.id}
                    className={`text-5xl w-16 h-16 object-contain flex items-center justify-center ${owned ? "" : "opacity-60"}`}
                  />
                  <div className="h-5 flex items-center">
                    {owned ? (
                      selected ? <StatusBadge>Обрано</StatusBadge> : <StatusBadge tone="neutral">є в тебе</StatusBadge>
                    ) : (
                      <Coin>{av.cost}</Coin>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
