// Валідує req.body проти zod-схеми ДО того, як запит дістанеться роуту —
// роут отримує вже перевірені й нормалізовані дані (email.trim().
// toLowerCase() тощо йде через сам zod-опис поля), не займається
// перевірками сам.
export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Некоректні дані";
      return res.status(400).json({ error: message, code: "VALIDATION_ERROR" });
    }
    req.body = parsed.data;
    next();
  };
}
