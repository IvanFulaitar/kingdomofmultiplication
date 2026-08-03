import { useEffect, useRef, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import ArtImage from "../components/ArtImage.jsx";
import { AVATARS } from "../data/cosmetics.js";
import { register, login } from "../game/auth.js";
import { ApiError } from "../game/apiClient.js";
import { playUiClick } from "../game/sfx.js";

// Екран входу/реєстрації + профіль. Акаунт — необов'язкова фіча
// (frontend-backend-integration-plan.md): гра й далі повністю грається
// без нього, цей екран лише додає можливість не втратити прогрес при
// зміні телефону. Автоматичної синхронізації самого ігрового прогресу ще
// не існує (окремий, значно більший наступний етап) — тому тут чесно
// показуємо лише "Акаунт активний", а не вигадане "Прогрес синхронізовано".
//
// Під капотом акаунт і далі працює через email (бекенд це вимагає), але
// підпис поля — "Логін", а після входу дитині показується лише зрозуміла
// "логін"-подібна частина адреси (до "@"), не вся технічна пошта.
//
// user/avatarId/onLogout — якщо передано user, екран одразу показує
// профіль замість форми. onBack — повернутись у меню. onAuthenticated(user)
// — після успішного login/register.
export default function AuthScreen({ user, avatarId, onBack, onAuthenticated, onLogout }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!error) return;
    if (error === "Паролі не збігаються") confirmRef.current?.focus();
    else passwordRef.current?.focus();
  }, [error]);

  function switchMode(next) {
    if (next === mode || loading) return;
    playUiClick();
    setMode(next);
    setError(null);
  }

  const fieldsFilled =
    mode === "login"
      ? email.trim().length > 0 && password.length > 0
      : email.trim().length > 0 && password.length > 0 && confirmPassword.length > 0;
  const canSubmit = fieldsFilled && !loading;

  const emailHasError = !!error && error !== "Паролі не збігаються";
  const passwordHasError = !!error;
  const confirmHasError = mode === "register" && error === "Паролі не збігаються";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    if (mode === "register" && password !== confirmPassword) {
      setError("Паролі не збігаються");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const authedUser =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(email.trim(), password);
      onAuthenticated?.(authedUser);
    } catch (err) {
      // Повідомлення від apiClient.js/сервера вже написані людською мовою
      // українською (напр. "Некоректний email", "Такий email уже
      // зареєстровано") — показуємо напряму, без ще одного шару перекладу.
      setError(
        err instanceof ApiError
          ? err.message
          : "Не вдалося підключитися до сервера. Спробуй ще раз."
      );
    } finally {
      setLoading(false);
    }
  }

  const avatar = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];

  // ---- Залогінений стан: профіль замість форми ----
  if (user) {
    const displayName = user.email.split("@")[0];
    return (
      <div className="relative overflow-hidden min-h-dvh screen-in">
        <div className="center-vignette" />
        <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 py-8 pb-16">
          <div className="mb-2">
            <TopBar onBack={onBack} title="Акаунт" />
          </div>

          <div className="modal-panel rounded-[26px] max-w-[520px] mx-auto px-6 sm:px-8 py-8 mt-6 text-center">
            <div className="avatar-medallion inline-block mb-4">
              <ArtImage
                src={`/assets/avatars/${avatar.id}.png`}
                fallback={avatar.icon}
                alt=""
                className="w-20 h-20 rounded-full object-contain mx-auto flex items-center justify-center text-4xl"
              />
            </div>
            <p className="font-display font-extrabold text-xl text-white mb-1">{displayName}</p>
            <p className="text-sm text-emerald-300/90 mb-7">Акаунт активний</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={onBack}
                className="knowledge-cta-button w-full py-3.5 rounded-2xl font-display font-extrabold text-lg text-indigo-950 min-h-[56px]"
              >
                Повернутися до гри
              </button>
              <button
                onClick={() => { playUiClick(); onLogout?.(); onBack?.(); }}
                className="knowledge-secondary-button-muted w-full py-2.5 rounded-xl text-sm font-display font-bold"
              >
                Вийти з акаунта
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Гість: форма входу/реєстрації ----
  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />
      <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 py-8 pb-16">
        <div className="mb-2">
          <TopBar onBack={onBack} title="Акаунт" />
        </div>

        <div className="text-center mb-5">
          <p className="font-body text-violet-100 text-sm font-semibold">
            Гра працює і без акаунта
          </p>
          <p className="font-body text-violet-300/70 text-xs mt-0.5">
            Увійди, щоб зберігати прогрес між пристроями
          </p>
        </div>

        <div className="modal-panel rounded-[26px] max-w-[520px] mx-auto px-6 sm:px-8 py-6">
          <div
            className="knowledge-segmented mb-5"
            role="group"
            aria-label="Вхід чи реєстрація"
          >
            <button
              type="button"
              onClick={() => switchMode("login")}
              aria-pressed={mode === "login"}
              className={`knowledge-segmented-btn ${mode === "login" ? "knowledge-segmented-btn-active" : ""}`}
            >
              Увійти
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              aria-pressed={mode === "register"}
              className={`knowledge-segmented-btn ${mode === "register" ? "knowledge-segmented-btn-active" : ""}`}
            >
              Створити акаунт
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm text-violet-200/85">Логін</span>
              <input
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="ім'я@пошта.com"
                aria-label="Логін"
                className={`form-input font-body text-base rounded-xl px-4 py-4 min-h-[60px] ${emailHasError ? "form-input-error" : ""}`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm text-violet-200/85">Пароль</span>
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder={mode === "login" ? "Введи пароль" : "Придумай пароль"}
                  aria-label="Пароль"
                  className={`form-input font-body text-base rounded-xl pl-4 pr-14 py-4 min-h-[60px] w-full ${passwordHasError ? "form-input-error" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  aria-label={showPassword ? "Приховати пароль" : "Показати пароль"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-lg text-violet-300/80 hover:text-white transition"
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
              {mode === "register" && (
                <span className="font-body text-xs text-violet-300/70">Не менше 8 символів</span>
              )}
            </label>

            {mode === "register" && (
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-sm text-violet-200/85">Повторити пароль</span>
                <input
                  ref={confirmRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Введи пароль ще раз"
                  aria-label="Повторити пароль"
                  className={`form-input font-body text-base rounded-xl px-4 py-4 min-h-[60px] ${confirmHasError ? "form-input-error" : ""}`}
                />
              </label>
            )}

            {error && (
              <p
                role="status"
                aria-live="polite"
                className="font-body text-sm text-rose-300 text-center flex items-center justify-center gap-1.5"
              >
                <span aria-hidden="true">⚠</span> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={loading}
              className={
                fieldsFilled
                  ? "knowledge-cta-button w-full py-3.5 rounded-2xl font-display font-extrabold text-lg text-indigo-950 min-h-[58px] disabled:pointer-events-none mt-1"
                  : "knowledge-secondary-button-muted w-full py-3.5 rounded-2xl font-display font-extrabold text-lg min-h-[58px] cursor-not-allowed mt-1"
              }
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="auth-spinner" aria-hidden="true" />
                  Входимо…
                </span>
              ) : mode === "login" ? (
                "Увійти"
              ) : (
                "Створити акаунт"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
