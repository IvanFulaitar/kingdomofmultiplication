import { rand, shuffle } from "./random.js";

// ---------------------------------------------------------------------
// Генератор лабіринту "Лабіринт" — справжній граф клітинок замість
// лінійної стежки. Побудова через рандомізований обхід у глибину (DFS)
// дає "остовне дерево" — а це математично гарантує, що КОЖНА клітинка
// досяжна зі старту. Тобто рівень ніколи не може стати непрохідним.
// ---------------------------------------------------------------------

export const CELL = {
  START: "start",
  CORRIDOR: "corridor",
  KEY: "key",
  COIN: "coin",
  HEART: "heart",
  HINT: "hint",
  TRAP: "trap",
  CHEST: "chest",
  SECRET: "secret",
  PORTAL: "portal",
  TREASURE: "treasure",
  EXIT: "exit",
};

// Три тири складності — нові механіки з'являються поступово, а не всі
// одразу. Перший лабіринт має лише один шлях і жодних пасток.
const TIERS = [
  {
    name: "Перший лабіринт", rows: 3, cols: 3, extraLoop: false, requiresKey: false,
    trap: false, secret: false, portal: false, treasure: false,
    coinCells: 1, heartCells: 1, hintCells: 0, chestCells: 1,
    kinds: ["classic", "missing"], fullyRevealed: true,
  },
  {
    name: "Середній лабіринт", rows: 3, cols: 4, extraLoop: true, requiresKey: true,
    trap: true, secret: false, portal: false, treasure: false,
    coinCells: 1, heartCells: 1, hintCells: 1, chestCells: 1,
    kinds: ["classic", "missing", "compare", "chain"], fullyRevealed: false,
  },
  {
    name: "Складний лабіринт", rows: 4, cols: 4, extraLoop: true, requiresKey: true,
    trap: true, secret: true, portal: true, treasure: true,
    coinCells: 2, heartCells: 1, hintCells: 1, chestCells: 1,
    kinds: ["classic", "missing", "compare", "chain", "find_error", "word"], fullyRevealed: false,
  },
];

// Складність росте з кількістю вже пройдених спроб — щоб перше знайомство
// з режимом було простим, а досвідчений гравець отримував нові виклики.
export function tierForCompletions(n = 0) {
  if (n >= 6) return 2;
  if (n >= 2) return 1;
  return 0;
}

export function tierInfo(tier) {
  return TIERS[Math.min(tier, TIERS.length - 1)];
}

function cellKey(r, c) { return `${r},${c}`; }
function parseKey(k) { return k.split(",").map(Number); }

function edgeKey(r1, c1, r2, c2) {
  const a = cellKey(r1, c1), b = cellKey(r2, c2);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function neighborsOf(r, c, rows, cols) {
  const out = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < rows - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < cols - 1) out.push([r, c + 1]);
  return out;
}

// Ітеративний рандомізований DFS — класичний спосіб генерувати лабіринт,
// що завжди повністю зв'язний (усі клітинки досяжні зі старту).
function carveTree(rows, cols) {
  const start = [0, 0];
  const visited = new Set([cellKey(...start)]);
  const edges = new Set();
  const parent = new Map();
  const stack = [start];

  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const options = shuffle(neighborsOf(r, c, rows, cols)).filter(([nr, nc]) => !visited.has(cellKey(nr, nc)));
    if (!options.length) { stack.pop(); continue; }
    const [nr, nc] = options[0];
    visited.add(cellKey(nr, nc));
    parent.set(cellKey(nr, nc), cellKey(r, c));
    edges.add(edgeKey(r, c, nr, nc));
    stack.push([nr, nc]);
  }
  return { visited, edges, parent, startKey: cellKey(...start) };
}

function bfsDistances(startKey, edges, rows, cols) {
  const dist = new Map([[startKey, 0]]);
  const queue = [startKey];
  let farthest = startKey;
  while (queue.length) {
    const cur = queue.shift();
    const [r, c] = parseKey(cur);
    for (const [nr, nc] of neighborsOf(r, c, rows, cols)) {
      const nk = cellKey(nr, nc);
      if (edges.has(edgeKey(r, c, nr, nc)) && !dist.has(nk)) {
        dist.set(nk, dist.get(cur) + 1);
        queue.push(nk);
        if (dist.get(nk) > dist.get(farthest)) farthest = nk;
      }
    }
  }
  return { dist, farthest };
}

function walkToMainPath(k, parent, mainPathIndex) {
  let cur = k;
  while (cur !== undefined && !mainPathIndex.has(cur)) cur = parent.get(cur);
  return cur === undefined ? 0 : mainPathIndex.get(cur);
}

export function generateMaze(tier = 0) {
  const cfg = tierInfo(tier);
  const { rows, cols } = cfg;
  const { visited, edges, parent, startKey } = carveTree(rows, cols);
  const { dist, farthest: exitKey } = bfsDistances(startKey, edges, rows, cols);

  // Головний шлях — єдиний шлях у дереві від старту до виходу (безпечний
  // маршрут, який завжди існує й завжди веде до перемоги).
  const mainPath = [];
  for (let cur = exitKey; cur !== undefined; cur = parent.get(cur)) {
    mainPath.unshift(cur);
    if (cur === startKey) break;
  }
  const mainPathIndex = new Map(mainPath.map((k, i) => [k, i]));
  const branchKeys = [...visited].filter((k) => !mainPathIndex.has(k));

  // Ключ завжди сидить десь на середині головного шляху — рахуємо його
  // індекс ЗАРАНІШЕ (до пошуку короткого шляху), щоб коротка "ризикована"
  // стежка ніколи не виводила гравця на головний шлях ПІСЛЯ ключа — інакше
  // можна було б дістатись фінальних дверей, оминувши ключ повністю.
  const keyMainIdx = cfg.requiresKey && mainPath.length > 2
    ? Math.max(1, Math.min(mainPath.length - 2, Math.floor(mainPath.length / 2)))
    : null;

  // "Ризикований" коридор: з'єднує кінчик бічної гілки з клітинкою
  // головного шляху далі за течією — альтернативний маршрут до виходу.
  let shortcut = null;
  if (cfg.extraLoop) {
    search:
    for (const bk of shuffle(branchKeys)) {
      const [br, bc] = parseKey(bk);
      for (const [nr, nc] of shuffle(neighborsOf(br, bc, rows, cols))) {
        const nk = cellKey(nr, nc);
        const withinKeyLimit = keyMainIdx === null || mainPathIndex.get(nk) <= keyMainIdx;
        if (mainPathIndex.has(nk) && !edges.has(edgeKey(br, bc, nr, nc)) && dist.get(nk) > dist.get(bk) && withinKeyLimit) {
          edges.add(edgeKey(br, bc, nr, nc));
          shortcut = { branch: bk, main: nk };
          break search;
        }
      }
    }
  }

  // --- Розподіл вмісту клітинок ---
  const types = new Map();
  types.set(startKey, CELL.START);
  types.set(exitKey, CELL.EXIT);

  const pool = shuffle(branchKeys.filter((k) => k !== startKey && k !== exitKey));
  const take = () => pool.shift();

  const keyCellKey = keyMainIdx !== null ? mainPath[keyMainIdx] : null;
  if (keyCellKey) types.set(keyCellKey, CELL.KEY);

  let trapCellKey = null;
  if (cfg.trap) {
    trapCellKey = take();
    if (trapCellKey) types.set(trapCellKey, CELL.TRAP);
  }

  let secretCellKey = null;
  if (cfg.secret) {
    secretCellKey = take();
    if (secretCellKey) types.set(secretCellKey, CELL.SECRET);
  }

  let portalCellKey = null;
  let portalTarget = null;
  if (cfg.portal) {
    portalCellKey = take();
    if (portalCellKey) {
      types.set(portalCellKey, CELL.PORTAL);
      const anchor = walkToMainPath(portalCellKey, parent, mainPathIndex);
      let targetIdx = Math.min(anchor + 3, mainPath.length - 2);
      if (keyCellKey) targetIdx = Math.min(targetIdx, mainPathIndex.get(keyCellKey));
      targetIdx = Math.max(targetIdx, anchor);
      portalTarget = mainPath[targetIdx];
    }
  }

  let treasureCellKey = null;
  if (cfg.treasure) {
    treasureCellKey = take();
    if (treasureCellKey) types.set(treasureCellKey, CELL.TREASURE);
  }

  for (let i = 0; i < cfg.chestCells; i++) { const k = take(); if (k) types.set(k, CELL.CHEST); }
  for (let i = 0; i < cfg.coinCells; i++) { const k = take(); if (k) types.set(k, CELL.COIN); }
  for (let i = 0; i < cfg.heartCells; i++) { const k = take(); if (k) types.set(k, CELL.HEART); }
  for (let i = 0; i < cfg.hintCells; i++) { const k = take(); if (k) types.set(k, CELL.HINT); }

  const cells = {};
  for (const k of visited) {
    const [r, c] = parseKey(k);
    cells[k] = { key: k, row: r, col: c, type: types.get(k) ?? CELL.CORRIDOR };
  }

  return {
    tier, tierName: cfg.name, rows, cols, cells, edges, parent, mainPathIndex,
    startKey, exitKey, mainPath, mainPathLength: mainPath.length - 1,
    requiresKey: !!keyCellKey, keyCellKey, trapCellKey, secretCellKey,
    portalCellKey, portalTarget, treasureCellKey, shortcut,
    kinds: cfg.kinds, fullyRevealed: cfg.fullyRevealed,
  };
}

// Сусідні клітинки, з якими справді є коридор (а не просто сусідні по гріду).
export function cellNeighbors(maze, k) {
  const [r, c] = parseKey(k);
  return neighborsOf(r, c, maze.rows, maze.cols)
    .map(([nr, nc]) => cellKey(nr, nc))
    .filter((nk) => { const [nr, nc] = parseKey(nk); return maze.edges.has(edgeKey(r, c, nr, nc)); });
}

// Індекс найближчого предка на головному шляху — потрібен для діамантової
// стежки прогресу, коли герой заходить у бічну гілку.
export function mainPathAnchorIndex(maze, k) {
  return walkToMainPath(k, maze.parent, maze.mainPathIndex);
}
