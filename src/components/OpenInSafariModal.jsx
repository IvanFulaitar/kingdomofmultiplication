import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useModalDialog } from "../hooks/useModalDialog.js";
import { playModalOpen, playModalClose, playUiClick } from "../game/sfx.js";
import { useEffect } from "react";

// Показується, коли гру відкрито на iPhone/iPad, але НЕ в Safari (Chrome,
// Instagram-вбудований браузер тощо) — там навіть покрокова інструкція під
// Safari не спрацює, бо в інших браузерах на iOS пункту "На початковий
// екран" часто взагалі немає. Єдиний надійний шлях — спершу відкрити
// сторінку в самому Safari, тому даємо скопіювати посилання одним
// натисканням замість того, щоб просити вручну передруковувати URL.
export default function OpenInSafariModal({ onClose }) {
  const { t } = useTranslation(["menu", "common"]);
  const { titleId, panelRef } = useModalDialog(onClose);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    playModalOpen();
  }, []);

  function handleClose() {
    playModalClose();
    onClose();
  }

  async function handleCopyLink() {
    playUiClick();
    const url = window.location.href;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // Деякі вбудовані браузери (Instagram/Facebook-вебвʼю) блокують
      // navigator.clipboard — запасний шлях через приховане textarea +
      // застаріле, але значно ширше підтримуване execCommand("copy").
      try {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        ok = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  const steps = [
    t("openInSafariStep1"),
    t("openInSafariStep2"),
    t("openInSafariStep3"),
    t("openInSafariStep4"),
    t("openInSafariStep5"),
    t("openInSafariStep6"),
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
          {t("openInSafariTitle")}
        </h2>
        <p className="text-violet-200 text-sm text-center leading-relaxed mb-4">
          {t("openInSafariBody")}
        </p>

        <ol className="flex flex-col gap-2 mb-4">
          {steps.map((text, i) => (
            <li key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5">
              <span className="font-display font-extrabold text-xs tracking-wide rounded-lg px-2 py-1 shrink-0 bg-white/10 text-violet-200" aria-hidden="true">
                {i + 1}
              </span>
              <span className="flex-1 text-left font-body font-semibold text-violet-100 text-sm leading-snug">
                {text}
              </span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={handleCopyLink}
          className={`next-challenge-button w-full py-3 rounded-2xl font-bold transition-colors ${copied ? "!bg-emerald-400" : ""}`}
        >
          {copied ? t("copyLinkDone") : t("copyLink")}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="map-ghost-button w-full py-2.5 rounded-2xl font-bold text-sm mt-2"
        >
          {t("common:close")}
        </button>
      </div>
    </div>
  );
}
