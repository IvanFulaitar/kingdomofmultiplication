// Спільні функції форматування для розділу "Мої знання" (MyKnowledgeScreen.jsx,
// WeakPracticeScreen.jsx) — навмисно винесені в один файл, щоб відсотки й час
// ГАРАНТОВАНО виглядали однаково на всіх трьох екранах (огляд, деталі,
// результат тренування). Без цього легко випадково розійтись у форматуванні
// (наприклад, десяткова крапка в одному місці й кома в іншому).
//
// Плоский JS-модуль (не React-компонент) — як і generateQuestion.js/
// explainFact.js, перекладаємо через i18n-синглтон напряму.
import i18n from "../i18n/index.js";

// Відсоток — завжди ціле число (computeMastery()/tableMastery()/overallMastery()
// уже повертають Math.round'нуте значення), без десяткових знаків. Символ
// "%" універсальний, окремого перекладу не потребує.
export function formatPercent(score) {
  return `${Math.round(score)}%`;
}

// Середній час відповіді — Intl.NumberFormat сам підбирає правильний
// десятковий роздільник для поточної мови (кома для uk/pl, крапка для en),
// замість руками зашитого .replace(".", ",").
export function formatSeconds(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  const seconds = ms / 1000;
  const value = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(seconds);
  return i18n.t("knowledge:secondsShort", { value });
}

// i18next сам обирає правильну форму множини (_one/_few/_many/_other) за
// CLDR-правилами поточної мови з {{count}} — заміняє ручну attemptsWord().
export function formatAttempts(n) {
  return i18n.t("knowledge:attempts", { count: n });
}

// Коли востаннє відповідали на цей факт — коротко й по-дитячому просто.
// "хв"/"год"/"дн" (і їхні en/pl відповідники) — незмінні скорочення, не
// потребують форм множини, тому окремого _one/_few тут нема.
export function formatLastAnswered(ts) {
  if (!ts) return i18n.t("knowledge:lastAnsweredNever");
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return i18n.t("knowledge:lastAnsweredJustNow");
  if (diffMin < 60) return i18n.t("knowledge:lastAnsweredMinutesAgo", { count: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return diffH < 6
      ? i18n.t("knowledge:lastAnsweredToday")
      : i18n.t("knowledge:lastAnsweredHoursAgo", { count: diffH });
  }
  return i18n.t("knowledge:lastAnsweredDaysAgo", { count: Math.floor(diffH / 24) });
}
