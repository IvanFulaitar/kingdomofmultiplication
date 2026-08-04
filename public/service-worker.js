// Service worker "Королівства Математики" — рукописний, без build-плагіна
// (vite-plugin-pwa тощо), бо проєкт свідомо тримає мінімум залежностей.
// Через це ми НЕ знаємо заздалегідь хешовані імена файлів білда
// (dist/assets/index-XXXXX.js) — тому стратегія побудована на runtime-
// кешуванні, а не на precache-манифесті конкретних файлів:
//
//  - navigation (HTML) — "network first": завжди намагаємось узяти свіжий
//    index.html з мережі (там посилання на актуальний хешований JS/CSS),
//    і лише коли мережі немає — віддаємо те, що закешували раніше, або
//    /offline.html, якщо взагалі нічого нема. Це навмисно, щоб користувач
//    НІКОЛИ не застряг назавжди на старій версії JS (вимога launch-plan.md,
//    розділ 14: "Не кешувати старий JS назавжди").
//  - статичні GET-запити (/assets/*, /icons/*, шрифти) — "stale while
//    revalidate": одразу віддаємо закешовану версію (швидко, працює
//    офлайн), і паралельно у фоні оновлюємо кеш свіжою версією з мережі
//    для наступного разу. Підходить і для по-справжньому незмінних
//    хешованих бандлів Vite, і для художніх/аудіо-файлів у public/assets/,
//    які іноді оновлюються під тим самим іменем (напр. головна тема).
//  - усе інше (POST, cross-origin API, dev-сервер) — просто пропускаємо
//    крізь мережу, нічого не кешуємо.

const CACHE_VERSION = "kom-v1";
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const SHELL_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS).catch(() => {
        // якщо якийсь ресурс недоступний під час install — не валимо весь
        // SW через це, кешуємо решту по одному
        return Promise.allSettled(SHELL_URLS.map((u) => cache.add(u)));
      })
    )
    // НЕ викликаємо self.skipWaiting() тут навмисно — нова версія чекає
    // (стан "waiting"), поки користувач сам не підтвердить оновлення через
    // UI (UpdateBanner.jsx шле SKIP_WAITING). Це і є "контрольована
    // стратегія оновлення" з розділу 14.
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("kom-") && key !== RUNTIME_CACHE && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpe?g|webp|svg|gif|mp3|ogg|woff2?|ttf)$/i.test(url.pathname)
  );
}

async function networkFirstNavigation(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put("/", fresh.clone());
    return fresh;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match("/");
    return cached || cache.match("/offline.html");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await networkPromise) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Кросоріджин (шрифти Google Fonts тощо) — теж stale-while-revalidate,
  // щоб гра лишалась читабельною офлайн після першого онлайн-запуску;
  // API-виклики бекенду (інший домен, не GET-статика) сюди не потрапляють.
  if (url.origin !== self.location.origin) {
    if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
