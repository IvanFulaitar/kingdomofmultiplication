import { useTranslation } from "react-i18next";
import { useModalDialog } from "../hooks/useModalDialog.js";
import { playModalOpen, playModalClose } from "../game/sfx.js";
import { useEffect } from "react";

// iOS Safari (і взагалі iOS) не підтримує beforeinstallprompt — немає
// способу самим викликати системний діалог встановлення. Єдиний шлях —
// вручну через "Поділитися" → "На екран «Домой»", тож замість запуску
// чогось програмно показуємо покрокову інструкцію. Усі формулювання тут
// навмисно побутові — жодних "PWA", "manifest", "не підтримується" тощо
// (технічне ТЗ це прямо забороняє: дитина 10-12 років не повинна бачити
// технічні терміни). Стилістично копіює LanguagePickerModal.jsx (той
// самий rpg-panel-gold bottom-sheet).
export default function IosInstallModal({ onClose }) {
  const { t } = useTranslation("menu");
  const { titleId, panelRef } = useModalDialog(onClose);

  useEffect(() => {
    playModalOpen();
  }, []);

  function handleClose() {
    playModalClose();
    onClose();
  }

  const steps = [
    { icon: "📤", text: t("iosInstallStep1") },
    { icon: "📲", text: t("iosInstallStep2") },
    { icon: "➕", text: t("iosInstallStep3") },
  ];

  return (
    <div className="modal-backdrop fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        ref={panelRef}
        className="rpg-panel rpg-panel-gold relative rounded-t-3xl sm:rounded-[26px] w-full max-w-[420px] screen-in px-5 py-6 max-h-[88dvh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="font-display gold-text text-xl font-extrabold text-center mb-1.5">
          {t("iosInstallTitle")}
        </h2>
        <p className="text-violet-200 text-sm text-center leading-relaxed mb-4">
          {t("iosInstallBody")}
        </p>

        {/* Проста, навмисно схематична ілюстрація "поділитися → додати →
            іконка на екрані" — не скриншот Safari (той швидко застаріє),
            лише орієнтир, куди дивитись. Дублює текст кроків нижче, тому
            декоративна (aria-hidden). */}
        <div className="flex items-center justify-center gap-1.5 mb-5" aria-hidden="true">
          <div className="w-11 h-11 rounded-xl border-2 border-amber-400/70 bg-white/5 flex items-center justify-center text-lg shrink-0">📤</div>
          <span className="text-amber-400/50 text-base shrink-0">→</span>
          <div className="w-11 h-11 rounded-xl border-2 border-amber-400/70 bg-white/5 flex items-center justify-center text-lg shrink-0">➕</div>
          <span className="text-amber-400/50 text-base shrink-0">→</span>
          <div className="w-11 h-14 rounded-lg border-2 border-amber-400/70 bg-indigo-950 flex flex-col items-center justify-end pb-1.5 gap-1 shrink-0">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-[11px]">👑</div>
            <div className="w-4 h-0.5 rounded-full bg-white/25" />
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <span className="font-display font-extrabold text-xs tracking-wide rounded-lg px-2 py-1 shrink-0 bg-white/10 text-violet-200" aria-hidden="true">
                {i + 1}
              </span>
              <span className="text-lg shrink-0" aria-hidden="true">{step.icon}</span>
              <span className="flex-1 text-left font-body font-semibold text-violet-100 text-sm leading-snug">
                {step.text}
              </span>
            </div>
          ))}
        </div>

        <p className="text-violet-300/70 text-xs text-center leading-relaxed mt-4">
          {t("iosInstallOutro")}
        </p>

        <div className="flex flex-col gap-2 mt-4">
          <button
            type="button"
            onClick={handleClose}
            className="next-challenge-button w-full py-3 rounded-2xl font-bold"
          >
            {t("iosInstallGotIt")}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="map-ghost-button w-full py-2.5 rounded-2xl font-bold text-sm"
          >
            {t("installNotNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
