import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Локалізація — launch-plan.md/локалізаційний бриф: uk (основна й fallback)
// + en + pl для першого релізу. Архітектура за функціональними областями
// (namespace на екран/фічу, не один величезний файл), щоб додавання нової
// мови пізніше (de/sk/hu/es) означало лише новий набір JSON, без правок
// коду. Усі екрани гри (меню, авторизація, бій, карта, тренування, "Мої
// знання", магазин, лабіринт, перегони, перегони-складність, пам'ять,
// onboarding, досягнення, назви регіонів/рівнів/монстрів) повністю
// перемикаються між uk/en/pl.
import ukCommon from "./locales/uk/common.json";
import ukMenu from "./locales/uk/menu.json";
import ukAuth from "./locales/uk/auth.json";
import ukValidation from "./locales/uk/validation.json";
import ukErrors from "./locales/uk/errors.json";
import ukRegions from "./locales/uk/regions.json";
import ukAchievements from "./locales/uk/achievements.json";
import ukQuests from "./locales/uk/quests.json";
import ukAvatars from "./locales/uk/avatars.json";
import ukRace from "./locales/uk/race.json";
import ukBattle from "./locales/uk/battle.json";
import ukMap from "./locales/uk/map.json";
import ukTraining from "./locales/uk/training.json";
import ukResults from "./locales/uk/results.json";
import ukKnowledge from "./locales/uk/knowledge.json";
import ukShop from "./locales/uk/shop.json";
import ukMaze from "./locales/uk/maze.json";
import ukMemory from "./locales/uk/memory.json";
import ukOnboarding from "./locales/uk/onboarding.json";

import enCommon from "./locales/en/common.json";
import enMenu from "./locales/en/menu.json";
import enAuth from "./locales/en/auth.json";
import enValidation from "./locales/en/validation.json";
import enErrors from "./locales/en/errors.json";
import enRegions from "./locales/en/regions.json";
import enAchievements from "./locales/en/achievements.json";
import enQuests from "./locales/en/quests.json";
import enAvatars from "./locales/en/avatars.json";
import enRace from "./locales/en/race.json";
import enBattle from "./locales/en/battle.json";
import enMap from "./locales/en/map.json";
import enTraining from "./locales/en/training.json";
import enResults from "./locales/en/results.json";
import enKnowledge from "./locales/en/knowledge.json";
import enShop from "./locales/en/shop.json";
import enMaze from "./locales/en/maze.json";
import enMemory from "./locales/en/memory.json";
import enOnboarding from "./locales/en/onboarding.json";

import plCommon from "./locales/pl/common.json";
import plMenu from "./locales/pl/menu.json";
import plAuth from "./locales/pl/auth.json";
import plValidation from "./locales/pl/validation.json";
import plErrors from "./locales/pl/errors.json";
import plRegions from "./locales/pl/regions.json";
import plAchievements from "./locales/pl/achievements.json";
import plQuests from "./locales/pl/quests.json";
import plAvatars from "./locales/pl/avatars.json";
import plRace from "./locales/pl/race.json";
import plBattle from "./locales/pl/battle.json";
import plMap from "./locales/pl/map.json";
import plTraining from "./locales/pl/training.json";
import plResults from "./locales/pl/results.json";
import plKnowledge from "./locales/pl/knowledge.json";
import plShop from "./locales/pl/shop.json";
import plMaze from "./locales/pl/maze.json";
import plMemory from "./locales/pl/memory.json";
import plOnboarding from "./locales/pl/onboarding.json";

// Порядок тут = порядок у перемикачі мови (MenuScreen/LanguagePickerModal).
// code — ISO 639-1 (українська навмисно "uk", а НЕ технічний "ua").
export const SUPPORTED_LANGUAGES = [
  { code: "uk", nativeName: "Українська" },
  { code: "en", nativeName: "English" },
  { code: "pl", nativeName: "Polski" },
];
const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
export const FALLBACK_LANGUAGE = "uk";

export const LANGUAGE_STORAGE_KEY = "kingdom_language";

const resources = {
  uk: {
    common: ukCommon, menu: ukMenu, auth: ukAuth, validation: ukValidation, errors: ukErrors,
    regions: ukRegions, achievements: ukAchievements, quests: ukQuests, avatars: ukAvatars,
    race: ukRace, battle: ukBattle, map: ukMap, training: ukTraining, results: ukResults,
    knowledge: ukKnowledge, shop: ukShop, maze: ukMaze, memory: ukMemory, onboarding: ukOnboarding,
  },
  en: {
    common: enCommon, menu: enMenu, auth: enAuth, validation: enValidation, errors: enErrors,
    regions: enRegions, achievements: enAchievements, quests: enQuests, avatars: enAvatars,
    race: enRace, battle: enBattle, map: enMap, training: enTraining, results: enResults,
    knowledge: enKnowledge, shop: enShop, maze: enMaze, memory: enMemory, onboarding: enOnboarding,
  },
  pl: {
    common: plCommon, menu: plMenu, auth: plAuth, validation: plValidation, errors: plErrors,
    regions: plRegions, achievements: plAchievements, quests: plQuests, avatars: plAvatars,
    race: plRace, battle: plBattle, map: plMap, training: plTraining, results: plResults,
    knowledge: plKnowledge, shop: plShop, maze: plMaze, memory: plMemory, onboarding: plOnboarding,
  },
};

// Пріоритет визначення мови при старті (розділ 4 брифу):
// 1. Раніше зроблений ручний вибір (localStorage) — якщо є, нічого більше
//    не перевіряємо.
// 2. Мова профілю авторизованого користувача — поки НЕ реалізовано:
//    бекенд (server/src/schemas/auth.js, prisma User) ще не має поля
//    preferredLanguage, а завести його — окрема задача (розділ 18 брифу).
//    Коли з'явиться, крок додається саме тут, між (1) і (3).
// 3. Підтримувана мова браузера/пристрою.
// 4. uk — fallback.
function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_CODES.includes(saved)) return saved;
  } catch {
    // localStorage недоступний (приватний режим тощо) — просто пропускаємо.
  }
  try {
    const browserLangs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const raw of browserLangs) {
      const code = (raw || "").slice(0, 2).toLowerCase();
      if (SUPPORTED_CODES.includes(code)) return code;
    }
  } catch {
    // navigator недоступний (SSR тощо, тут не актуально, але про всяк).
  }
  return FALLBACK_LANGUAGE;
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: SUPPORTED_CODES,
  ns: [
    "common", "menu", "auth", "validation", "errors",
    "regions", "achievements", "quests", "avatars",
    "race", "battle", "map", "training", "results",
    "knowledge", "shop", "maze", "memory", "onboarding",
  ],
  defaultNS: "common",
  interpolation: { escapeValue: false }, // React сам екранує — подвійне екранування зайве
  returnEmptyString: false,
});

// Єдина точка зміни мови гри (не викликати i18n.changeLanguage напряму
// деінде) — щоб збереження у localStorage завжди відбувалось разом зі
// зміною, і щоб легко додати крок 4 ("відправити на backend, якщо
// авторизований") в одному місці, коли з'явиться профільне поле.
// Повертає проміс i18n.changeLanguage() — виклики, яким потрібно щось
// показати ОДРАЗУ новою мовою (напр. toast "Мову змінено"), мають його
// дочекатись перед тим, як звертатись до t().
export function setLanguage(code) {
  if (!SUPPORTED_CODES.includes(code)) return Promise.resolve();
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // Немає localStorage — вибір діє лише до перезавантаження, не критично.
  }
  return i18n.changeLanguage(code);
}

export default i18n;
