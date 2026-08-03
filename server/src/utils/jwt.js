import jwt from "jsonwebtoken";

// MVP: один довгоживучий токен, без refresh-flow (backend-mvp-plan.md,
// розділ 8 — свідоме обмеження, додати короткоживучі access+refresh
// пізніше, коли з'явиться реальна потреба).
const JWT_EXPIRES_IN = "30d";

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
