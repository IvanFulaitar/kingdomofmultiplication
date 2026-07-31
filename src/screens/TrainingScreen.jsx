import TopBar from "../components/TopBar.jsx";
import ArtImage from "../components/ArtImage.jsx";
import { playUiPrimary, playUiClick } from "../game/sfx.js";

function ModeIcon({ children, active }) {
  return (
    <span
      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 border ${
        active
          ? "bg-gradient-to-b from-violet-500/40 to-violet-900/40 border-amber-400/60 shadow-[0_0_14px_rgba(245,185,66,0.35)]"
          : "bg-indigo-950/50 border-white/10"
      }`}
    >
      {children}
    </span>
  );
}

export default function TrainingScreen({ onBack, onSelect }) {
  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-16">
        <div className="mb-6">
          <TopBar onBack={onBack} title="Тренування" />
        </div>

        <div className="rpg-panel rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-violet-100 mb-3">
          <span className="text-amber-300">⭐</span>
          <span>Додаткові режими для практики — не впливають на карту королівства.</span>
        </div>

        {/* Другорядне посилання на "Мої знання" — навмисно менш акцентне за
            картки режимів нижче (немає rpg-panel-gold/кнопки "Грати"), бо
            це не мінігра, а перегляд прогресу. Головний вхід — картка на
            головному екрані; тут лише зручний ярлик під час тренування. */}
        <button
          onClick={() => { playUiClick(); onSelect("knowledge"); }}
          className="w-full flex items-center gap-1.5 text-sm text-violet-200/80 hover:text-white transition mb-6 px-1"
        >
          <ArtImage src="/assets/icons/ui/book.png" fallback="📖" alt="" className="w-4 h-4 object-contain inline-flex items-center justify-center" />
          Переглянути прогрес у "Моїх знаннях" →
        </button>

        <div className="flex flex-col gap-3.5">
          <button
            onClick={() => { playUiPrimary(); onSelect("memory"); }}
            className="rpg-panel rpg-panel-gold hover:brightness-110 active:scale-[0.98] transition rounded-2xl p-4 flex items-center gap-4 text-left"
          >
            <ModeIcon active>🧠</ModeIcon>
            <div className="flex-1">
              <div className="font-display font-bold text-base">Математична пам'ять</div>
              <div className="text-xs text-white/60 mt-0.5">Знайди пари: приклад і відповідь</div>
            </div>
            <span className="play-button rounded-xl px-4 py-2 text-sm font-display font-bold text-indigo-950 shrink-0">Грати</span>
          </button>

          <button
            onClick={() => { playUiPrimary(); onSelect("maze"); }}
            className="rpg-panel rpg-panel-gold hover:brightness-110 active:scale-[0.98] transition rounded-2xl p-4 flex items-center gap-4 text-left"
          >
            <ModeIcon active>🌀</ModeIcon>
            <div className="flex-1">
              <div className="font-display font-bold text-base">Лабіринт</div>
              <div className="text-xs text-white/60 mt-0.5">Розв'язуй приклади та знаходь вихід</div>
            </div>
            <span className="play-button rounded-xl px-4 py-2 text-sm font-display font-bold text-indigo-950 shrink-0">Грати</span>
          </button>

          <button
            onClick={() => { playUiPrimary(); onSelect("race"); }}
            className="rpg-panel rpg-panel-gold hover:brightness-110 active:scale-[0.98] transition rounded-2xl p-4 flex items-center gap-4 text-left"
          >
            <ModeIcon active>🏁</ModeIcon>
            <div className="flex-1">
              <div className="font-display font-bold text-base">Перегони</div>
              <div className="text-xs text-white/60 mt-0.5">Відповідай швидко і стань першим</div>
            </div>
            <span className="play-button rounded-xl px-4 py-2 text-sm font-display font-bold text-indigo-950 shrink-0">Грати</span>
          </button>
        </div>
      </div>
    </div>
  );
}
