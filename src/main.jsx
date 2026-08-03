import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
// Ініціалізує i18next один раз, до першого рендера — сам модуль не
// експортує нічого, що тут використовується напряму (компоненти
// підключаються через useTranslation()), достатньо факту імпорту.
import "./i18n/index.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
