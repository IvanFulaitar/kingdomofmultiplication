import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useInstallFlow } from "../hooks/useInstallFlow.js";
import { canShowInstallSuggestion, dismissInstallSuggestion } from "../game/pwa.js";
import { playUiClick, playUiBack } from "../game/sfx.js";
import IosInstallModal from "./IosInstallModal.jsx";
import OpenInSafariModal from "./OpenInSafariModal.jsx";

// Ненав'язлива пропозиція "додай гру на головний екран" — з'являється на
// екрані результатів після перемоги, а не одразу при вході в гру (щоб не
// виглядати як реклама, launch-plan.md вимога "не дратувати"). Розгалуження
// "яку модалку відкрити" спільне з постійною кнопкою в налаштуваннях —
// useInstallFlow(). Якщо гру вже видно як встановлену, немає жодного
// робочого сценарію на цьому пристрої/браузері, або користувач нещодавно
// натиснув "Не зараз" (7 днів — canShowInstallSuggestion() в
// src/game/pwa.js), банер просто нічого не рендерить.
export default function InstallBanner() {
  const { t } = useTranslation("menu");
  const {
    canInstall, handleInstallClick: handleInstallFlowClick,
    iosInstallOpen, setIosInstallOpen, openInSafariOpen, setOpenInSafariOpen,
  } = useInstallFlow();
  const [dismissed, setDismissed] = useState(false);
  // Одноразова перевірка при монтуванні — ResultsScreen монтується заново
  // під кожен новий результат, тож повторне читання localStorage тут не
  // потрібне протягом життя цього конкретного банера.
  const [eligible] = useState(() => canShowInstallSuggestion());

  if (!canInstall || !eligible || dismissed) return null;

  async function handleInstall() {
    playUiClick();
    await handleInstallFlowClick();
  }

  function handleDismiss() {
    playUiBack();
    dismissInstallSuggestion();
    setDismissed(true);
  }

  return (
    <>
      <div className="w-full rpg-panel rpg-panel-gold rounded-2xl p-4 mb-4 flex flex-col gap-3">
        <div>
          <p className="font-display font-bold text-amber-300 text-sm">{t("installBannerTitle")}</p>
          <p className="text-violet-200 text-xs leading-relaxed mt-1">{t("installBannerBody")}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="next-challenge-button flex-1 py-2.5 rounded-xl font-bold text-sm"
          >
            {t("installGame")}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="map-ghost-button flex-1 py-2.5 rounded-xl font-bold text-sm"
          >
            {t("installNotNow")}
          </button>
        </div>
      </div>

      {iosInstallOpen && <IosInstallModal onClose={() => setIosInstallOpen(false)} />}
      {openInSafariOpen && <OpenInSafariModal onClose={() => setOpenInSafariOpen(false)} />}
    </>
  );
}
