import { useTranslation } from "react-i18next";
import { playUiBack } from "../game/sfx.js";

export default function TopBar({ onBack, title, right }) {
  const { t } = useTranslation("common");
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => { playUiBack(); onBack(); }}
        aria-label={t("back")}
        className="rpg-panel shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl text-amber-100 active:scale-95 transition"
      >
        ←
      </button>
      <h2 className="flex-1 text-center font-display gold-text font-extrabold text-xl tracking-wide truncate">{title}</h2>
      <div className="shrink-0 min-w-8 flex justify-end">{right}</div>
    </div>
  );
}
