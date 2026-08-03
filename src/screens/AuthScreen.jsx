import { useState } from "react";
import TopBar from "../components/TopBar.jsx";
import { register, login } from "../game/auth.js";
import { ApiError } from "../game/apiClient.js";
import { playUiClick } from "../game/sfx.js";

// Екран входу/реєстрації. Акаунт — необов'язкова фіча (frontend-backend-
// integration-plan.md, крок 2): гра й далі повністю грається без нього,
// цей екран лише додає можливість не втратити прогрес при зміні телефону
// (сама синхронізація прогресу — окремий, значно більший наступний етап).
//
// onBack — повернутись, звідки прийшли (TopBar).
// onAuthenticated(user) — викликається після успішного login/register,
// батьківський компонент (App.jsx, крок 3) сам вирішує, що робити далі.
export default function AuthScreen({ onBack, onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  function switchMode(next) {
    if (next === mode || loading) return;
    playUiClick();
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const user =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(email.trim(), password);
      onAuthenticated?.(user);
    } catch (err) {
      // Повідомлення від apiClient.js/сервера вже написані людською мовою
      // українською (напр. "Некоректний email", "Такий email уже
      // зареєстровано") — показуємо напряму, без ще одного шару перекладу.
      setError(
        err instanceof ApiError
          ? err.message
          : "Щось пішло не так. Спробуй ще раз."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />
      <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 py-8 pb-16">
        <div className="mb-2">
          <TopBar onBack={onBack} title="Акаунт" />
        </div>
        <p className="text-violet-200/85 text-sm text-center mb-5">
          <span className="sm:hidden">Не обов'язково — гра працює й без цього</span>
          <span className="hidden sm:inline">
            Увійди, щоб не втратити прогрес при зміні телефону. Це не
            обов'язково — гра й далі повністю працює без акаунта.
          </span>
        </p>

        <div className="rpg-panel rounded-2xl px-5 py-5">
          <div
            className="knowledge-segmented mb-5"
            role="group"
            aria-label="Вхід чи реєстрація"
          >
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`knowledge-segmented-btn ${mode === "login" ? "knowledge-segmented-btn-active" : ""}`}
            >
              Увійти
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`knowledge-segmented-btn ${mode === "register" ? "knowledge-segmented-btn-active" : ""}`}
            >
              Створити акаунт
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm text-violet-200/85">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="ім'я@пошта.com"
                aria-label="Email"
                className={`form-input font-body text-base rounded-xl px-4 py-3.5 min-h-[52px] ${error ? "form-input-error" : ""}`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm text-violet-200/85">Пароль</span>
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="Щонайменше 8 символів"
                aria-label="Пароль"
                className={`form-input font-body text-base rounded-xl px-4 py-3.5 min-h-[52px] ${error ? "form-input-error" : ""}`}
              />
              {mode === "register" && (
                <span className="font-body text-xs text-violet-300/70">
                  Щонайменше 8 символів
                </span>
              )}
            </label>

            {error && (
              <p role="alert" className="font-body text-sm text-rose-300 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="knowledge-cta-button w-full py-3.5 rounded-2xl font-display font-extrabold text-lg text-indigo-950 min-h-[56px] disabled:opacity-45 disabled:grayscale disabled:pointer-events-none mt-1"
            >
              {loading ? "Зачекай…" : mode === "login" ? "Увійти" : "Створити акаунт"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
