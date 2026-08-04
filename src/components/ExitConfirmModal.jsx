import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { playModalClose } from "../game/sfx.js";
import ArtImage from "./ArtImage.jsx";

// titleKey/messageKey замість готового тексту — той самий "story"/"battle"
// набір копії, лише "training" відрізняється формулюванням.
const MODE_COPY = {
  story: { titleKey: "exitConfirmTitle", messageKey: "exitConfirmMessage" },
  battle: { titleKey: "exitConfirmTitle", messageKey: "exitConfirmMessage" },
  training: { titleKey: "exitTrainingTitle", messageKey: "exitTrainingMessage" },
};

const DESTINATION_ICONS = {
  map: "/assets/icons/ui/map_scroll.png",
  training: "/assets/icons/ui/target.png",
  menu: "/assets/icons/ui/chest.png",
};

export default function ExitConfirmModal({
  title,
  modeType = "story",
  levelName,
  currentProgress = 0,
  totalProgress,
  destination = "map",
  destinationLabel,
  onContinue,
  onExit,
}) {
  const { t } = useTranslation("common");
  const [exiting, setExiting] = useState(false);
  const titleId = useId();

  // Поки модалка відкрита, сайт позаду не повинен прокручуватись.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  // Escape = те саме, що кнопка "Продовжити" (onContinue) — найбезпечніша
  // дія за замовчуванням, аналогічно до заднього фону, який тут навмисно
  // НЕ закриває модалку кліком (щоб не втратити прогрес випадковим тапом
  // повз кнопки) — але клавіатурний Escape усе одно повинен працювати.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") { playModalClose(); onContinue(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = MODE_COPY[modeType] ?? MODE_COPY.story;
  const hasTotal = typeof totalProgress === "number";
  const exitLabel = currentProgress > 0 ? destinationLabel : t("exitButton");
  const progressText = hasTotal
    ? t("exitProgressWithTotal", { label: t("exitProgressLabel"), current: currentProgress, total: totalProgress })
    : t("exitProgressNoTotal", { label: t("exitProgressLabel"), current: currentProgress });

  function confirmExit() {
    if (exiting) return;
    setExiting(true);
    playModalClose();
    onExit();
  }

  return (
    <div className="exit-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center px-5 py-8" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="exit-modal-panel relative w-full max-w-sm rounded-3xl px-5 pt-10 pb-5 text-center">
        <div className="exit-modal-ornament absolute -top-7 left-1/2 -translate-x-1/2" aria-hidden="true">
          <span className="exit-modal-shield" />
        </div>

        <div className="text-xs font-display font-bold text-amber-200/80 mb-1 truncate">{levelName}</div>
        <h2 id={titleId} className="font-display gold-text text-2xl font-extrabold leading-tight mb-3">
          {title ?? t(copy.titleKey)}
        </h2>
        <p className="text-violet-100 text-base leading-snug mb-4">
          {t(copy.messageKey)}
        </p>

        <div className="exit-progress-panel rounded-2xl px-4 py-3 mb-5">
          <div className="text-[11px] uppercase tracking-wide text-amber-200/70 font-bold mb-1">{t("exitNotFinished")}</div>
          <div className="font-body text-white text-sm font-bold">{progressText}</div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => { playModalClose(); onContinue(); }}
            className="exit-continue-button relative rounded-2xl py-3.5 px-4 font-display font-extrabold text-indigo-950 flex items-center justify-center gap-2.5"
          >
            <span className="exit-continue-shield" aria-hidden="true" />
            {t("exitContinue")}
          </button>
          <button
            onClick={confirmExit}
            disabled={exiting}
            className="exit-confirm-button rounded-2xl py-3 px-4 font-display font-bold text-base flex items-center justify-center gap-2.5 disabled:opacity-70"
          >
            <ArtImage src={DESTINATION_ICONS[destination]} fallback="" alt="" className="w-5 h-5 object-contain" />
            {exitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
