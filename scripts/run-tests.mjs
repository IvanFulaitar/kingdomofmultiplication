// Запускає tests/logic.test.mjs.
//
// Чому не просто "node tests/logic.test.mjs": src/i18n/index.js (частина
// залежностей generateQuestion.js) імпортує ~150 JSON-файлів локалей
// звичайним `import x from "./y.json"` — синтаксисом, який працює у Vite
// "з коробки", але голий Node вимагає для JSON-імпортів явний
// `with { type: "json" }` у самому джерельному файлі. Переписувати
// production-код під тестове середовище — гірший варіант, тож замість
// цього реєструємо крихітний loader-хук (scripts/json-loader.mjs), який
// дає той самий ефект, що й у браузері/Vite, без жодних правок вихідного
// коду гри.
//
// npm run test — саме він викликає цей файл (див. package.json).
import { register } from "node:module";

register("./json-loader.mjs", import.meta.url);

await import("../tests/logic.test.mjs");
