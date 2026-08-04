import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { onUpdateAvailable, applyUpdate } from "../game/pwa.js";

// Банер "Доступне оновлення" (launch-plan.md, розділ 14) — з'являється,
// коли service worker завантажив нову версію гри у фоні й вона чекає
// підтвердження. Навмисно НЕ застосовуємо оновлення автоматично: дитина
// може бути посеред бою/лабіринту, і миттєвий reload зламав би цей момент.
export default function UpdateBanner() {
  const { t } = useTranslation("common");
  const [available, setAvailable] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => onUpdateAvailable(setAvailable), []);

  if (!available) return null;

  function handleUpdate() {
    setApplying(true);
    applyUpdate();
  }

  return (
    <div
      className="fixed inset-x-4 z-50 max-w-sm mx-auto toast-in"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="rpg-panel rpg-panel-gold rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-2xl">
        <span className="text-xl shrink-0" aria-hidden="true">✨</span>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-amber-300 text-sm">{t("updateAvailableTitle")}</div>
          <p className="text-violet-100 text-xs leading-relaxed mt-0.5">{t("updateAvailableBody")}</p>
        </div>
        <button
          type="button"
          onClick={handleUpdate}
          disabled={applying}
          className="shrink-0 text-xs font-bold text-indigo-950 bg-amber-300 hover:bg-amber-200 disabled:opacity-60 rounded-full px-3.5 py-2 transition"
        >
          {applying ? t("updateApplying") : t("updateNow")}
        </button>
      </div>
    </div>
  );
}
