import { useEffect, useId, useRef } from "react";

// Спільна доступність для попап-модалок встановлення (IosInstallModal.jsx,
// OpenInSafariModal.jsx): блокування прокрутки сторінки під модалкою,
// закриття через Escape на десктопі, фокус на перший елемент модалки при
// відкритті й повернення фокуса туди, звідки її відкрили, при закритті —
// та готовий id для aria-labelledby. Один хук замість копіювання тієї самої
// логіки в кожному компоненті.
export function useModalDialog(onClose) {
  const titleId = useId();
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  // onClose живе в ref і оновлюється щорендеру, щоб Escape завжди викликав
  // актуальну версію, навіть якщо батьківський компонент передає новий
  // inline-обробник щоразу — а сам ефект нижче запускається лише раз.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = panelRef.current?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    function onKeyDown(e) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
    // Escape-обробник має бачити актуальний onClose, але хук навмисно
    // запускається лише раз при монтуванні/розмонтуванні (не хочемо
    // перевішувати body.style.overflow чи фокус щоразу, коли батьківський
    // компонент віддає новий inline onClose).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { titleId, panelRef };
}
