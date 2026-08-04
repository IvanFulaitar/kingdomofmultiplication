import { useTranslation } from "react-i18next";

// Показується при loadProgress()/saveProgress() (src/game/progress.js) у
// трьох випадках (reason приходить або з takeLoadWarning() при старті,
// або з App.jsx: persist(), якщо саме зберігання не вдалося):
//   "recovered-from-backup" — основний запис зіпсований, але вдалося
//                             відновити прогрес із резервної копії;
//   "reset-corrupted"       — зіпсований запис, і резервної копії теж
//                             не було, довелося почати з нуля;
//   "save-failed"           — щойно НЕ вдалося записати прогрес на диск
//                             (найчастіше QuotaExceededError — сховище
//                             переповнене); сам прогрес у пам'яті цілий.
// На відміну від BadgeToast (яка ховається сама за 3.2с), тут є ручна
// кнопка "Зрозуміло" — повідомлення важливе і не повинно зникнути,
// поки дитина/батьки не встигли його прочитати.
const REASON_KEYS = {
  "recovered-from-backup": { title: "saveRecoveredTitle", body: "saveRecoveredBody" },
  "reset-corrupted": { title: "saveResetTitle", body: "saveResetBody" },
  "save-failed": { title: "saveFailedTitle", body: "saveFailedBody" },
};

export default function SaveNoticeToast({ reason, onClose }) {
  const { t } = useTranslation("common");
  const keys = REASON_KEYS[reason];
  if (!keys) return null;

  return (
    <div
      className="fixed inset-x-4 z-50 max-w-sm mx-auto toast-in"
      style={{ top: "max(1rem, env(safe-area-inset-top))" }}
    >
      <div className="rpg-panel rpg-panel-gold rounded-2xl px-4 py-3.5 flex flex-col gap-2 shadow-2xl">
        <div className="flex items-start gap-2.5">
          <span className="text-xl shrink-0" aria-hidden="true">⚠️</span>
          <div className="flex-1">
            <div className="font-display font-bold text-amber-300 text-sm">{t(keys.title)}</div>
            <p className="text-violet-100 text-xs leading-relaxed mt-1">{t(keys.body)}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="self-end text-xs font-bold text-indigo-950 bg-amber-300 hover:bg-amber-200 rounded-full px-3.5 py-1.5 transition"
        >
          {t("gotIt")}
        </button>
      </div>
    </div>
  );
}
