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
  message: { error: "Забагато спроб. Спробуй ще раз через кілька хвилин." },
});
