// Продуктова аналітика без порушення приватності (launch-plan.md, розділ
// 15) — той самий підхід, що й src/config.js AUTH_ENABLED: одна крапка
// правди (ANALYTICS_ENABLED), яка вимикає ВСЮ систему одразу, а не
// розкидані перевірки по компонентах.
//
// НАВІТЬ КОЛИ УВІМКНЕНО, ЦЕЙ МОДУЛЬ НІКОЛИ НЕ ПОВИНЕН ОТРИМУВАТИ:
//   ім'я дитини, дату народження, точну адресу, контакти (email/телефон),
//   текстові повідомлення, рекламний ідентифікатор.
// Дозволені лише анонімні технічні події з launch-plan.md (app_open,
// level_completed, answer_submitted{skillId, correct, responseTimeBucket,
// mode, levelId} тощо) — жодних вільних текстових полів у payload.
//
// Коли ANALYTICS_ENABLED=false (типовий стан) — trackEvent() є повним
// no-op: нічого не пишеться навіть у localStorage. Коли увімкнено, події
// чергуються локально (з обмеженням розміру) і батчами відправляються на
// ANALYTICS_ENDPOINT; якщо endpoint не задано — черга просто накопичується
// локально й ніколи нікуди не йде (безпечний стан за замовчуванням).

import { ANALYTICS_ENABLED, ANALYTICS_ENDPOINT } from "../config.js";

const QUEUE_KEY = "kingdom-multiplication-analytics-queue-v1";
const MAX_QUEUE_SIZE = 300; // старі події просто випадають, а не ростуть без меж
const FLUSH_INTERVAL_MS = 25000;

let flushTimer = null;
let lifecycleAttached = false;

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(events) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUE_SIZE)));
  } catch {
    // localStorage переповнений/недоступний — просто втрачаємо цю подію,
    // не критично для аналітики
  }
}

// {value: 3200} -> "3-5s"; використовується для answer_submitted, щоб не
// передавати точний час (менш ідентифікує конкретну дитину) і водночас
// лишити корисний сигнал "занадто довго думала/думав".
export function bucketResponseTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  if (ms < 1000) return "<1s";
  if (ms < 3000) return "1-3s";
  if (ms < 5000) return "3-5s";
  if (ms < 10000) return "5-10s";
  return ">10s";
}

// Основний виклик з будь-якого екрана/компонента. payload — плоский об'єкт
// лише з дозволеними технічними полями (без вільного тексту).
export function trackEvent(name, payload = {}) {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const event = { name, payload, ts: Date.now() };
  const queue = readQueue();
  queue.push(event);
  writeQueue(queue);
}

async function flush({ useBeacon = false } = {}) {
  if (!ANALYTICS_ENABLED || !ANALYTICS_ENDPOINT || typeof window === "undefined") return;
  const queue = readQueue();
  if (queue.length === 0) return;

  const body = JSON.stringify({ events: queue });

  if (useBeacon && navigator.sendBeacon) {
    // На beforeunload/pagehide fetch може не встигнути — sendBeacon надійніше
    // доставляє невеликий пакет під час закриття вкладки.
    const ok = navigator.sendBeacon(ANALYTICS_ENDPOINT, new Blob([body], { type: "application/json" }));
    if (ok) writeQueue([]);
    return;
  }

  try {
    const res = await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
    if (res.ok) writeQueue([]);
    // якщо не ok — лишаємо чергу як є, спробуємо ще раз наступного flush()
  } catch {
    // немає мережі/сервер недоступний — подіі лишаються в черзі до наступної спроби
  }
}

function attachLifecycleFlush() {
  if (lifecycleAttached || typeof document === "undefined") return;
  lifecycleAttached = true;

  flushTimer = setInterval(() => { flush(); }, FLUSH_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flush({ useBeacon: true });
  });
  window.addEventListener("pagehide", () => flush({ useBeacon: true }));
}

// Викликати один раз при старті застосунку (App.jsx) — так само як
// initMusic()/preloadCoreSfx(). Якщо ANALYTICS_ENABLED=false, все, що
// відбувається тут — це порожні перевірки прапорця, без побічних ефектів.
export function initAnalytics() {
  if (!ANALYTICS_ENABLED) return;
  attachLifecycleFlush();
  trackEvent("app_open");
}
