import { Component } from "react";

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
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Лишаємо слід у консолі для діагностики (нема аналітики помилок —
    // див. launch-plan.md розділ 15, це поки не блокує реліз).
    console.error("ErrorBoundary зловив помилку рендера:", error, info?.componentStack);
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

    return (
      <main className="min-h-dvh bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 font-body text-white flex items-center justify-center px-6">
        <div className="rpg-panel rpg-panel-gold rounded-3xl max-w-sm w-full px-6 py-8 text-center flex flex-col items-center gap-3">
          <span className="text-5xl" aria-hidden="true">🛡️</span>
          <h1 className="font-display gold-text text-2xl font-extrabold">Щось пішло не так</h1>
          <p className="text-violet-200 text-sm leading-relaxed">
            Твій прогрес збережено. Спробуй перезапустити гру.
          </p>
          <div className="w-full flex flex-col gap-2.5 mt-3">
            <button onClick={this.handleReload} className="next-challenge-button w-full py-3 rounded-2xl font-bold">
              Перезапустити
            </button>
            <button onClick={this.handleReload} className="map-ghost-button w-full py-3 rounded-2xl font-bold">
              Повернутися на головну
            </button>
            <button
              onClick={this.handleCopyError}
              className="text-xs text-violet-300/70 underline underline-offset-2 mt-1"
            >
              Скопіювати код помилки
            </button>
          </div>
        </div>
      </main>
    );
  }
}
