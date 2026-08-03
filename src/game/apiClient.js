// Тонка обгортка над fetch для звернень до бекенду (server/).
// Нічого не знає про ігровий прогрес — лише HTTP-деталі: базовий URL,
// заголовки, парсинг помилок у зрозумілий формат.

// VITE_API_URL — адреса задеплоєного API (Railway). Якщо не задано (напр.
// локальна розробка без свого бекенду), падаємо на localhost:3000, де
// зазвичай піднятий `npm run dev` з server/.
const BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/+$/, "");

// Помилка мережевого запиту до API — відрізняється від інших винятків,
// щоб виклики могли показати дитині зрозуміле повідомлення замість
// технічного тексту з сервера.
export class ApiError extends Error {
  constructor(message, { status = null, cause = null, code = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.cause = cause;
    // Стабільний код помилки від бекенду (напр. "INVALID_CREDENTIALS") —
    // якщо є, UI перекладає його через t("errors:<code>") замість того,
    // щоб напряму показувати готовий (завжди український) message нижче.
    // "message" лишається як fallback для розгортань бекенду, що ще не
    // повертають code (не ламає старі деплої).
    this.code = code;
  }
}

// path — напр. "/api/auth/login". token — необов'язковий JWT для
// Authorization: Bearer. body — звичайний об'єкт, серіалізується в JSON.
export async function apiRequest(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    // fetch сам кинув виняток — сервер недоступний, немає інтернету тощо.
    throw new ApiError("Не вдалося з'єднатися з сервером. Перевір інтернет і спробуй ще раз.", {
      cause,
      code: "NETWORK_ERROR",
    });
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Порожня/не-JSON відповідь (напр. 204) — не вважаємо це помилкою тут,
    // конкретні виклики самі вирішують, чи очікували вони тіло.
  }

  if (!response.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      "Сталася помилка на сервері. Спробуй ще раз.";
    const code = (data && typeof data.code === "string" && data.code) || null;
    throw new ApiError(message, { status: response.status, code });
  }

  return data;
}
