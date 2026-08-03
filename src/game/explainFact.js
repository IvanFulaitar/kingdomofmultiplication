// launch-plan.md, розділ 6 "Додати пояснення після помилки": відповідь
// "правильно/неправильно" без пояснення — найбільша навчальна прогалина.
// Ця функція генерує короткий текстовий розклад для факту множення 2–9,
// тим самим способом, що наведений у прикладі плану: розкладання більшого
// множника на "5 + залишок" (7 × 8 = 7 × 5 + 7 × 3 = 35 + 21 = 56).
//
// Навмисно НЕ реалізує повний трьохкроковий ланцюжок із плану (повторна
// спроба -> легка підказка -> пояснення при другій помилці) — це вимагало
// б переробити основний бойовий цикл (life-loss/просування далі), який
// уже збалансований і активно використовується. Це свідомо простіший,
// адитивний перший крок: коротке пояснення показується одразу після
// будь-якої помилки, без зміни решти механіки бою.

// Плоский JS-модуль (не React-компонент) — так само, як generateQuestion.js,
// перекладаємо через i18n-синглтон напряму, не useTranslation().
import i18n from "../i18n/index.js";

// Розбирає "AxB" (formatKey із generateQuestion.js) на [a, b]. Повертає
// null для будь-якого іншого формату (наприклад, "combined"-приклади типу
// "7x8+3" чи "trap-7x8+3") — для них пояснення поки не показуємо.
export function parseFactPair(pair) {
  const m = /^(\d+)x(\d+)$/.exec(pair ?? "");
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

export function explainFact(a, b) {
  const correct = a * b;
  const big = Math.max(a, b);
  const small = Math.min(a, b);

  if (big <= 5) {
    const groups = Array(a).fill(b).join(" + ");
    return i18n.t("battle:explainSmallGroups", { a, b, groups, correct });
  }

  const rest = big - 5;
  const part1 = small * 5;
  const part2 = small * rest;
  return `${a} × ${b} = ${small} × 5 + ${small} × ${rest} = ${part1} + ${part2} = ${correct}.`;
}

// Зручна обгортка для виклику прямо з pair — повертає null, якщо це не
// звичайний факт множення (наприклад, складений приклад рівнів 10-12).
export function explainFromPair(pair) {
  const parsed = parseFactPair(pair);
  if (!parsed) return null;
  return explainFact(parsed[0], parsed[1]);
}
