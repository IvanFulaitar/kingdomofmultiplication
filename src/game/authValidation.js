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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ті самі межі, що й server/src/schemas/auth.js: 8 — мінімум для нового
// пароля, 72 — жорсткий ліміт bcrypt(js) на вхідну довжину.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

// Повертає рядок помилки або null, якщо все гаразд.
export function validateEmail(raw) {
  const value = (raw ?? "").trim();
  if (!value) return "Введи логін";
  if (!EMAIL_RE.test(value)) return "Некоректний email";
  return null;
}

// Логін навмисно НЕ перевіряє мінімальну довжину пароля (як і
// server/src/schemas/auth.js: loginSchema) — старий пароль міг бути
// коротшим за поточні правила ще до їх запровадження.
export function validatePasswordForLogin(raw) {
  if (!raw) return "Пароль обов'язковий";
  return null;
}

export function validatePasswordForRegister(raw) {
  if (!raw) return "Введи пароль";
  if (raw.length < PASSWORD_MIN) return `Пароль має містити щонайменше ${PASSWORD_MIN} символів`;
  if (raw.length > PASSWORD_MAX) return `Пароль занадто довгий (максимум ${PASSWORD_MAX} символів)`;
  return null;
}

export function validateConfirmPassword(password, confirm) {
  if (!confirm) return "Повтори пароль";
  if (confirm !== password) return "Паролі не збігаються";
  return null;
}
