import { Component } from "react";
import { withTranslation } from "react-i18next";
import { trackEvent } from "../game/analytics.js";

// Глобальний запобіжник рендера (launch-plan.md, розділ 16 "Стабільність і
// обробка помилок"). Без цього будь-який неспійманий виняток у дереві
// React-компонентів лишає порожній білий екран — дитина не зрозуміє, що
// сталося, і не знатиме, що робити. Прогрес тут ніяк не втрачається: він
// зберігається в localStorage при кожній зміні (saveProgress() у
// src/game/progress.js), задовго до того, як щось могло зламатись у
// рендері — крах верстки не переписує вже збережені дані.
//
// "Перезапустити" і "Повернутися на головну" обидві просто перезавантажують
// сторінку: App.jsx завжди стартує з screen === "menu" (useState("menu")),
// тож повне перезавантаження і так повертає на головний екран. Двох кнопок
// із різним текстом достатньо — дитині зрозуміліше, ніж один universal
// "Перезапустити".
// Клас-компонент — react-i18next хуки (useTranslation) тут недоступні,
// тож переклад приходить через withTranslation() (HOC-обгортка нижче,
// namespace "common") замість хардкодженого українського тексту, який тут
// був до цього аудиту (виявлено при перевірці i18n-міграції: цей компонент
// існував ще ДО переходу гри на i18next і сюди просто не докотилась хвиля
// перекладу решти екранів — екран краху показувався б українською навіть
// гравцям, які обрали іншу мову).
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Лишаємо слід у консолі для діагностики.
    console.error("ErrorBoundary зловив помилку рендера:", error, info?.componentStack);
    // app_error (launch-plan.md, розділ 15) — навмисно лише узагальнена
    // назва класу помилки (напр. "TypeError"), БЕЗ message/stack: текст
    // помилки міг би випадково містити щось із контексту рендера, а нам
    // потрібен лише грубий сигнал "як часто й де падає", не конкретика.
    trackEvent("app_error", { errorName: error?.name ?? "Error" });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyError = async () => {
    const { error } = this.state;
    const text = `${error?.name ?? "Error"}: ${error?.message ?? "невідома помилка"}\n${error?.stack ?? ""}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* буфер обміну недоступний (старий браузер/без дозволу) — не критично */
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { t } = this.props;

    return (
      <main className="min-h-dvh bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 font-body text-white flex items-center justify-center px-6">
        <div className="rpg-panel rpg-panel-gold rounded-3xl max-w-sm w-full px-6 py-8 text-center flex flex-col items-center gap-3">
          <span className="text-5xl" aria-hidden="true">🛡️</span>
          <h1 className="font-display gold-text text-2xl font-extrabold">{t("errorBoundaryTitle")}</h1>
          <p className="text-violet-200 text-sm leading-relaxed">
            {t("errorBoundaryBody")}
          </p>
          <div className="w-full flex flex-col gap-2.5 mt-3">
            <button onClick={this.handleReload} className="next-challenge-button w-full py-3 rounded-2xl font-bold">
              {t("errorBoundaryReload")}
            </button>
            <button onClick={this.handleReload} className="map-ghost-button w-full py-3 rounded-2xl font-bold">
              {t("errorBoundaryBackToMenu")}
            </button>
            <button
              onClick={this.handleCopyError}
              className="text-xs text-violet-300/70 underline underline-offset-2 mt-1"
            >
              {t("errorBoundaryCopyError")}
            </button>
          </div>
        </div>
      </main>
    );
  }
}

export default withTranslation("common")(ErrorBoundary);
