// Акаунт гравця (email/пароль через бекенд server/). Повністю окремо від
// ігрового прогресу: ніяк не торкається STORAGE_KEY з progress.js. Якщо
// акаунта нема або сесія недійсна — гра просто працює як і раніше, локально.
//
// roles-and-architecture-plan.md, розділ 12.2 — нова модель сесії:
// access-токен короткоживучий (15 хв, server/src/utils/jwt.js) і
// зберігається лише в ПАМ'ЯТІ модуля (не localStorage — щоб довгоживучий
// секрет не лежав у сховищі, доступному будь-якому скрипту на сторінці).
// Довге "пам'ятай мене" тепер забезпечує окремий refresh-токен у HttpOnly
// cookie (JS його взагалі не бачить, лишень браузер сам додає її до
// запитів на /api/auth/*) — саме тому getToken()/register()/login()
// нижче більше не читають і не пишуть жодного сховища напряму.
import { apiRequest, ApiError } from "./apiClient.js";

let accessToken = null;

export function getToken() {
  return accessToken;
}

function setToken(token) {
  accessToken = token;
}

function clearToken() {
  accessToken = null;
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

// Відновити сесію при старті гри. Access-токен у пам'яті зникає при
// кожному перезавантаженні сторінки, тож замість "чи є збережений
// токен" перевіряємо єдиний реальний доказ сесії — refresh-cookie: якщо
// вона ще дійсна на сервері, POST /refresh одразу видає новий
// access-токен І користувача одним запитом (server/src/routes/auth.js).
// Немає cookie (гість чи ще не логінився) чи вона прострочена/відкликана
// -> тихо null, без тривожної помилки дитині.
export async function fetchMe() {
  try {
    const data = await apiRequest("/api/auth/refresh", { method: "POST" });
    setToken(data.token);
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
      return null;
    }
    // Інша помилка (сервер тимчасово недоступний тощо) — не видаємо
    // помилку як "сесії нема", просто цього разу лишаємось гостем
    // поточного сеансу; наступний запуск спробує знову.
    throw err;
  }
}

// Той самий /refresh-виклик, що й fetchMe(), але для повторного
// використання посеред сесії (напр. якщо звичайний API-запит одного дня
// поверне 401 через прострочений access-токен) — окрема назва, щоб
// виклики читались за призначенням, хоч логіка ідентична.
export const refreshSession = fetchMe;

// Вихід — реальна server-side ревокація сесії (server/src/routes/auth.js:
// POST /logout), а не лише локальне очищення. Токен чиститься одразу,
// синхронно з погляду UI (гра не чекає на мережу, щоб показати гостьовий
// стан); якщо сам мережевий запит не вдався — сесія на сервері природно
// згасне сама, коли refresh-токен спливе.
export async function logout() {
  clearToken();
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch {
    // Див. коментар вище — локальний вихід уже стався, мережева помилка
    // тут не показується дитині як щось, що пішло не так.
  }
}
