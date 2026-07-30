import { rand, shuffle } from "./random.js";

// Банк типів завдань для "Лабіринту" — кілька форматів замість одного
// й того ж прикладу на кожному кроці.
export const ALL_KINDS = ["classic", "missing", "compare", "chain", "find_error", "word"];

const WORD_TEMPLATES = [
  (a, b) => `У ${a} скринях лежить по ${b} монет. Скільки монет усього?`,
  (a, b) => `Чарівник розклав яблука в ${a} кошики по ${b} штук. Скільки яблук усього?`,
  (a, b) => `На ${a} полицях стоїть по ${b} книг заклинань. Скільки книг усього?`,
  (a, b) => `У замку ${a} вежі, і на кожній по ${b} прапорів. Скільки прапорів усього?`,
];

function numOptions(correct, spread, count) {
  const options = new Set([correct]);
  let guard = 0;
  while (options.size < count && guard++ < 40) {
    const delta = rand(1, spread) * (Math.random() < 0.5 ? 1 : -1);
    const wrong = correct + delta;
    if (wrong > 0 && wrong !== correct) options.add(wrong);
  }
  return shuffle([...options]);
}

export function generateMazeQuestion(kind, lastPair, optionCount = 4) {
  const count = Math.max(2, Math.min(4, optionCount));
  switch (kind) {
    case "missing": return buildMissing(lastPair, count);
    case "compare": return buildCompare(lastPair);
    case "chain": return buildChain(lastPair, count);
    case "find_error": return buildFindError(lastPair);
    case "word": return buildWord(lastPair, count);
    default: return buildClassic(lastPair, count);
  }
}

function buildClassic(lastPair, count) {
  let a, b, pair;
  do { a = rand(2, 9); b = rand(2, 9); pair = `c${a}x${b}`; } while (pair === lastPair);
  const correct = a * b;
  return { pair, kind: "classic", prompt: `${a} × ${b} = ?`, correct, options: numOptions(correct, 8, count) };
}

function buildMissing(lastPair, count) {
  let a, b, pair;
  do { a = rand(2, 9); b = rand(2, 9); pair = `m${a}x${b}`; } while (pair === lastPair);
  const product = a * b;
  const options = new Set([b]);
  let guard = 0;
  while (options.size < count && guard++ < 40) options.add(Math.max(2, b + rand(-3, 3)));
  return { pair, kind: "missing", prompt: `${a} × ? = ${product}`, correct: b, options: shuffle([...options]) };
}

function buildCompare(lastPair) {
  let a, b, c, d, pair;
  do {
    a = rand(2, 9); b = rand(2, 9); c = rand(2, 9); d = rand(2, 9);
    pair = `k${a}x${b}-${c}x${d}`;
  } while (pair === lastPair || a * b === c * d);
  const left = `${a} × ${b}`, right = `${c} × ${d}`;
  const correct = a * b > c * d ? left : right;
  return { pair, kind: "compare", prompt: `Що більше: ${left} чи ${right}?`, correct, options: shuffle([left, right]), isBinary: true };
}

function buildChain(lastPair, count) {
  let a, b, c, pair;
  do { a = rand(2, 9); b = rand(2, 9); c = rand(2, 12); pair = `h${a}x${b}+${c}`; } while (pair === lastPair);
  const correct = a * b + c;
  return { pair, kind: "chain", prompt: `${a} × ${b} + ${c} = ?`, correct, options: numOptions(correct, 9, count) };
}

function buildFindError(lastPair) {
  let a, b, pair, shown, isTrue;
  do {
    a = rand(2, 9); b = rand(2, 9);
    isTrue = Math.random() < 0.5;
    shown = isTrue ? a * b : a * b + rand(1, 6) * (Math.random() < 0.5 ? 1 : -1);
    pair = `e${a}x${b}=${shown}`;
  } while (pair === lastPair);
  const correct = isTrue ? "Правильно" : "Неправильно";
  return { pair, kind: "find_error", prompt: `${a} × ${b} = ${shown}`, correct, options: shuffle(["Правильно", "Неправильно"]), isBinary: true };
}

function buildWord(lastPair, count) {
  let a, b, tIdx, pair;
  do {
    a = rand(2, 9); b = rand(2, 9); tIdx = rand(0, WORD_TEMPLATES.length - 1);
    pair = `w${a}x${b}-${tIdx}`;
  } while (pair === lastPair);
  const correct = a * b;
  return { pair, kind: "word", prompt: WORD_TEMPLATES[tIdx](a, b), correct, options: numOptions(correct, 8, count) };
}

export function pickKind(kinds, lastKind) {
  const pool = kinds.length > 1 ? kinds.filter((k) => k !== lastKind) : kinds;
  return pool[rand(0, pool.length - 1)];
}
