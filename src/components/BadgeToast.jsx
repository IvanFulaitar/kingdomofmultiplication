import { useEffect } from "react";
import { useTranslation } from "react-i18next";
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

export default function BadgeToast({ badge, onClose }) {
  const { t } = useTranslation("achievements");
  useEffect(() => {
    const timer = setTimeout(onClose, 3200);
    return () => clearTimeout(timer);
  }, [onClose]);

  const badgeName = t(badge.nameKey);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bg-amber-400 text-indigo-950 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 z-50 font-body toast-in"
      style={{ top: "max(1.5rem, env(safe-area-inset-top))" }}
    >
      <ArtImage
        src={`/assets/icons/achievements/${BADGE_ICON_FILE[badge.id]}.png`}
        fallback={badge.icon}
        alt={badgeName}
        className="text-2xl w-8 h-8 object-contain flex items-center justify-center"
      />
      <div>
        <div className="text-xs font-semibold">{t("newAchievement")}</div>
        <div className="font-bold">{badgeName}</div>
      </div>
    </div>
  );
}
