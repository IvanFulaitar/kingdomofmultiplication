// launch-plan.md, розділ 8 "Додати окремий режим для дорослого" —
// хелпери для ParentScreen.jsx, окремо від mastery.js (той рахує засвоєння
// ПРИКЛАДІВ, це — активність/час поверх progress.activityLog, який
// заповнює progress.js:recordActivity). Плоский модуль з чистими функціями,
// без React — легко покрити тестами (tests/logic.test.mjs) так само, як
// mastery.js.

const DAY_MS = 86400000;

function daysAgoStr(n) {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
}

// Сума занять і активного часу за останні `days` календарних днів (включно
// із сьогодні). activityLog містить лише дні з реальною активністю, тож
// просто фільтруємо за датою, а не беремо останні N записів масиву.
export function activitySummary(activityLog = [], days = 7) {
  const cutoff = daysAgoStr(days - 1);
  const entries = activityLog.filter((e) => e.date >= cutoff);
  const sessions = entries.reduce((s, e) => s + (e.sessions ?? 0), 0);
  const activeMs = entries.reduce((s, e) => s + (e.activeMs ?? 0), 0);
  return { sessions, activeMs, daysActive: entries.length };
}

// "Знімок" загального засвоєння приблизно `days` днів тому — бере
// НАЙБЛИЖЧИЙ ПОПЕРЕДНІЙ запис до цієї дати (не обов'язково рівно той самий
// день: якщо дитина в цей день не грала, це все одно чесна оцінка "яким
// був прогрес на той момент"). null, якщо історія ще не сягає так далеко
// назад (замало даних для порівняння, а не "прогрес нульовий").
export function masteryScoreDaysAgo(activityLog = [], days) {
  const target = daysAgoStr(days);
  const candidates = activityLog.filter((e) => e.date <= target);
  if (!candidates.length) return null;
  let best = candidates[0];
  for (const e of candidates) {
    if (e.date > best.date) best = e;
  }
  return best.masteryScore;
}

// Середній час відповіді по УСІХ фактах разом (на відміну від
// mastery.js:averageResponseTime, яка рахує для ОДНОГО факту) — глобальна
// цифра для батьківського огляду.
export function overallAverageResponseTime(facts) {
  let totalMs = 0;
  let totalCount = 0;
  for (const stat of Object.values(facts ?? {})) {
    totalMs += stat?.totalResponseTimeMs ?? 0;
    totalCount += stat?.answeredCount ?? 0;
  }
  return totalCount ? totalMs / totalCount : null;
}
