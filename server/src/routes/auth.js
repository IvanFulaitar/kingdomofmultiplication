import { Router } from "express";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Ніколи не повертати passwordHash клієнту — лише ці три поля.
function toPublicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

// Груба перевірка формату email — повноцінна zod-валідація приходить
// наступним кроком (backend-mvp-plan.md, розділ 5.7, разом з rate-limit/
// CORS/helmet); тут лише мінімум, щоб не пускати очевидний сміттєвий ввід.
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/auth/register — { email, password } -> { token, user }
router.post("/register", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Некоректний email" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Пароль має містити щонайменше 8 символів" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: "Користувач із таким email вже існує" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash },
    });

    const token = signToken({ sub: user.id, email: user.email });
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login — { email, password } -> { token, user }
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (!isValidEmail(email) || typeof password !== "string") {
      return res.status(400).json({ error: "Некоректний email або пароль" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

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
