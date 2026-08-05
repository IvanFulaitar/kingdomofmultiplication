export const REFRESH_COOKIE_NAME = "kingdom_refresh";

// Мінімальний парсер заголовка Cookie запиту — без окремої залежності
// cookie-parser: res.cookie()/res.clearCookie() для ВІДПОВІДІ вже
// вбудовані в Express (через пакет "cookie", який express і так тягне
// транзитивно), для читання вхідного заголовка вистачає кількох рядків.
export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (!key) continue;
    const rawValue = pair.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(rawValue);
    } catch {
      out[key] = rawValue;
    }
  }
  return out;
}

// roles-and-architecture-plan.md, розділ 12.2/37 — коли фронтенд і
// бекенд на РІЗНИХ доменах (напр. Cloudflare Pages + Railway), браузер
// відправить cookie з fetch()-запиту лише при SameSite=None, а те
// вимагає Secure (HTTPS). Локальна розробка (http://localhost) не має
// HTTPS, і SameSite=None без Secure браузери просто відхилять — тому
// там свідомо Lax. Остаточний вибір насправді залежить від того, чи
// фронтенд і бекенд опиняться на одному домені в проді (розділ 37) —
// це прагматичний дефолт для обох поточних середовищ (dev/Railway), не
// остаточно "закрите" архітектурне рішення.
export function refreshCookieOptions(req, maxAgeMs) {
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    // Cookie навмисно звужена до /api/auth — не йде з КОЖНИМ запитом до
    // API, лише з тими, де вона реально потрібна (refresh/logout).
    path: "/api/auth",
    maxAge: maxAgeMs,
  };
}
