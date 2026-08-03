import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Локалізація — launch-plan.md/локалізаційний бриф: uk (основна й fallback)
// + en + pl для першого релізу. Архітектура за функціональними областями
// (namespace на екран/фічу, не один величезний файл), щоб додавання нової
// мови пізніше (de/sk/hu/es) означало лише новий набір JSON, без правок
// коду. МІГРОВАНО цього разу: common, menu, auth, validation, errors —
// решта екранів (бій, карта, тренування, "Мої знання", магазин, лабіринт,
// перегони, досягнення, назви регіонів/рівнів/монстрів) ще показують
// вкопаний український текст незалежно від обраної мови й мають
// перекладатися окремими наступними проходами.
import ukCommon from "./locales/uk/common.json";
import ukMenu from "./locales/uk/menu.json";
import ukAuth from "./locales/uk/auth.json";
import ukValidation from "./locales/uk/validation.json";
import ukErrors from "./locales/uk/errors.json";

import enCommon from "./locales/en/common.json";
import enMenu from "./locales/en/menu.json";
import enAuth from "./locales/en/auth.json";
import enValidation from "./locales/en/validation.json";
import enErrors from "./locales/en/errors.json";

import plCommon from "./locales/pl/common.json";
import plMenu from "./locales/pl/menu.json";
import plAuth from "./locales/pl/auth.json";
import plValidation from "./locales/pl/validation.json";
import plErrors from "./locales/pl/errors.json";

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
  uk: { common: ukCommon, menu: ukMenu, auth: ukAuth, validation: ukValidation, errors: ukErrors },
  en: { common: enCommon, menu: enMenu, auth: enAuth, validation: enValidation, errors: enErrors },
  pl: { common: plCommon, menu: plMenu, auth: plAuth, validation: plValidation, errors: plErrors },
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
  ns: ["common", "menu", "auth", "validation", "errors"],
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
