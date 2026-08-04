import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BADGES } from "../data/rewards.js";
import { playModalOpen, playModalClose } from "../game/sfx.js";
import { useModalDialog } from "../hooks/useModalDialog.js";
import LockBadge from "./LockBadge.jsx";
import ArtImage from "./ArtImage.jsx";

const BADGE_ICON_FILE = {
  first_win: "medal",
  no_mistakes: "diamond",
  forest_master: "tree",
  mountain_master: "mountains",
  castle_master: "castle",
  sage_master: "brain",
  kingdom_lord: "crown",
  streak3: "streak_fire",
};

export default function BadgesModal({ progress, onClose }) {
  const { t } = useTranslation(["achievements", "common"]);
  const { titleId, panelRef } = useModalDialog(onClose);
  // Поки модалка відкрита, сайт позаду не повинен прокручуватись
  // (useModalDialog вище вже блокує overflow — тут лишається лише звук).
  useEffect(() => {
    playModalOpen();
  }, []);

  function handleClose() {
    playModalClose();
    onClose();
  }

  return (
    <div className="modal-backdrop fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        ref={panelRef}
        className="modal-panel relative rounded-t-3xl sm:rounded-3xl w-full max-w-md screen-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-ornament absolute -top-6 left-1/2 -translate-x-1/2 z-10">💎</div>

        <div className="pt-9 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 px-6 max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl">
          <h2 id={titleId} className="font-display gold-text text-3xl font-extrabold text-center mt-2 mb-1 tracking-wide">{t("achievements:screenTitle")}</h2>
          <p className="text-violet-200 text-center text-sm mb-6">{t("achievements:subtitle")}</p>

          <div className="grid grid-cols-3 gap-3">
            {BADGES.map((b) => {
              const earned = progress.badges.includes(b.id);
              const badgeName = t(`achievements:${b.nameKey}`);
              return (
                <div
                  key={b.id}
                  className={`relative rounded-2xl p-3 pt-4 flex flex-col items-center gap-2 text-center ${earned ? "badge-card-earned" : "badge-card-locked"}`}
                >
                  {!earned && <LockBadge />}
                  <ArtImage
                    src={`/assets/icons/achievements/${BADGE_ICON_FILE[b.id]}.png`}
                    fallback={b.icon}
                    alt={badgeName}
                    className={`w-12 h-12 object-contain flex items-center justify-center text-4xl ${earned ? "" : "opacity-50 grayscale-[30%]"}`}
                  />
                  <span className={`text-xs font-semibold leading-tight ${earned ? "text-white" : "text-white/60"}`}>{badgeName}</span>
                </div>
              );
            })}
          </div>

          <button onClick={handleClose} className="close-button mt-7 w-full rounded-2xl py-3.5 font-display font-extrabold text-lg text-indigo-950">
            {t("common:close")}
          </button>
        </div>
      </div>
    </div>
  );
}
