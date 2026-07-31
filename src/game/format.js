// Спільні функції форматування для розділу "Мої знання" (MyKnowledgeScreen.jsx,
// WeakPracticeScreen.jsx) — навмисно винесені в один файл, щоб відсотки й час
// ГАРАНТОВАНО виглядали однаково на всіх трьох екранах (огляд, деталі,
// результат тренування). Без цього легко випадково розійтись у форматуванні
// (наприклад, десяткова крапка в одному місці й кома в іншому).

// Відсоток — завжди ціле число (computeMastery()/tableMastery()/overallMastery()
// уже повертають Math.round'нуте значення), без десяткових знаків.
export function formatPercent(score) {
  return `${Math.round(score)}%`;
}

// Середній час відповіді — з УКРАЇНСЬКОЮ десятковою комою (не крапкою):
// "1,0 с", а не "1.0 s". null/undefined -> "—" (даних ще нема).
export function formatSeconds(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  return `${(ms / 1000).toFixed(1).replace(".", ",")} с`;
}

// Українська множина: 1 спроба / 2-4 спроби / 5+ спроб (і виключення на
// "11-14", які в українській теж "спроб", а не "спроби").
export function attemptsWord(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "спроба";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "спроби";
  return "спроб";
}

export function formatAttempts(n) {
  return `${n} ${attemptsWord(n)}`;
}

// Коли востаннє відповідали на цей факт — коротко й по-дитячому просто.
export function formatLastAnswered(ts) {
  if (!ts) return "ще не відповідали";
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "щойно";
  if (diffMin < 60) return `${diffMin} хв тому`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH < 6 ? "сьогодні" : `${diffH} год тому`;
  return `${Math.floor(diffH / 24)} дн тому`;
}
