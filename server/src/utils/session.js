import crypto from "node:crypto";

// roles-and-architecture-plan.md, розділ 12.2 — рекомендація 30 днів,
// ковзне вікно: кожне успішне оновлення (POST /refresh) видає новий
// refresh-токен із тим самим строком дії наперед від моменту оновлення.
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Сирий refresh-токен — високоентропійний випадковий рядок, не JWT:
// немає сенсу в підписаному payload для того, що й так лише шукається
// за хешем у user_sessions (на відміну від access-токена, який сам
// несе payload і перевіряється БЕЗ звернення до БД на кожен запит).
// 48 байт -> 96 hex-символів.
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

// Хешуємо ПЕРЕД записом у БД — так само, як passwordHash ніколи не
// зберігає сирий пароль (server/src/utils/password.js). Свідомо НЕ
// bcrypt: той навмисно повільний (захист від перебору короткого
// людського пароля), а тут потрібен швидкий точний LOOKUP за хешем
// уже високоентропійного токена — SHA-256 годиться і не сповільнює
// кожен запит на оновлення сесії.
export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
