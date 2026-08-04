// PWA-логіка: реєстрація service worker (public/service-worker.js),
// виявлення доступного оновлення (worker у стані "waiting") і перехоплення
// подій встановлення (beforeinstallprompt). Окремий модуль без React —
// компоненти підписуються через onUpdateAvailable/onInstallAvailable.
//
// Реєструємо SW лише у production-білді: у dev-режимі Vite сам робить
// HMR/швидкий рефреш, а service worker з кешем лише заважав би (стара
// закешована версія JS перекривала б живі зміни).

let registration = null;
let waitingWorker = null;
const updateListeners = new Set();

let deferredInstallEvent = null;
const installListeners = new Set();

function notifyUpdate(available) {
  updateListeners.forEach((cb) => {
    try { cb(available); } catch { /* слухач не повинен ламати решту */ }
  });
}

function notifyInstall(available) {
  installListeners.forEach((cb) => {
    try { cb(available); } catch { /* слухач не повинен ламати решту */ }
  });
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => {
        registration = reg;

        if (reg.waiting && navigator.serviceWorker.controller) {
          waitingWorker = reg.waiting;
          notifyUpdate(true);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              waitingWorker = installing;
              notifyUpdate(true);
            }
          });
        });
      })
      .catch(() => {
        // офлайн-кешування просто не запрацює цього разу — гра й далі
        // грається як звичайний сайт, це не критична помилка
      });
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

// Підписка на появу оновлення. cb(true) — є що застосувати,
// cb(false) — після applyUpdate() чи якщо оновлення поки нема.
// Повертає функцію відписки.
export function onUpdateAvailable(cb) {
  updateListeners.add(cb);
  if (waitingWorker) cb(true);
  return () => updateListeners.delete(cb);
}

export function applyUpdate() {
  if (!waitingWorker) return;
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
  waitingWorker = null;
  notifyUpdate(false);
}

// ------------------------------------------------------- install prompt ---
export function initInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallEvent = event;
    notifyInstall(true);
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallEvent = null;
    notifyInstall(false);
  });
}

export function onInstallAvailable(cb) {
  installListeners.add(cb);
  if (deferredInstallEvent) cb(true);
  return () => installListeners.delete(cb);
}

export async function promptInstall() {
  if (!deferredInstallEvent) return null;
  const event = deferredInstallEvent;
  deferredInstallEvent = null;
  notifyInstall(false);
  event.prompt();
  try {
    return await event.userChoice;
  } catch {
    return null;
  }
}

// ------------------------------------------------- iOS Safari "ручний" шлях
// iOS (будь-який браузер, бо всі вони на WebKit) НІКОЛИ не надсилає
// beforeinstallprompt — Apple свідомо не дала сайтам змоги самим викликати
// системний діалог встановлення. Єдиний спосіб на iPhone/iPad — це вручну
// відкрити "Поділитися" → "На екран «Домой»", тож замість кнопки, що сама
// щось запускає, там показуємо інструкцію (IosInstallModal.jsx).
export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  try {
    if (window.navigator.standalone === true) return true; // iOS Safari-специфічний прапорець
    return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  } catch {
    return false;
  }
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPadOS 13+ маскується під "MacIntel" у navigator.platform — окрема
  // перевірка на сенсорні точки відрізняє iPad від звичайного Mac.
  const isIPadOS13Plus = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || isIPadOS13Plus;
}

// true, коли варто показати кнопку "Встановити гру" з інструкцією замість
// (чи на додачу до) звичайного beforeinstallprompt-шляху.
export function isIosInstallHintAvailable() {
  return isIosDevice() && !isStandaloneDisplay();
}

// Спокійніша назва, що збігається з тим, як про це думає решта коду (і як
// сформульовано в технічному завданні) — той самий standalone-прапорець.
export { isStandaloneDisplay as isAppInstalled };

// На iOS усі браузери (Chrome, Firefox, Edge, Opera, застосунки-вебвʼю
// Instagram/Facebook тощо) працюють на тому самому WebKit-рушії, що й
// Safari, тому мають ті самі поля navigator і той самий вигляд у UA —
// АЛЕ жоден із них не показує "Поділитися" → "На екран «Домой»" так само,
// як Safari (у декого цього пункту нема взагалі). Тому такі браузери
// отримують окремий сценарій — "спочатку відкрий у Safari" (див.
// OpenInSafariModal.jsx) — а не покрокову інструкцію під Safari.
const NON_SAFARI_IOS_UA_TOKENS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|Mercury|GSA|DuckDuckGo|YaBrowser|SamsungBrowser|Brave|Instagram|FBAN|FBAV|Line\//i;

export function isIosSafariBrowser() {
  if (!isIosDevice()) return false;
  const ua = navigator.userAgent || "";
  return !NON_SAFARI_IOS_UA_TOKENS.test(ua);
}

// ------------------------------------------- ненав'язлива пропозиція (банер)
// Після "Не зараз" ховаємо автоматичну пропозицію (банер після рівня) на
// 7 днів — та сама вимога, що й cloudNotice в MenuScreen.jsx, тільки для
// встановлення. Постійна кнопка в налаштуваннях НЕ підпорядкована цьому
// таймеру — вона керується лише isAppInstalled()/isIosInstallHintAvailable().
const INSTALL_SUGGESTION_DISMISSED_KEY = "kingdom-multiplication-install-suggestion-dismissed-v1";
const INSTALL_SUGGESTION_REMINDER_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export function canShowInstallSuggestion() {
  if (isStandaloneDisplay()) return false;
  // На платформах без жодного встановлюваного шляху (нема ні
  // beforeinstallprompt, ні iOS-інструкції) банер лише б дратував —
  // показуємо його тільки там, де клік реально щось відкриє.
  if (!isIosDevice() && !deferredInstallEvent) return false;
  let dismissedAt = 0;
  try {
    dismissedAt = Number(localStorage.getItem(INSTALL_SUGGESTION_DISMISSED_KEY)) || 0;
  } catch {
    return true; // немає localStorage — просто не пам'ятаємо вибір, не критично
  }
  if (!dismissedAt) return true;
  return Date.now() - dismissedAt >= INSTALL_SUGGESTION_REMINDER_DELAY_MS;
}

export function dismissInstallSuggestion() {
  try {
    localStorage.setItem(INSTALL_SUGGESTION_DISMISSED_KEY, Date.now().toString());
  } catch {
    /* немає localStorage — банер може з'явитись знову цього ж сеансу, не критично */
  }
}
