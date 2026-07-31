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

// Обирає (a, b) для поточного рівня — приблизно половина прикладів у межах
// поточного рівня береться зі "слабких" фактів (де дитина раніше помилялась),
// щоб вони поверталися частіше, але не одразу підряд (lastPair).
function pickFact(levelId, lastPair, weakFacts) {
  const region = REGIONS.find((r) => r.levels.includes(levelId));
  const [lo, hi] = region.range;

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
  return { a, b, pair, region };
}

function buildWrongAnswers(correct, a, b) {
  const options = new Set([correct]);
  while (options.size < 4) {
    const delta = [1, -1, 2, -2, a, -a, b, -b][Math.floor(Math.random() * 8)];
    const wrong = correct + delta;
    if (wrong > 0 && wrong !== correct) options.add(wrong);
  }
  return shuffle([...options]);
}

// launch-plan.md, розділ 7 "Урізноманітнити завдання в сюжетних рівнях":
// рекомендований розподіл — 50% звичайних, 20% пропущений множник,
// 15% порівняння, 15% текстова задача. "Пропущений множник" і далі
// відкривається лише з рівня 7 (як і раніше) — його частку на молодших
// рівнях пропорційно перерозподілено між рештою трьох типів.
//
// Свідомо НЕ реалізовано в цьому заході (з таблиці плану): "правда чи
// помилка", "обернене завдання" (÷), "сортування", "пошук пари", "вибір
// дверей" — останні два вже фактично покриті іншими режимами (Пам'ять,
// Лабіринт), а решта потребують окремого продумування UI/балансу.
function pickQuestionType(levelId) {
  const r = Math.random();
  if (levelId >= 7) {
    if (r < 0.5) return "classic";
    if (r < 0.7) return "missing";
    if (r < 0.85) return "compare";
    return "wordProblem";
  }
  if (r < 0.625) return "classic";
  if (r < 0.8125) return "compare";
  return "wordProblem";
}

const WORD_PROBLEM_TEMPLATES = [
  (a, b) => `У ${a} кошиках лежить по ${b} яблук у кожному. Скільки яблук усього?`,
  (a, b) => `У ${a} коробках по ${b} олівців. Скільки всього олівців?`,
  (a, b) => `На ${a} полицях стоїть по ${b} книжок. Скільки книжок усього?`,
  (a, b) => `${a} гноми зібрали по ${b} грибів кожен. Скільки грибів разом?`,
  (a, b) => `У саду ${a} дерев, і на кожному по ${b} яблук. Скільки яблук усього?`,
  (a, b) => `${a} вози везуть по ${b} мішків борошна. Скільки мішків усього?`,
  (a, b) => `У ${a} клітках сидить по ${b} кроликів. Скільки кроликів усього?`,
  (a, b) => `На ${a} тарілках лежить по ${b} печива. Скільки печива усього?`,
];

function generateClassicQuestion(levelId, lastPair, weakFacts = []) {
  const type = pickQuestionType(levelId);

  if (type === "compare") {
    const first = pickFact(levelId, lastPair, weakFacts);
    let second = pickFact(levelId, first.pair, weakFacts);
    // Уникаємо нічиєї (однаковий добуток) і повного дублювання пари.
    // guard — запобіжник за прикладом бага в "missing" вище: якщо з
    // якоїсь причини (напр. дуже вузький діапазон рівня) різних добутків
    // довго не трапляється, після 30 спроб просто приймаємо те, що є,
    // замість ризику зависання (нічия на екрані — рідкісний, але
    // нешкідливий побічний ефект, набагато краще за завислу вкладку).
    let guard = 0;
    while (guard < 30 && (second.a * second.b === first.a * first.b || second.pair === first.pair)) {
      guard++;
      second = pickFact(levelId, first.pair, weakFacts);
    }
    const left = `${first.a} × ${first.b}`;
    const right = `${second.a} × ${second.b}`;
    const correct = first.a * first.b > second.a * second.b ? left : right;
    return {
      pair: `cmp-${first.pair}_${second.pair}`,
      kind: "compare",
      prompt: "Який вираз має більше значення?",
      correct,
      options: shuffle([left, right]),
    };
  }

  const { a, b, pair } = pickFact(levelId, lastPair, weakFacts);
  const answer = a * b;

  if (type === "missing") {
    // ВАЖЛИВО: попередня версія (зсув -2..+2, затиснутий до мінімуму 2)
    // для b===2 могла дати лише 3 різних кандидати (2,3,4), тоді як цикл
    // вимагав 4 — реальний нескінченний цикл (зависання вкладки) щоразу,
    // як випадав пропущений множник "2". Зсув розширено до -3..+3 (7
    // варіантів — для будь-якого b≥2 після затискання лишається ≥4
    // унікальних), плюс запобіжник guard і послідовний filler — цикл
    // гарантовано завершується за будь-яких обставин.
    const options = new Set([b]);
    let guard = 0;
    while (options.size < 4 && guard < 30) {
      guard++;
      options.add(Math.max(2, b + Math.floor(Math.random() * 7) - 3));
    }
    let filler = b + 3;
    while (options.size < 4) { options.add(filler); filler++; }
    return { pair, kind: "missing", prompt: `${a} × ? = ${answer}`, correct: b, options: shuffle([...options]) };
  }

  if (type === "wordProblem") {
    const template = WORD_PROBLEM_TEMPLATES[Math.floor(Math.random() * WORD_PROBLEM_TEMPLATES.length)];
    return { pair, kind: "wordProblem", prompt: template(a, b), correct: answer, options: buildWrongAnswers(answer, a, b) };
  }

  return { pair, kind: "classic", prompt: `${a} × ${b} = ?`, correct: answer, options: buildWrongAnswers(answer, a, b) };
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
