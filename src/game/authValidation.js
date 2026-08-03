// Клієнтська валідація для AuthScreen.jsx — навмисно дзеркалить РЕАЛЬНІ
// правила бекенду (server/src/schemas/auth.js), а не якийсь окремий,
// вигаданий набір обмежень. Якщо колись зміняться правила на сервері —
// звірити й підправити тут теж, це єдине джерело правди для фронтенду.
//
// Важливо: поле в UI підписане "Логін", але бекенд і зараз вимагає саме
// email-формат (унікальне поле з @-адресою) — це свідоме рішення (див.
// AuthScreen.jsx, коментар про "під капотом акаунт і далі працює через
// email"). Тому тут перевіряється саме email-формат, а не довільний
// "username" (латиниця/цифри/підкреслення) — інакше форма приймала б
// логіни, які сервер одразу відхилить.
//
// Локалізація (i18n/): функції тут повертають { code, params? } замість
// готового тексту — AuthScreen.jsx сам перекладає код через
// t(`validation:${code}`, params), щоб повідомлення одразу змінювалось
// разом із мовою інтерфейсу (розділ 13 брифу локалізації), а не лишалось
// закам'янілим українським рядком у React-стані.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ті самі межі, що й server/src/schemas/auth.js: 8 — мінімум для нового
// пароля, 72 — жорсткий ліміт bcrypt(js) на вхідну довжину.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

// Повертає { code, params? } або null, якщо все гаразд.
export function validateEmail(raw) {
  const value = (raw ?? "").trim();
  if (!value) return { code: "EMAIL_REQUIRED" };
  if (!EMAIL_RE.test(value)) return { code: "EMAIL_INVALID" };
  return null;
}

// Логін навмисно НЕ перевіряє мінімальну довжину пароля (як і
// server/src/schemas/auth.js: loginSchema) — старий пароль міг бути
// коротшим за поточні правила ще до їх запровадження.
export function validatePasswordForLogin(raw) {
  if (!raw) return { code: "PASSWORD_REQUIRED" };
  return null;
}

export function validatePasswordForRegister(raw) {
  if (!raw) return { code: "PASSWORD_REQUIRED_REGISTER" };
  if (raw.length < PASSWORD_MIN) return { code: "PASSWORD_TOO_SHORT", params: { min: PASSWORD_MIN } };
  if (raw.length > PASSWORD_MAX) return { code: "PASSWORD_TOO_LONG", params: { max: PASSWORD_MAX } };
  return null;
}

export function validateConfirmPassword(password, confirm) {
  if (!confirm) return { code: "CONFIRM_REQUIRED" };
  if (confirm !== password) return { code: "CONFIRM_MISMATCH" };
  return null;
}
