import { rand, shuffle } from "./random.js";

// Прості приклади на множення для режимів тренування "Лабіринт" і
// "Перегони" — без прив'язки до регіону/рівня карти.
//
// mix керує лише ФОРМОЮ завдання, не темою: тема завжди лишається в межах
// таблиці множення 2-9, яку дитина вже проходить в основній грі.
//  - "easy"   (тренувальний заїзд): вужчий діапазон множників (2-7) —
//    простіші приклади в межах тієї самої теми.
//  - "normal" (пригодницький заїзд, і Лабіринт за замовчуванням): звичний
//    діапазон 2-9, як і раніше.
//  - "hard"   (чемпіонський заїзд): той самий діапазон 2-9, але частина
//    прикладів переформульована як пошук множника чи частки
//    ("6 × ? = 42", "42 ÷ 6 = ?") — складніша ФОРМА тієї самої таблиці,
//    а не нова, ще не вивчена тема.
const MIX_RANGE = { easy: [2, 7], normal: [2, 9], hard: [2, 9] };
const HARD_ALT_FORM_CHANCE = 0.4;

function smallDistractors(correctValue) {
  const set = new Set([correctValue]);
  while (set.size < 4) {
    const delta = [1, -1, 2, -2][Math.floor(Math.random() * 4)];
    const wrong = correctValue + delta;
    if (wrong > 0 && wrong !== correctValue) set.add(wrong);
  }
  return set;
}

export function generatePracticeQuestion(lastPair, mix = "normal") {
  const [lo, hi] = MIX_RANGE[mix] ?? MIX_RANGE.normal;
  let a, b, pair;
  do {
    a = rand(lo, hi);
    b = rand(lo, hi);
    pair = `${a}x${b}`;
  } while (pair === lastPair);

  const correct = a * b;

  if (mix === "hard" && Math.random() < HARD_ALT_FORM_CHANCE) {
    if (Math.random() < 0.5) {
      // a × ? = correct — шукаємо другий множник
      return { pair, prompt: `${a} × ? = ${correct}`, correct: b, options: shuffle([...smallDistractors(b)]) };
    }
    // correct ÷ a = ? — та сама трійка чисел, у формі ділення
    return { pair, prompt: `${correct} ÷ ${a} = ?`, correct: b, options: shuffle([...smallDistractors(b)]) };
  }

  const options = new Set([correct]);
  while (options.size < 4) {
    const delta = [1, -1, 2, -2, a, -a, b, -b][Math.floor(Math.random() * 8)];
    const wrong = correct + delta;
    if (wrong > 0 && wrong !== correct) options.add(wrong);
  }
  return { pair, prompt: `${a} × ${b} = ?`, correct, options: shuffle([...options]) };
}
