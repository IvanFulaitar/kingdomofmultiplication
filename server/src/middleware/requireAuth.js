import { verifyToken } from "../utils/jwt.js";

// Очікує заголовок "Authorization: Bearer <token>". При успіху кладе
// { id, email } у req.user і пускає далі; інакше одразу відповідає 401
// із поясненням (без токена і без розшифровки роуту, що йде далі).
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Потрібен токен авторизації (Authorization: Bearer <token>)" });
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Недійсний або прострочений токен" });
  }
}
