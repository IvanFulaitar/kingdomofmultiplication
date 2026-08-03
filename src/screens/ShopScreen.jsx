import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AVATARS } from "../data/cosmetics.js";
import { playUiClick } from "../game/sfx.js";
import TopBar from "../components/TopBar.jsx";
import Coin from "../components/Coin.jsx";
import ArtImage from "../components/ArtImage.jsx";
import LockBadge from "../components/LockBadge.jsx";
import AvatarPurchaseModal from "../components/AvatarPurchaseModal.jsx";

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

export default function ShopScreen({ progress, onPurchaseAvatar, onSelectAvatar, onBack }) {
  const { t } = useTranslation(["shop", "avatars", "common"]);
  const [purchaseTarget, setPurchaseTarget] = useState(null);

  // Заблокований аватар відкриває підтвердження покупки; уже придбаний, але
  // не обраний — стає активним одразу (монети тут узагалі не витрачаються,
  // тож зайве підтвердження тільки заважало б); активний — не реагує.
  function handleCardClick(av) {
    const owned = progress.ownedAvatars.includes(av.id);
    const selected = progress.avatar === av.id;
    if (selected) return;
    if (owned) { playUiClick(); onSelectAvatar(av.id); return; }
    setPurchaseTarget(av);
  }

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-16">
        <TopBar
          onBack={onBack}
          title={t("shop:title")}
          right={
            <div className="resource-pill-gold rounded-full pl-1.5 pr-3 py-1 flex items-center gap-1.5 text-indigo-950">
              <ArtImage src="/assets/icons/ui/coin.png" fallback="🪙" alt={t("shop:coinsAlt")} className="w-6 h-6 object-contain" />
              <span className="font-extrabold text-base">{progress.coins}</span>
            </div>
          }
        />

        <div className="mt-8">
          <SectionTitle>{t("shop:avatarsSection")}</SectionTitle>
          <div className="grid grid-cols-3 gap-3.5">
            {AVATARS.map((av) => {
              const owned = progress.ownedAvatars.includes(av.id);
              const selected = progress.avatar === av.id;
              const avatarName = t(`avatars:${av.nameKey}`);
              return (
                <button
                  key={av.id}
                  onClick={() => handleCardClick(av)}
                  disabled={selected}
                  className={`relative rounded-2xl p-3.5 pt-4 flex flex-col items-center gap-2 transition ${
                    selected ? "rpg-panel rpg-panel-gold" : owned ? "rpg-panel" : "badge-card-locked"
                  }`}
                >
                  {!owned && <LockBadge />}
                  <ArtImage
                    src={`/assets/avatars/${av.id}.png`}
                    fallback={av.icon}
                    alt={avatarName}
                    className={`text-5xl w-16 h-16 object-contain flex items-center justify-center ${owned ? "" : "opacity-60"}`}
                  />
                  <div className="h-5 flex items-center">
                    {owned ? (
                      selected ? <StatusBadge>{t("common:selected")}</StatusBadge> : <StatusBadge tone="neutral">{t("shop:selectAvatar")}</StatusBadge>
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

      {purchaseTarget && (
        <AvatarPurchaseModal
          avatarId={purchaseTarget.id}
          avatarName={t(`avatars:${purchaseTarget.nameKey}`)}
          avatarImage={`/assets/avatars/${purchaseTarget.id}.png`}
          avatarFallback={purchaseTarget.icon}
          price={purchaseTarget.cost}
          currentBalance={progress.coins}
          isOwned={progress.ownedAvatars.includes(purchaseTarget.id)}
          isSelected={progress.avatar === purchaseTarget.id}
          onConfirm={() => onPurchaseAvatar(purchaseTarget.id)}
          onCancel={() => setPurchaseTarget(null)}
          onSelect={() => { onSelectAvatar(purchaseTarget.id); setPurchaseTarget(null); }}
        />
      )}
    </div>
  );
}
