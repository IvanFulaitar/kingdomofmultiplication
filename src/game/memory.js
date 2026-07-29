import { rand, shuffle } from "./random.js";

export function generateMemoryPairs(count) {
  const used = new Set();
  const pairs = [];
  let attempts = 0;
  while (pairs.length < count && attempts < 300) {
    attempts++;
    const a = rand(2, 9);
    const b = rand(2, 9);
    const product = a * b;
    if (used.has(product)) continue;
    used.add(product);
    pairs.push({ a, b, product });
  }
  return pairs;
}

export function buildMemoryCards() {
  const pairs = generateMemoryPairs(6);
  const cards = [];
  pairs.forEach((p, i) => {
    cards.push({ id: `e${i}`, matchId: i, label: `${p.a} × ${p.b}`, kind: "expr" });
    cards.push({ id: `n${i}`, matchId: i, label: String(p.product), kind: "num" });
  });
  return shuffle(cards);
}
