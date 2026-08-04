// Мінімальний Node ESM loader-хук: дозволяє звичайний `import x from
// "./y.json"` (як у src/i18n/index.js, написаному під Vite) без вимоги
// сучасного синтаксису `with { type: "json" }` у самому файлі-джерелі. Vite
// в браузері й так робить це прозоро; тут — той самий ефект для голого
// Node, без переписування production-коду під тестове середовище.
//
// Реєструється через node:module register() у scripts/run-tests.mjs.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const path = fileURLToPath(url);
    const source = readFileSync(path, "utf8");
    return {
      format: "module",
      source: `export default ${source};`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
