import { useEffect } from "react";
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
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-amber-400 text-indigo-950 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 z-50 font-body toast-in">
      <ArtImage
        src={`/assets/icons/achievements/${BADGE_ICON_FILE[badge.id]}.png`}
        fallback={badge.icon}
        alt={badge.name}
        className="text-2xl w-8 h-8 object-contain flex items-center justify-center"
      />
      <div>
        <div className="text-xs font-semibold">Нове досягнення!</div>
        <div className="font-bold">{badge.name}</div>
      </div>
    </div>
  );
}
