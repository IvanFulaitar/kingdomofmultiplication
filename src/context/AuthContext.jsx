// roles-and-architecture-plan.md, розділ 40, крок 3 — виносить те, що
// раніше жило прямо в App.jsx (user/sessionChecked-стан + useEffect із
// fetchMe()) в окремий контекст. Поведінка НЕ змінюється — та сама
// логіка (сесія відновлюється лише коли AUTH_ENABLED, sessionChecked
// одразу true інакше, useEffect відміняється при розмонтуванні), просто
// інша "труба": будь-який компонент під <AuthProvider> тепер може
// читати user через useAuth() замість того, щоб App.jsx проштовхував
// його пропсом крізь усе дерево вручну.
import { createContext, useContext, useEffect, useState } from "react";
import { fetchMe, logout as authLogout } from "../game/auth.js";
import { AUTH_ENABLED } from "../config.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Акаунт (email/пароль) — необов'язкова фіча: null означає гостя, гра
  // й далі повністю грається без входу.
  const [user, setUser] = useState(null);
  // Поки AUTH_ENABLED=false — жодного мережевого виклику взагалі не
  // відбувається, sessionChecked одразу true, тож гість, що не
  // користується акаунтом, нічого не помічає (нуль затримки).
  const [sessionChecked, setSessionChecked] = useState(!AUTH_ENABLED);

  // Відновлення сесії при старті — якщо refresh-cookie з минулого разу
  // ще дійсна, гравець одразу залогінений без повторного вводу пароля
  // (fetchMe() сама отримує новий access-токен через POST /refresh,
  // src/game/auth.js); якщо cookie нема/прострочена/відкликана —
  // fetchMe() тихо повертає null. Мережева помилка (сервер тимчасово
  // недоступний тощо) — не трактується як "сесії нема", просто цього
  // разу лишаємось гостем поточного сеансу.
  useEffect(() => {
    if (!AUTH_ENABLED) return;
    let cancelled = false;
    fetchMe()
      .then((u) => { if (!cancelled) setUser(u); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSessionChecked(true); });
    return () => { cancelled = true; };
  }, []);

  // Реальний вихід — server-side ревокація сесії (POST /api/auth/logout,
  // src/game/auth.js) + локальне скидання user. Локальний стан
  // скидається одразу (гра не чекає на мережу, щоб показати гостьовий
  // стан) — той самий підхід, що вже був у попередній версії App.jsx.
  function logout() {
    setUser(null);
    authLogout();
  }

  const value = { user, setUser, sessionChecked, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() можна викликати лише всередині <AuthProvider> (див. main.jsx)");
  }
  return ctx;
}
