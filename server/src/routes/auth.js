import { Router } from "express";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { authRateLimit } from "../middleware/authRateLimit.js";
import { registerSchema, loginSchema } from "../schemas/auth.js";

const router = Router();

// Ніколи не повертати passwordHash клієнту — лише ці три поля.
function toPublicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

// POST /api/auth/register — { email, password } -> { token, user }
// validate() уже перевірив формат і нормалізував email (trim+lowercase)
// до того, як запит сюди дістався — req.body.email тут завжди чистий.
router.post("/register", authRateLimit, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Користувач із таким email вже існує" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

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
      return res.status(401).json({ error: "Неправильний email або пароль" });
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: "Неправильний email або пароль" });
    }

    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — Authorization: Bearer <token> -> { user }
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: "Користувача не знайдено" });
    }
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
