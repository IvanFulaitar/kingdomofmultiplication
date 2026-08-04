// Показується один раз при завантаженні гри, лише якщо loadProgress()
// (src/game/progress.js) виявила пошкоджений основний запис localStorage.
// Дві причини (від takeLoadWarning()):
//   "recovered-from-backup" — основний запис зіпсований, але вдалося
//                             відновити прогрес із резервної копії;
//   "reset-corrupted"       — зіпсований запис, і резервної копії теж
//                             не було, довелося почати з нуля.
// На відміну від BadgeToast (яка ховається сама за 3.2с), тут є ручна
// кнопка "Зрозуміло" — повідомлення важливе і не повинно зникнути,
// поки дитина/батьки не встигли його прочитати.
const MESSAGES = {
  "recovered-from-backup": {
    title: "Прогрес відновлено",
    body: "Основне збереження було пошкоджене, тож ми відновили останню резервну копію. Останні кілька хвилин гри могли не зберегтися.",
  },
  "reset-corrupted": {
    title: "Збереження довелося скинути",
    body: "Основний запис і резервна копія виявились пошкодженими, тож прогрес почався заново.",
  },
};

export default function SaveNoticeToast({ reason, onClose }) {
  const msg = MESSAGES[reason];
  if (!msg) return null;

  return (
    <div
      className="fixed inset-x-4 z-50 max-w-sm mx-auto toast-in"
      style={{ top: "max(1rem, env(safe-area-inset-top))" }}
    >
      <div className="rpg-panel rpg-panel-gold rounded-2xl px-4 py-3.5 flex flex-col gap-2 shadow-2xl">
        <div className="flex items-start gap-2.5">
          <span className="text-xl shrink-0" aria-hidden="true">⚠️</span>
          <div className="flex-1">
            <div className="font-display font-bold text-amber-300 text-sm">{msg.title}</div>
            <p className="text-violet-100 text-xs leading-relaxed mt-1">{msg.body}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="self-end text-xs font-bold text-indigo-950 bg-amber-300 hover:bg-amber-200 rounded-full px-3.5 py-1.5 transition"
        >
          Зрозуміло
        </button>
      </div>
    </div>
  );
}
