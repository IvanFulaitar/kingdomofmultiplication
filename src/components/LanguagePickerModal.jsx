import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, setLanguage } from "../i18n/index.js";
import { playModalOpen, playModalClose, playUiClick } from "../game/sfx.js";
import { useModalDialog } from "../hooks/useModalDialog.js";

// Мова другою мовою кожного рядка написана СВОЄЮ ж рідною назвою
// (Українська/English/Polski), не перекладена — так завжди зрозуміло,
// що обереш, незалежно від поточної мови інтерфейсу. Код зліва (UK/EN/PL)
// замінює прапор — англійська, наприклад, не належить лише одній країні.
export default function LanguagePickerModal({ onClose, onLanguageChanged }) {
  const { t, i18n } = useTranslation("common");
  const { titleId, panelRef } = useModalDialog(onClose);

  useEffect(() => {
    playModalOpen();
  }, []);

  function handleClose() {
    playModalClose();
    onClose();
  }

  async function handleSelect(code) {
    if (code === i18n.language) {
      handleClose();
      return;
    }
    playUiClick();
    await setLanguage(code);
    onLanguageChanged?.();
    handleClose();
  }

  return (
    <div className="modal-backdrop fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        ref={panelRef}
        className="rpg-panel rpg-panel-gold relative rounded-t-3xl sm:rounded-[26px] w-full max-w-[420px] screen-in px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="font-display gold-text text-xl font-extrabold text-center mb-4">
          {t("chooseLanguage")}
        </h2>

        <div className="flex flex-col gap-2">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const active = lang.code === i18n.language;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                aria-pressed={active}
                className={`w-full min-h-[56px] rounded-2xl px-4 flex items-center gap-3 transition ${
                  active
                    ? "bg-amber-400/15 border border-amber-400/70"
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
              >
                <span
                  className={`font-display font-extrabold text-xs tracking-wide rounded-lg px-2 py-1 shrink-0 ${
                    active ? "bg-amber-400 text-indigo-950" : "bg-white/10 text-violet-200"
                  }`}
                  aria-hidden="true"
                >
                  {lang.code.toUpperCase()}
                </span>
                <span className={`flex-1 text-left font-body font-semibold ${active ? "text-white" : "text-violet-100"}`}>
                  {lang.nativeName}
                </span>
                {active && (
                  <span className="text-emerald-400 text-lg shrink-0" aria-hidden="true">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
