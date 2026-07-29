import { REGIONS } from "../data/regions.js";
import { rand, shuffle } from "./random.js";

export const QUESTIONS_PER_LEVEL = 8;
export const TIME_PER_QUESTION = 9;

export function timeForLevel(levelId) {
  return levelId >= 10 ? 15 : TIME_PER_QUESTION;
}

export function factKey(a, b) {
  return `${a}x${b}`;
}

// "Слабкий" факт: дитина помиляється в ньому щонайменше так само часто, як вгадує.
export function getWeakFacts(facts) {
  if (!facts) return [];
  return Object.entries(facts)
    .filter(([, s]) => s.wrong > 0 && s.wrong >= s.correct)
    .map(([key]) => key);
}

export function generateQuestion(levelId, lastPair, weakFacts) {
  if (levelId >= 10) return generateCombinedQuestion(levelId, lastPair);
  return generateClassicQuestion(levelId, lastPair, weakFacts);
}

function generateClassicQuestion(levelId, lastPair, weakFacts = []) {
  const region = REGIONS.find((r) => r.levels.includes(levelId));
  const [lo, hi] = region.range;

  // Приблизно половина прикладів у межах поточного рівня — ті, де дитина
  // раніше помилялася, щоб вони поверталися частіше, але не поспіль.
  const weakInRange = weakFacts
    .map((k) => k.split("x").map(Number))
    .filter(([wa]) => wa >= lo && wa <= hi);

  let a, b, pair;
  if (weakInRange.length && Math.random() < 0.5) {
    const pick = weakInRange.find((p) => factKey(...p) !== lastPair) ?? weakInRange[0];
    [a, b] = pick;
    pair = factKey(a, b);
  } else {
    do {
      a = Math.floor(Math.random() * (hi - lo + 1)) + lo;
      b = Math.floor(Math.random() * 9) + 2;
      pair = factKey(a, b);
    } while (pair === lastPair);
  }

  const answer = a * b;
  const isMissingNumber = levelId >= 7 && Math.random() < 0.4;

  if (isMissingNumber) {
    const options = new Set([b]);
    while (options.size < 4) options.add(Math.max(2, b + Math.floor(Math.random() * 5) - 2));
    return { pair, kind: "missing", prompt: `${a} × ? = ${answer}`, correct: b, options: shuffle([...options]) };
  }

  const options = new Set([answer]);
  while (options.size < 4) {
    const delta = [1, -1, 2, -2, a, -a, b, -b][Math.floor(Math.random() * 8)];
    const wrong = answer + delta;
    if (wrong > 0 && wrong !== answer) options.add(wrong);
  }
  return { pair, kind: "classic", prompt: `${a} × ${b} = ?`, correct: answer, options: shuffle([...options]) };
}

// Рівні 10-12: комбіновані вирази з кількома діями (×, +, −).
// Множення в тексті завжди подається так, щоб дитина природно вчилася,
// що × виконується першим — а рівень 12 явно перевіряє це правилом-пасткою.
function generateCombinedQuestion(levelId, lastPair) {
  let q;
  do { q = buildCombined(levelId); } while (q.pair === lastPair);
  return q;
}

function buildCombined(levelId) {
  const a = rand(2, 9);
  const b = rand(2, 9);
  const product = a * b;

  if (levelId === 10) {
    const c = rand(2, 20);
    if (Math.random() < 0.6) {
      const correct = product + c;
      return { pair: `${a}x${b}+${c}`, kind: "combined", prompt: `${a} × ${b} + ${c} = ?`, correct, options: buildOptions(correct) };
    }
    const c2 = rand(1, product - 1);
    const correct = product - c2;
    return { pair: `${a}x${b}-${c2}`, kind: "combined", prompt: `${a} × ${b} − ${c2} = ?`, correct, options: buildOptions(correct) };
  }

  if (levelId === 11) {
    if (Math.random() < 0.5) {
      const c = rand(2, 20);
      const correct = c + product;
      return { pair: `${c}+${a}x${b}`, kind: "combined", prompt: `${c} + ${a} × ${b} = ?`, correct, options: buildOptions(correct) };
    }
    const c = rand(2, 15);
    const d = rand(1, product + c - 1);
    const correct = product + c - d;
    return { pair: `${a}x${b}+${c}-${d}`, kind: "combined", prompt: `${a} × ${b} + ${c} − ${d} = ?`, correct, options: buildOptions(correct) };
  }

  // Рівень 12 — Пастка мудреця: серед варіантів навмисно є "наївна" відповідь,
  // яку отримають, якщо порахувати зліва направо без урахування пріоритету ×.
  const c = rand(2, 20);
  const correct = c + product;
  const naive = (c + a) * b;
  const options = new Set([correct]);
  if (naive !== correct) options.add(naive);
  while (options.size < 4) {
    const wrong = correct + rand(1, 6) * (Math.random() < 0.5 ? 1 : -1);
    if (wrong > 0 && !options.has(wrong)) options.add(wrong);
  }
  return { pair: `trap-${a}x${b}+${c}`, kind: "combined", prompt: `${c} + ${a} × ${b} = ?`, correct, options: shuffle([...options]) };
}

function buildOptions(correct) {
  const options = new Set([correct]);
  while (options.size < 4) {
    const wrong = correct + rand(1, 8) * (Math.random() < 0.5 ? 1 : -1);
    if (wrong > 0 && wrong !== correct) options.add(wrong);
  }
  return shuffle([...options]);
}
