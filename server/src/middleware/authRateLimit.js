import rateLimit from "express-rate-limit";

// Захист /register і /login від перебору паролів (backend-mvp-plan.md,
// розділ 5). 10 спроб на IP за 15 хвилин — щедро для реальної дитини/
// батьків, які помиляються з паролем кілька разів, але заважає
// автоматизованому перебору.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Забагато спроб. Спробуй ще раз через кілька хвилин.", code: "TOO_MANY_REQUESTS" },
});

// /refresh викликається автоматично застосунком (не людиною, що вводить
// пароль) — може легітимно спрацювати частіше за 10/15хв, якщо в сім'ї
// кілька вкладок/пристроїв одночасно. Щедріший ліміт, той самий захист
// від грубого зловживання, не від нормального використання.
export const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Забагато спроб. Спробуй ще раз через кілька хвилин.", code: "TOO_MANY_REQUESTS" },
});
