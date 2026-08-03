import { useEffect } from "react";

// Компактний авто-зникаючий toast для коротких підтверджень (напр. "Мову
// змінено") — навмисно легший за BadgeToast.jsx (без іконки-досягнення) і
// без ручної кнопки закриття, як у SaveNoticeToast.jsx (тут повідомлення
// не критичне, не страшно, якщо дитина його не встигне дочитати).
export default function SimpleToast({ message, duration = 2200, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-6 left-1/2 -translate-x-1/2 bg-amber-400 text-indigo-950 rounded-2xl px-5 py-3 shadow-2xl z-[60] font-body font-bold toast-in"
    >
      {message}
    </div>
  );
}
