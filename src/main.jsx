import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
// Ініціалізує i18next один раз, до першого рендера — сам модуль не
// експортує нічого, що тут використовується напряму (компоненти
// підключаються через useTranslation()), достатньо факту імпорту.
import "./i18n/index.js";
import "./index.css";
import { registerServiceWorker, initInstallPrompt } from "./game/pwa.js";

// PWA (launch-plan.md, розділ 14): реєстрація SW і перехоплення
// beforeinstallprompt мають статись якнайраніше — до першого рендера,
// щоб UpdateBanner/кнопка "Встановити гру" не пропустили ранню подію.
registerServiceWorker();
initInstallPrompt();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
