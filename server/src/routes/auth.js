import { Router } from "express";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { authRateLimit, refreshRateLimit } from "../middleware/authRateLimit.js";
import { registerSchema, loginSchema } from "../schemas/auth.js";
import {
  generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS,
} from "../utils/session.js";
import { REFRESH_COOKIE_NAME, parseCookies, refreshCookieOptions } from "../utils/cookies.js";

const router = Router();

// Ніколи не повертати passwordHash клієнту — лише ці три поля.
function toPublicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

// roles-and-architecture-plan.md, розділ 12.2 — видає refresh-сесію
// (окремий, відкличний запис user_sessions) поверх звичайного
// access-токена, і кладе сирий refresh-токен у HttpOnly cookie.
// Викликається і з /register, і з /login — та сама логіка видачі сесії
// незалежно від того, як людина щойно потрапила в акаунт.
//
// Access-токен (signToken нижче) тепер короткоживучий (15 хв, server/
// src/utils/jwt.js) — фронтенд (src/game/auth.js) при старті й на 401
// сам звертається сюди по новий, тож дитина цього не помічає.
async function issueRefreshSession(req, res, userId) {
  const refreshToken = generateRefreshToken();
  await prisma.userSession.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      deviceLabel: (req.headers["user-agent"] ?? "").slice(0, 255) || null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(req, REFRESH_TOKEN_TTL_MS));
}

// POST /api/auth/register — { email, password } -> { token, user }
// validate() уже перевірив формат і нормалізував email (trim+lowercase)
// до того, як запит сюди дістався — req.body.email тут завжди чистий.
router.post("/register", authRateLimit, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        error: "Користувач із таким email вже існує",
        code: "EMAIL_ALREADY_EXISTS",
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    await issueRefreshSession(req, res, user.id);
    const token = signToken({ sub: user.id, email: user.email });
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login — { email, password } -> { token, user }
router.post("/login", authRateLimit, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Навмисно ОДНАКОВА помилка і коли юзера нема, і коли пароль
    // неправильний — щоб відповідь API не підказувала зловмиснику, які
    // email вже зареєстровані в системі.
    if (!user) {
      return res.status(401).json({
        error: "Неправильний email або пароль",
        code: "INVALID_CREDENTIALS",
      });
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({
        error: "Неправильний email або пароль",
        code: "INVALID_CREDENTIALS",
      });
    }

    await issueRefreshSession(req, res, user.id);
    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh — Cookie: kingdom_refresh=<...> -> { token, user }
// Ротація: пред'явлений refresh-токен одразу відкликається, видається
// новий (той самий принцип, що вже описаний для видачі вище) — навіть
// якщо цей ендпоінт ще ніхто не викликає з фронтенду, він мусить
// коректно працювати сам по собі (перевірено curl-чеклістом у README).
router.post("/refresh", refreshRateLimit, async (req, res, next) => {
  try {
    const presented = parseCookies(req)[REFRESH_COOKIE_NAME];
    if (!presented) {
      return res.status(401).json({ error: "Немає сесії для оновлення", code: "NO_REFRESH_SESSION" });
    }

    const session = await prisma.userSession.findFirst({
      where: { refreshTokenHash: hashRefreshToken(presented) },
    });

    if (!session) {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
      return res.status(401).json({ error: "Сесію не знайдено", code: "SESSION_NOT_FOUND" });
    }

    // Токен уже був використаний раніше (заротований) чи явно
    // відкликаний (logout) — можлива ознака крадіжки: відкликаємо ВСІ
    // активні сесії цього користувача, не лише цю (roles-and-
    // architecture-plan.md, розділ 12.2 — "виявляє повторне
    // використання вкраденого токена").
    if (session.revokedAt) {
      await prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
      return res.status(401).json({ error: "Сесію відкликано", code: "SESSION_REVOKED" });
    }

    if (session.expiresAt < new Date()) {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
      return res.status(401).json({ error: "Сесія прострочена", code: "SESSION_EXPIRED" });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
      return res.status(401).json({ error: "Користувача не знайдено", code: "USER_NOT_FOUND" });
    }

    const newRefreshToken = generateRefreshToken();
    await prisma.$transaction([
      prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      prisma.userSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: hashRefreshToken(newRefreshToken),
          deviceLabel: session.deviceLabel,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      }),
    ]);
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, refreshCookieOptions(req, REFRESH_TOKEN_TTL_MS));

    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — Cookie: kingdom_refresh=<...> -> { ok: true }
// Реальна server-side ревокація (на відміну від поточного фронтенду,
// який сьогодні лише чистить токен локально, нічого не кажучи серверу)
// — цю сесію більше не можна оновити через /refresh, навіть якщо сирий
// токен десь зберігся. Не вимагає Authorization-заголовка: достатньо
// самої cookie, щоб вийти можна було навіть з простроченим access-токеном.
router.post("/logout", async (req, res, next) => {
  try {
    const presented = parseCookies(req)[REFRESH_COOKIE_NAME];
    if (presented) {
      await prisma.userSession.updateMany({
        where: { refreshTokenHash: hashRefreshToken(presented), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — Authorization: Bearer <token> -> { user }
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: "Користувача не знайдено", code: "USER_NOT_FOUND" });
    }
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
