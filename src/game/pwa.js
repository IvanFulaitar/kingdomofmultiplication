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
