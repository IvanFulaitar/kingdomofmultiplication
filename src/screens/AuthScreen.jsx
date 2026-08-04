import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import TopBar from "../components/TopBar.jsx";
import ArtImage from "../components/ArtImage.jsx";
import { AVATARS } from "../data/cosmetics.js";
import { register, login } from "../game/auth.js";
import { ApiError } from "../game/apiClient.js";
import { playUiClick, playPurchaseSuccess } from "../game/sfx.js";
import { AUTH_ENABLED } from "../config.js";
import {
  validateEmail,
  validatePasswordForLogin,
  validatePasswordForRegister,
  validateConfirmPassword,
} from "../game/authValidation.js";

// Екран входу/реєстрації + профіль. Акаунт — необов'язкова фіча
// (frontend-backend-integration-plan.md): гра й далі повністю грається
// без нього, цей екран лише додає можливість не втратити прогрес при
// зміні телефону. Автоматичної синхронізації самого ігрового прогресу ще
// не існує (окремий, значно більший наступний етап) — тому тут чесно
// показуємо лише "Акаунт активний"/"Акаунт створено!", а не вигадане
// "Прогрес синхронізовано" чи покроковий фейковий "sync"-статус.
//
// Під капотом акаунт і далі працює через email (бекенд це вимагає), але
// підпис поля — "Логін", а після входу дитині показується лише зрозуміла
// "логін"-подібна частина адреси (до "@"), не вся технічна пошта. Клієнтська
// валідація (authValidation.js) навмисно дзеркалить РЕАЛЬНІ правила
// сервера (server/src/schemas/auth.js: email-формат, пароль 8-72 символів
// на реєстрації, без мінімуму на вході) — без вигаданого username-формату
// чи перевірки "логін вільний" (такого ендпойнта в бекенді немає).
//
// Локалізація: усі видимі тексти йдуть через t() (namespaces auth/
// validation/errors/common) — і форма, і помилки валідації, і помилки
// сервера одразу перемикаються разом зі зміною мови в налаштуваннях.
// Помилки сервера тепер приходять з err.code (server/src/routes/auth.js,
// напр. "INVALID_CREDENTIALS") — перекладаємо код через t(`errors:...`);
// якщо старий деплой бекенду ще не надсилає code (before цього коміту),
// тихо падаємо на err.message (завжди українською, як і раніше).
//
// user/avatarId/onLogout — якщо передано user, екран одразу показує
// профіль замість форми. onBack — повернутись у меню. onAuthenticated(user)
// — після успішного login/register.
export default function AuthScreen({ user, avatarId, onBack, onAuthenticated, onLogout }) {
  const { t } = useTranslation(["auth", "validation", "errors", "common"]);
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverError, setServerError] = useState(null); // { code, message } | null
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const loginTabRef = useRef(null);
  const registerTabRef = useRef(null);

  // translateFieldError({code, params}|null) -> перекладений текст або null.
  function translateFieldError(err) {
    if (!err) return null;
    return t(`validation:${err.code}`, err.params);
  }

  // Живі результати валідації — рахуються щокадру з поточних значень полів,
  // тому помилка зникає одразу, щойно поле стає коректним (без затримки).
  const emailErr = validateEmail(email);
  const passwordErr =
    mode === "login" ? validatePasswordForLogin(password) : validatePasswordForRegister(password);
  const confirmErr = mode === "register" ? validateConfirmPassword(password, confirmPassword) : null;
  const isValid = !emailErr && !passwordErr && !confirmErr;

  // Показувати помилку під полем лише після того, як користувач його
  // покинув (blur), або після першої спроби відправити форму — не раніше.
  const showEmailError = (touched.email || submitAttempted) && !!emailErr;
  const showPasswordError = (touched.password || submitAttempted) && !!passwordErr;
  const showConfirmError = mode === "register" && (touched.confirm || submitAttempted) && !!confirmErr;

  // Галочка "поле валідне" — лише там, де це справді щось підтверджує
  // (не для пароля на вході: там немає вимог, крім "не порожній").
  const emailShowsValid = touched.email && !emailErr && email.trim().length > 0;
  const passwordShowsValid = mode === "register" && touched.password && !passwordErr;
  const confirmShowsValid = mode === "register" && touched.confirm && !confirmErr;

  const formLocked = loading || success;
  const canSubmit = isValid && !formLocked;

  useEffect(() => {
    if (!serverError) return;
    passwordRef.current?.focus();
  }, [serverError]);

  function switchMode(next) {
    if (next === mode || formLocked) return;
    playUiClick();
    setMode(next);
    setServerError(null);
    setSubmitAttempted(false);
  }

  function handleTabKeyDown(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = mode === "login" ? "register" : "login";
    switchMode(next);
    (next === "login" ? loginTabRef : registerTabRef).current?.focus();
  }

  function markTouched(field) {
    setTouched((t2) => (t2[field] ? t2 : { ...t2, [field]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (formLocked) return;
    setSubmitAttempted(true);
    if (!isValid) {
      if (emailErr) emailRef.current?.focus();
      else if (passwordErr) passwordRef.current?.focus();
      else confirmRef.current?.focus();
      return;
    }

    setServerError(null);
    setLoading(true);
    try {
      const authedUser =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(email.trim(), password);
      setLoading(false);
      setSuccess(true);
      playPurchaseSuccess();
      // Коротка, чесна пауза з галочкою перед переходом — без вигаданого
      // "Зберігаємо прогрес…/Синхронізовано" (самого прогресу поки не
      // синхронізуємо, лише акаунт створено/вхід виконано).
      setTimeout(() => onAuthenticated?.(authedUser), 550);
    } catch (err) {
      setLoading(false);
      // При невдалому вході: не чистимо email, не чистимо пароль, не
      // видаємо, яке саме поле невірне (те саме робить і сам сервер —
      // однакове повідомлення на "нема юзера" й "невірний пароль").
      const code = err instanceof ApiError ? err.code : null;
      const message = err instanceof ApiError ? err.message : null;
      setServerError({ code, message });
      if (mode === "login") {
        setPassword("");
        setTouched((t2) => ({ ...t2, password: false }));
      }
    }
  }

  // code є й переклад для нього існує -> перекладений текст. Інакше —
  // сирий message з бекенду (старий деплой без code, завжди українською),
  // а якщо й того нема — загальний fallback (розділ 19 брифу локалізації:
  // ніколи не показувати дитині голий ключ чи "undefined").
  function translateServerError(err) {
    if (!err) return "";
    if (err.code && t(`errors:${err.code}`, { defaultValue: "" })) return t(`errors:${err.code}`);
    return err.message || t("errors:UNKNOWN");
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
            <TopBar onBack={onBack} title={t("auth:screenTitle")} />
          </div>

          <div className="rpg-panel rounded-[26px] max-w-[560px] mx-auto px-6 sm:px-8 py-8 mt-6 text-center">
            <div className="avatar-medallion inline-block mb-4">
              <ArtImage
                src={`/assets/avatars/${avatar.id}.png`}
                fallback={avatar.icon}
                alt=""
                className="w-20 h-20 rounded-full object-contain mx-auto flex items-center justify-center text-4xl"
              />
            </div>
            <p className="font-display font-extrabold text-xl text-white mb-1">{displayName}</p>
            <p className="text-sm text-emerald-300/90 mb-7">{t("auth:profileActive")}</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={onBack}
                className="knowledge-cta-button w-full py-3.5 rounded-2xl font-display font-extrabold text-lg text-indigo-950 min-h-[56px]"
              >
                {t("auth:backToGame")}
              </button>
              <button
                onClick={() => { playUiClick(); onLogout?.(); onBack?.(); }}
                className="knowledge-secondary-button-muted w-full py-2.5 rounded-xl text-sm font-display font-bold"
              >
                {t("auth:logout")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Акаунти ще вимкнено (AUTH_ENABLED=false): чесний стан "У
  // розробці" замість форми, яка нічого не вміє надіслати (auth-freeze-
  // brief.md). Жодних input-полів, жодних auth-запитів — лише пояснення,
  // що прогрес і так уже автоматично зберігається локально. ----
  if (!AUTH_ENABLED) {
    return (
      <div className="relative overflow-hidden min-h-dvh screen-in">
        <div className="center-vignette" />
        <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 py-8 pb-16">
          <div className="mb-2">
            <TopBar onBack={onBack} title={t("auth:screenTitle")} />
          </div>

          <div className="rpg-panel rounded-[26px] max-w-[560px] mx-auto px-6 sm:px-8 py-8 mt-6 text-center">
            <ArtImage
              src="/assets/icons/ui/cloud.png"
              fallback="☁️"
              alt=""
              className="w-16 h-16 object-contain mx-auto mb-4 flex items-center justify-center text-5xl"
            />
            <span className="menu-nav-badge inline-block rounded-full px-3 py-1 text-xs font-display font-extrabold mb-3">
              {t("auth:comingSoonTitle")}
            </span>
            <p className="font-body text-violet-100 text-sm font-semibold mb-5">
              {t("auth:comingSoonSubtitle")}
            </p>

            <div className="text-left bg-white/5 border border-white/10 rounded-2xl px-4 py-4 mb-5">
              <p className="text-sm text-violet-100 leading-relaxed mb-2">{t("auth:comingSoonExplain1")}</p>
              <p className="text-sm text-violet-100 leading-relaxed">{t("auth:comingSoonExplain2")}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-left">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5">
                <p className="font-display font-bold text-xs text-emerald-300 mb-2 uppercase tracking-wide">
                  {t("auth:availableNowTitle")}
                </p>
                <ul className="flex flex-col gap-1.5 text-sm text-violet-100">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 shrink-0" aria-hidden="true">✓</span>
                    {t("auth:availableNowItem1")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 shrink-0" aria-hidden="true">✓</span>
                    {t("auth:availableNowItem2")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 shrink-0" aria-hidden="true">✓</span>
                    {t("auth:availableNowItem3")}
                  </li>
                </ul>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5">
                <p className="font-display font-bold text-xs text-amber-300 mb-2 uppercase tracking-wide">
                  {t("auth:comingLaterTitle")}
                </p>
                <ul className="flex flex-col gap-1.5 text-sm text-violet-200/80">
                  <li className="flex items-start gap-2">
                    <span className="shrink-0" aria-hidden="true">☁</span>
                    {t("auth:comingLaterItem1")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0" aria-hidden="true">☁</span>
                    {t("auth:comingLaterItem2")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0" aria-hidden="true">☁</span>
                    {t("auth:comingLaterItem3")}
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={onBack}
              className="knowledge-cta-button w-full py-3.5 rounded-2xl font-display font-extrabold text-lg text-indigo-950 min-h-[56px]"
            >
              {t("auth:backToGame")}
            </button>
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
          <TopBar onBack={onBack} title={t("auth:screenTitle")} />
        </div>

        <div className="text-center mb-5">
          <p className="font-body text-violet-100 text-sm font-semibold">
            {t("auth:guestHeadline")}
          </p>
          <p className="font-body text-violet-300/70 text-xs mt-0.5">
            {t("auth:guestSubline")}
          </p>
        </div>

        <div className="rpg-panel rounded-[26px] max-w-[560px] mx-auto px-7 sm:px-8 py-7">
          <div
            className="knowledge-segmented mb-5"
            role="tablist"
            aria-label={`${t("auth:tabLogin")} / ${t("auth:tabRegister")}`}
          >
            <button
              type="button"
              ref={loginTabRef}
              role="tab"
              id="auth-tab-login"
              aria-selected={mode === "login"}
              aria-controls="auth-panel"
              tabIndex={mode === "login" ? 0 : -1}
              onKeyDown={handleTabKeyDown}
              onClick={() => switchMode("login")}
              className={`knowledge-segmented-btn ${mode === "login" ? "knowledge-segmented-btn-active" : ""}`}
            >
              {t("auth:tabLogin")}
            </button>
            <button
              type="button"
              ref={registerTabRef}
              role="tab"
              id="auth-tab-register"
              aria-selected={mode === "register"}
              aria-controls="auth-panel"
              tabIndex={mode === "register" ? 0 : -1}
              onKeyDown={handleTabKeyDown}
              onClick={() => switchMode("register")}
              className={`knowledge-segmented-btn ${mode === "register" ? "knowledge-segmented-btn-active" : ""}`}
            >
              {t("auth:tabRegister")}
            </button>
          </div>

          <form
            id="auth-panel"
            role="tabpanel"
            aria-labelledby={mode === "login" ? "auth-tab-login" : "auth-tab-register"}
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-5"
          >
            <label htmlFor="auth-email" className="flex flex-col gap-2">
              <span className="font-body text-sm text-violet-200/85">{t("auth:loginLabel")}</span>
              <div className="relative">
                <input
                  ref={emailRef}
                  id="auth-email"
                  name="username"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => markTouched("email")}
                  disabled={formLocked}
                  placeholder={t("auth:loginPlaceholder")}
                  aria-invalid={showEmailError}
                  aria-describedby={showEmailError ? "auth-email-error" : undefined}
                  className={`form-input font-body text-base rounded-2xl px-5 py-4 min-h-[60px] w-full ${
                    showEmailError ? "form-input-error" : emailShowsValid ? "form-input-valid" : ""
                  }`}
                />
                {emailShowsValid && !showEmailError && (
                  <span
                    aria-hidden="true"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 text-lg"
                  >
                    ✓
                  </span>
                )}
              </div>
              {showEmailError && (
                <p id="auth-email-error" role="alert" className="font-body text-xs text-rose-300">
                  {translateFieldError(emailErr)}
                </p>
              )}
            </label>

            <label htmlFor="auth-password" className="flex flex-col gap-2">
              <span className="font-body text-sm text-violet-200/85">{t("auth:passwordLabel")}</span>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="auth-password"
                  name={mode === "login" ? "current-password" : "new-password"}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => markTouched("password")}
                  disabled={formLocked}
                  placeholder={mode === "login" ? t("auth:passwordPlaceholderLogin") : t("auth:passwordPlaceholderRegister")}
                  aria-invalid={showPasswordError}
                  aria-describedby={showPasswordError ? "auth-password-error" : undefined}
                  className={`form-input font-body text-base rounded-2xl pl-5 pr-24 py-4 min-h-[60px] w-full ${
                    showPasswordError ? "form-input-error" : passwordShowsValid ? "form-input-valid" : ""
                  }`}
                />
                {passwordShowsValid && !showPasswordError && (
                  <span
                    aria-hidden="true"
                    className="absolute right-14 top-1/2 -translate-y-1/2 text-emerald-400 text-lg"
                  >
                    ✓
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={formLocked}
                  aria-label={showPassword ? t("auth:hidePassword") : t("auth:showPassword")}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-violet-300/80 hover:text-white transition"
                >
                  <ArtImage
                    src={showPassword ? "/assets/icons/ui/eye_closed.png" : "/assets/icons/ui/eye_open.png"}
                    fallback={showPassword ? "🙈" : "👁"}
                    alt=""
                    className="w-11 h-11 object-contain flex items-center justify-center text-4xl"
                  />
                </button>
              </div>
              {mode === "register" && !showPasswordError && (
                <span className="font-body text-xs text-violet-300/70">{t("auth:passwordHintMinLength")}</span>
              )}
              {showPasswordError && (
                <p id="auth-password-error" role="alert" className="font-body text-xs text-rose-300">
                  {translateFieldError(passwordErr)}
                </p>
              )}
            </label>

            {mode === "register" && (
              <label htmlFor="auth-confirm-password" className="flex flex-col gap-2">
                <span className="font-body text-sm text-violet-200/85">{t("auth:confirmPasswordLabel")}</span>
                <div className="relative">
                  <input
                    ref={confirmRef}
                    id="auth-confirm-password"
                    name="new-password-confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => markTouched("confirm")}
                    disabled={formLocked}
                    placeholder={t("auth:confirmPasswordPlaceholder")}
                    aria-invalid={showConfirmError}
                    aria-describedby={showConfirmError ? "auth-confirm-error" : undefined}
                    className={`form-input font-body text-base rounded-2xl pl-5 pr-24 py-4 min-h-[60px] w-full ${
                      showConfirmError ? "form-input-error" : confirmShowsValid ? "form-input-valid" : ""
                    }`}
                  />
                  {confirmShowsValid && !showConfirmError && (
                    <span
                      aria-hidden="true"
                      className="absolute right-14 top-1/2 -translate-y-1/2 text-emerald-400 text-lg"
                    >
                      ✓
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    disabled={formLocked}
                    aria-label={showConfirmPassword ? t("auth:hidePassword") : t("auth:showPassword")}
                    aria-pressed={showConfirmPassword}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-violet-300/80 hover:text-white transition"
                  >
                    <ArtImage
                      src={showConfirmPassword ? "/assets/icons/ui/eye_closed.png" : "/assets/icons/ui/eye_open.png"}
                      fallback={showConfirmPassword ? "🙈" : "👁"}
                      alt=""
                      className="w-11 h-11 object-contain flex items-center justify-center text-4xl"
                    />
                  </button>
                </div>
                {showConfirmError && (
                  <p id="auth-confirm-error" role="alert" className="font-body text-xs text-rose-300">
                    {translateFieldError(confirmErr)}
                  </p>
                )}
              </label>
            )}

            {serverError && (
              <div role="alert" aria-live="assertive" className="form-error-panel rounded-xl px-3.5 py-3 flex items-start gap-2.5">
                <span aria-hidden="true" className="text-lg leading-none mt-0.5">⚠</span>
                <p className="font-body text-sm text-rose-100 flex-1">{translateServerError(serverError)}</p>
                <button
                  type="button"
                  onClick={() => setServerError(null)}
                  aria-label={t("auth:closeErrorAriaLabel")}
                  className="text-rose-200/70 hover:text-white text-lg leading-none px-1"
                >
                  ×
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={loading}
              className={
                isValid && !formLocked
                  ? "knowledge-cta-button w-full py-3.5 rounded-2xl font-display font-extrabold text-lg text-indigo-950 min-h-[58px] disabled:pointer-events-none mt-1"
                  : "knowledge-secondary-button-muted w-full py-3.5 rounded-2xl font-display font-extrabold text-lg min-h-[58px] cursor-not-allowed mt-1"
              }
            >
              {success ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span aria-hidden="true">✓</span>
                  {mode === "login" ? t("auth:submitLoginSuccess") : t("auth:submitRegisterSuccess")}
                </span>
              ) : loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="auth-spinner" aria-hidden="true" />
                  {mode === "login" ? t("auth:submitLoginLoading") : t("auth:submitRegisterLoading")}
                </span>
              ) : mode === "login" ? (
                t("auth:submitLogin")
              ) : (
                t("auth:submitRegister")
              )}
            </button>

            {mode === "register" && !success && (
              <p className="font-body text-xs text-violet-300/80 text-center -mt-1">
                {t("auth:registerRecoveryHint")}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
