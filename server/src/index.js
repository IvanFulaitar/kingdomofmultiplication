import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./db.js";
import authRouter from "./routes/auth.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Базові безпечні HTTP-заголовки — перед усім іншим.
app.use(helmet());

// Дозволені origin'и — лише зі списку в CORS_ORIGIN (кома-розділений,
// напр. "https://kingdom.frontstart.com.ua,http://localhost:5173").
// Якщо змінна не задана — CORS_ORIGIN відсутній -> `origin: false`,
// тобто НІЯКИЙ браузерний cross-origin запит не пройде (безпечний
// дефолт "закрито", а не випадковий "*"). curl/Postman/сервер-до-сервера
// CORS не стосується — це обмеження лише для браузера.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
  })
);

app.use(express.json());

// Крок 1 (backend-mvp-plan.md, розділ 4) — health-ендпоінт: підтверджує,
// що API живе І що з'єднання з Postgres справді працює (не лише що
// процес запущений). Саме це буде перше, що перевіряється після деплою
// на Railway. Навмисно не падає з 500, якщо БД недоступна — повертає
// 503 з поясненням, щоб одразу було видно ЩО саме не працює.
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    res.status(503).json({ ok: false, db: "unreachable", error: err.message });
  }
});

// Крок 2 (backend-mvp-plan.md, розділ 4) — register/login/me.
app.use("/api/auth", authRouter);

// Єдиний обробник помилок — щоб непередбачена помилка (напр. Prisma не
// може достукатись до БД) поверталась як зрозумілий JSON 500, а не
// обривала з'єднання чи "гола" express-сторінка стектрейсу.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Внутрішня помилка сервера" });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
