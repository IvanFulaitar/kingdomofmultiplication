import { rand, shuffle } from "./random.js";
import i18n from "../i18n/index.js";

// Банк типів завдань для "Лабіринту" — кілька форматів замість одного
// й того ж прикладу на кожному кроці.
export const ALL_KINDS = ["classic", "missing", "compare", "chain", "find_error", "word"];

// Ключі шаблонів word-задач у maze.json (не самі рядки — цей масив
// обходиться при кожному виклику buildWord, тож i18n.t() викликається
// щоразу заново й завжди повертає поточну мову).
const WORD_TEMPLATE_KEYS = ["wordChests", "wordBaskets", "wordShelves", "wordTowers"];

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
  return { pair, kind: "classic", prompt: i18n.t("maze:classicPrompt", { a, b }), correct, options: numOptions(correct, 8, count) };
}

function buildMissing(lastPair, count) {
  let a, b, pair;
  do { a = rand(2, 9); b = rand(2, 9); pair = `m${a}x${b}`; } while (pair === lastPair);
  const product = a * b;
  const options = new Set([b]);
  let guard = 0;
  while (options.size < count && guard++ < 40) options.add(Math.max(2, b + rand(-3, 3)));
  return { pair, kind: "missing", prompt: i18n.t("maze:missingPrompt", { a, product }), correct: b, options: shuffle([...options]) };
}

function buildCompare(lastPair) {
  let a, b, c, d, pair;
  do {
    a = rand(2, 9); b = rand(2, 9); c = rand(2, 9); d = rand(2, 9);
    pair = `k${a}x${b}-${c}x${d}`;
  } while (pair === lastPair || a * b === c * d);
  const left = `${a} × ${b}`, right = `${c} × ${d}`;
  const correct = a * b > c * d ? left : right;
  return { pair, kind: "compare", prompt: i18n.t("maze:comparePrompt", { left, right }), correct, options: shuffle([left, right]), isBinary: true };
}

function buildChain(lastPair, count) {
  let a, b, c, pair;
  do { a = rand(2, 9); b = rand(2, 9); c = rand(2, 12); pair = `h${a}x${b}+${c}`; } while (pair === lastPair);
  const correct = a * b + c;
  return { pair, kind: "chain", prompt: i18n.t("maze:chainPrompt", { a, b, c }), correct, options: numOptions(correct, 9, count) };
}

function buildFindError(lastPair) {
  let a, b, pair, shown, isTrue;
  do {
    a = rand(2, 9); b = rand(2, 9);
    isTrue = Math.random() < 0.5;
    shown = isTrue ? a * b : a * b + rand(1, 6) * (Math.random() < 0.5 ? 1 : -1);
    pair = `e${a}x${b}=${shown}`;
  } while (pair === lastPair);
  const trueLabel = i18n.t("maze:findErrorTrue");
  const falseLabel = i18n.t("maze:findErrorFalse");
  const correct = isTrue ? trueLabel : falseLabel;
  return { pair, kind: "find_error", prompt: `${a} × ${b} = ${shown}`, correct, options: shuffle([trueLabel, falseLabel]), isBinary: true };
}

function buildWord(lastPair, count) {
  let a, b, tIdx, pair;
  do {
    a = rand(2, 9); b = rand(2, 9); tIdx = rand(0, WORD_TEMPLATE_KEYS.length - 1);
    pair = `w${a}x${b}-${tIdx}`;
  } while (pair === lastPair);
  const correct = a * b;
  return { pair, kind: "word", prompt: i18n.t(`maze:${WORD_TEMPLATE_KEYS[tIdx]}`, { a, b }), correct, options: numOptions(correct, 8, count) };
}

export function pickKind(kinds, lastKind) {
  const pool = kinds.length > 1 ? kinds.filter((k) => k !== lastKind) : kinds;
  return pool[rand(0, pool.length - 1)];
}
