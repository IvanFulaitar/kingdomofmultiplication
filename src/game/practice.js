import { rand, shuffle } from "./random.js";

// Прості приклади на множення (2–9) для режимів тренування "Лабіринт"
// і "Перегони" — без прив'язки до регіону/рівня карти.
export function generatePracticeQuestion(lastPair) {
  let a, b, pair;
  do {
    a = rand(2, 9);
    b = rand(2, 9);
    pair = `${a}x${b}`;
  } while (pair === lastPair);

  const correct = a * b;
  const options = new Set([correct]);
  while (options.size < 4) {
    const delta = [1, -1, 2, -2, a, -a, b, -b][Math.floor(Math.random() * 8)];
    const wrong = correct + delta;
    if (wrong > 0 && wrong !== correct) options.add(wrong);
  }
  return { pair, prompt: `${a} × ${b} = ?`, correct, options: shuffle([...options]) };
}
