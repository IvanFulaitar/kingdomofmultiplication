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
import ukParent from "./locales/uk/parent.json";

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
import enParent from "./locales/en/parent.json";

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
import plParent from "./locales/pl/parent.json";

import deCommon from "./locales/de/common.json";
import deMenu from "./locales/de/menu.json";
import deAuth from "./locales/de/auth.json";
import deValidation from "./locales/de/validation.json";
import deErrors from "./locales/de/errors.json";
import deRegions from "./locales/de/regions.json";
import deAchievements from "./locales/de/achievements.json";
import deQuests from "./locales/de/quests.json";
import deAvatars from "./locales/de/avatars.json";
import deRace from "./locales/de/race.json";
import deBattle from "./locales/de/battle.json";
import deMap from "./locales/de/map.json";
import deTraining from "./locales/de/training.json";
import deResults from "./locales/de/results.json";
import deKnowledge from "./locales/de/knowledge.json";
import deShop from "./locales/de/shop.json";
import deMaze from "./locales/de/maze.json";
import deMemory from "./locales/de/memory.json";
import deOnboarding from "./locales/de/onboarding.json";
import deParent from "./locales/de/parent.json";

import esCommon from "./locales/es/common.json";
import esMenu from "./locales/es/menu.json";
import esAuth from "./locales/es/auth.json";
import esValidation from "./locales/es/validation.json";
import esErrors from "./locales/es/errors.json";
import esRegions from "./locales/es/regions.json";
import esAchievements from "./locales/es/achievements.json";
import esQuests from "./locales/es/quests.json";
import esAvatars from "./locales/es/avatars.json";
import esRace from "./locales/es/race.json";
import esBattle from "./locales/es/battle.json";
import esMap from "./locales/es/map.json";
import esTraining from "./locales/es/training.json";
import esResults from "./locales/es/results.json";
import esKnowledge from "./locales/es/knowledge.json";
import esShop from "./locales/es/shop.json";
import esMaze from "./locales/es/maze.json";
import esMemory from "./locales/es/memory.json";
import esOnboarding from "./locales/es/onboarding.json";
import esParent from "./locales/es/parent.json";

import csCommon from "./locales/cs/common.json";
import csMenu from "./locales/cs/menu.json";
import csAuth from "./locales/cs/auth.json";
import csValidation from "./locales/cs/validation.json";
import csErrors from "./locales/cs/errors.json";
import csRegions from "./locales/cs/regions.json";
import csAchievements from "./locales/cs/achievements.json";
import csQuests from "./locales/cs/quests.json";
import csAvatars from "./locales/cs/avatars.json";
import csRace from "./locales/cs/race.json";
import csBattle from "./locales/cs/battle.json";
import csMap from "./locales/cs/map.json";
import csTraining from "./locales/cs/training.json";
import csResults from "./locales/cs/results.json";
import csKnowledge from "./locales/cs/knowledge.json";
import csShop from "./locales/cs/shop.json";
import csMaze from "./locales/cs/maze.json";
import csMemory from "./locales/cs/memory.json";
import csOnboarding from "./locales/cs/onboarding.json";
import csParent from "./locales/cs/parent.json";

import skCommon from "./locales/sk/common.json";
import skMenu from "./locales/sk/menu.json";
import skAuth from "./locales/sk/auth.json";
import skValidation from "./locales/sk/validation.json";
import skErrors from "./locales/sk/errors.json";
import skRegions from "./locales/sk/regions.json";
import skAchievements from "./locales/sk/achievements.json";
import skQuests from "./locales/sk/quests.json";
import skAvatars from "./locales/sk/avatars.json";
import skRace from "./locales/sk/race.json";
import skBattle from "./locales/sk/battle.json";
import skMap from "./locales/sk/map.json";
import skTraining from "./locales/sk/training.json";
import skResults from "./locales/sk/results.json";
import skKnowledge from "./locales/sk/knowledge.json";
import skShop from "./locales/sk/shop.json";
import skMaze from "./locales/sk/maze.json";
import skMemory from "./locales/sk/memory.json";
import skOnboarding from "./locales/sk/onboarding.json";
import skParent from "./locales/sk/parent.json";

import huCommon from "./locales/hu/common.json";
import huMenu from "./locales/hu/menu.json";
import huAuth from "./locales/hu/auth.json";
import huValidation from "./locales/hu/validation.json";
import huErrors from "./locales/hu/errors.json";
import huRegions from "./locales/hu/regions.json";
import huAchievements from "./locales/hu/achievements.json";
import huQuests from "./locales/hu/quests.json";
import huAvatars from "./locales/hu/avatars.json";
import huRace from "./locales/hu/race.json";
import huBattle from "./locales/hu/battle.json";
import huMap from "./locales/hu/map.json";
import huTraining from "./locales/hu/training.json";
import huResults from "./locales/hu/results.json";
import huKnowledge from "./locales/hu/knowledge.json";
import huShop from "./locales/hu/shop.json";
import huMaze from "./locales/hu/maze.json";
import huMemory from "./locales/hu/memory.json";
import huOnboarding from "./locales/hu/onboarding.json";
import huParent from "./locales/hu/parent.json";

// Порядок тут = порядок у перемикачі мови (MenuScreen/LanguagePickerModal).
// code — ISO 639-1 (українська навмисно "uk", а НЕ технічний "ua").
export const SUPPORTED_LANGUAGES = [
  { code: "uk", nativeName: "Українська" },
  { code: "en", nativeName: "English" },
  { code: "pl", nativeName: "Polski" },
  { code: "de", nativeName: "Deutsch" },
  { code: "es", nativeName: "Español" },
  { code: "cs", nativeName: "Čeština" },
  { code: "sk", nativeName: "Slovenčina" },
  { code: "hu", nativeName: "Magyar" },
];
const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
export const FALLBACK_LANGUAGE = "uk";

export const LANGUAGE_STORAGE_KEY = "kingdom_language";

const resources = {
  uk: {
    common: ukCommon, menu: ukMenu, auth: ukAuth, validation: ukValidation, errors: ukErrors,
    regions: ukRegions, achievements: ukAchievements, quests: ukQuests, avatars: ukAvatars,
    race: ukRace, battle: ukBattle, map: ukMap, training: ukTraining, results: ukResults,
    knowledge: ukKnowledge, shop: ukShop, maze: ukMaze, memory: ukMemory, onboarding: ukOnboarding, parent: ukParent,
  },
  en: {
    common: enCommon, menu: enMenu, auth: enAuth, validation: enValidation, errors: enErrors,
    regions: enRegions, achievements: enAchievements, quests: enQuests, avatars: enAvatars,
    race: enRace, battle: enBattle, map: enMap, training: enTraining, results: enResults,
    knowledge: enKnowledge, shop: enShop, maze: enMaze, memory: enMemory, onboarding: enOnboarding, parent: enParent,
  },
  pl: {
    common: plCommon, menu: plMenu, auth: plAuth, validation: plValidation, errors: plErrors,
    regions: plRegions, achievements: plAchievements, quests: plQuests, avatars: plAvatars,
    race: plRace, battle: plBattle, map: plMap, training: plTraining, results: plResults,
    knowledge: plKnowledge, shop: plShop, maze: plMaze, memory: plMemory, onboarding: plOnboarding, parent: plParent,
  },
  de: {
    common: deCommon, menu: deMenu, auth: deAuth, validation: deValidation, errors: deErrors,
    regions: deRegions, achievements: deAchievements, quests: deQuests, avatars: deAvatars,
    race: deRace, battle: deBattle, map: deMap, training: deTraining, results: deResults,
    knowledge: deKnowledge, shop: deShop, maze: deMaze, memory: deMemory, onboarding: deOnboarding, parent: deParent,
  },
  es: {
    common: esCommon, menu: esMenu, auth: esAuth, validation: esValidation, errors: esErrors,
    regions: esRegions, achievements: esAchievements, quests: esQuests, avatars: esAvatars,
    race: esRace, battle: esBattle, map: esMap, training: esTraining, results: esResults,
    knowledge: esKnowledge, shop: esShop, maze: esMaze, memory: esMemory, onboarding: esOnboarding, parent: esParent,
  },
  cs: {
    common: csCommon, menu: csMenu, auth: csAuth, validation: csValidation, errors: csErrors,
    regions: csRegions, achievements: csAchievements, quests: csQuests, avatars: csAvatars,
    race: csRace, battle: csBattle, map: csMap, training: csTraining, results: csResults,
    knowledge: csKnowledge, shop: csShop, maze: csMaze, memory: csMemory, onboarding: csOnboarding, parent: csParent,
  },
  sk: {
    common: skCommon, menu: skMenu, auth: skAuth, validation: skValidation, errors: skErrors,
    regions: skRegions, achievements: skAchievements, quests: skQuests, avatars: skAvatars,
    race: skRace, battle: skBattle, map: skMap, training: skTraining, results: skResults,
    knowledge: skKnowledge, shop: skShop, maze: skMaze, memory: skMemory, onboarding: skOnboarding, parent: skParent,
  },
  hu: {
    common: huCommon, menu: huMenu, auth: huAuth, validation: huValidation, errors: huErrors,
    regions: huRegions, achievements: huAchievements, quests: huQuests, avatars: huAvatars,
    race: huRace, battle: huBattle, map: huMap, training: huTraining, results: huResults,
    knowledge: huKnowledge, shop: huShop, maze: huMaze, memory: huMemory, onboarding: huOnboarding, parent: huParent,
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
    "knowledge", "shop", "maze", "memory", "onboarding", "parent",
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
