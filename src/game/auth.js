// Акаунт гравця (email/пароль через бекенд server/). Повністю окремо від
// ігрового прогресу: свій ключ у localStorage, ніяк не торкається
// STORAGE_KEY з progress.js. Якщо акаунта нема або токен недійсний — гра
// просто працює як і раніше, локально.
import { apiRequest, ApiError } from "./apiClient.js";

const TOKEN_KEY = "kingdom-multiplication-auth-token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    // localStorage може бути недоступний (приватний режим тощо) —
    // тоді акаунт просто не зберігається між сесіями, без падіння гри.
    return null;
  }
}

function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Немає localStorage — нічого не можемо зробити, ігноруємо.
  }
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Немає localStorage — і так уже "розлогінені".
  }
}

// Створити акаунт. Кидає ApiError з людським повідомленням при невдачі
// (зайнятий email, закороткий пароль тощо) — виклик сам вирішує, як
// показати це в UI.
export async function register(email, password) {
  const data = await apiRequest("/api/auth/register", {
    method: "POST",
    body: { email, password },
  });
  setToken(data.token);
  return data.user;
}

// Увійти в наявний акаунт.
export async function login(email, password) {
  const data = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setToken(data.token);
  return data.user;
}

// Перевірити токен, збережений із минулого разу (виклик при старті гри).
// Повертає користувача, якщо токен ще дійсний, або null — якщо токена
// нема, чи він прострочений/недійсний (у цьому разі токен тихо чиститься,
// без помилки — дитина просто бачить гостьовий стан).
export async function fetchMe() {
  const token = getToken();
  if (!token) return null;

  try {
    const data = await apiRequest("/api/auth/me", { token });
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
      return null;
    }
    // Інша помилка (сервер тимчасово недоступний тощо) — не чистимо
    // токен, можливо наступного разу зайде; просто повідомляємо, що
    // зараз сесію підтвердити не вдалося.
    throw err;
  }
}

export function logout() {
  clearToken();
}
