import jwt from "jsonwebtoken";

// roles-and-architecture-plan.md, розділ 12.2 — короткоживучий
// access-токен: якщо його вкрадуть (XSS, лог тощо), шкода обмежена
// кількома хвилинами, а не місяцем. Довгий "sesion" тепер живе окремо —
// у user_sessions (refresh-токен у HttpOnly cookie, server/src/routes/
// auth.js: POST /refresh), який і продовжує сесію непомітно для дитини.
const JWT_EXPIRES_IN = "15m";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET не заданий — перевір .env (див. .env.example)");
  }
  return secret;
}

// payload: { sub: user.id, email: user.email }
export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRES_IN });
}

// Кидає помилку (jwt.JsonWebTokenError / TokenExpiredError), якщо токен
// недійсний чи прострочений — обробляється у requireAuth middleware.
export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
