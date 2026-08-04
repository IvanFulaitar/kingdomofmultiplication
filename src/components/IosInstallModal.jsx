import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { playModalOpen, playModalClose } from "../game/sfx.js";

// iOS (Safari й будь-який інший браузер там, бо всі на WebKit) не підтримує
// beforeinstallprompt — немає способу самим викликати системний діалог
// встановлення. Єдиний шлях — вручну через "Поділитися" → "На екран
// «Домой»", тож замість запуску чогось програмно показуємо покрокову
// інструкцію. Стилістично копіює LanguagePickerModal.jsx (той самий
// rpg-panel-gold bottom-sheet), щоб не заводити новий візуальний патерн.
export default function IosInstallModal({ onClose }) {
  const { t } = useTranslation("menu");

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    playModalOpen();
    return () => { document.body.style.overflow = original; };
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
        className="rpg-panel rpg-panel-gold relative rounded-t-3xl sm:rounded-[26px] w-full max-w-[420px] screen-in px-5 py-6"
        role="dialog"
        aria-modal="true"
        aria-label={t("iosInstallTitle")}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display gold-text text-xl font-extrabold text-center mb-4">
          {t("iosInstallTitle")}
        </h2>

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

        <button
          type="button"
          onClick={handleClose}
          className="next-challenge-button w-full py-3 rounded-2xl font-bold mt-4"
        >
          {t("iosInstallGotIt")}
        </button>
      </div>
    </div>
  );
}
