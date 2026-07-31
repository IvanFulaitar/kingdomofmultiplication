import { useState } from "react";
import TopBar from "../components/TopBar.jsx";
import ArtImage from "../components/ArtImage.jsx";
import { playUiPrimary, playUiBack } from "../game/sfx.js";
import { computeMastery, masteryStatus, tableMastery } from "../game/mastery.js";

const NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9];

// Для розгорнутої таблиці одного числа — беремо факт напряму за ключем,
// без нормалізації (progress.facts зберігає буквальний "AxB", залежно від
// того, як приклад був згенерований), пробуючи обидва порядки множників.
function factFor(facts, a, b) {
  return facts?.[`${a}x${b}`] ?? facts?.[`${b}x${a}`] ?? null;
}

export default function MyKnowledgeScreen({ progress, onBack }) {
  const [selected, setSelected] = useState(null);
  const facts = progress.facts ?? {};

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-16">
        <div className="mb-6">
          <TopBar onBack={selected ? () => { playUiBack(); setSelected(null); } : onBack} title="Мої знання" />
        </div>

        <div className="rpg-panel rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-violet-100 mb-6">
          <span className="text-amber-300">📖</span>
          <span>
            {selected
              ? `Таблиця множення на ${selected} — окремо кожен приклад.`
              : "Наскільки добре засвоєна кожна таблиця множення."}
          </span>
        </div>

        {!selected && (
          <div className="flex flex-col gap-3">
            {NUMBERS.map((n) => {
              const m = tableMastery(facts, n);
              return (
                <button
                  key={n}
                  onClick={() => { playUiPrimary(); setSelected(n); }}
                  className="rpg-panel rpg-panel-gold hover:brightness-110 active:scale-[0.98] transition rounded-2xl p-4 flex items-center gap-4 text-left"
                >
                  <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 bg-indigo-950/50 border border-white/10">
                    <ArtImage
                      src={`/assets/icons/knowledge/${m.file}.png`}
                      fallback={m.icon}
                      alt=""
                      className="w-9 h-9 object-contain flex items-center justify-center text-2xl"
                    />
                  </span>
                  <div className="flex-1">
                    <div className="font-display font-bold text-base">Таблиця на {n}</div>
                    <div className="text-xs text-white/60 mt-0.5">{m.label}</div>
                  </div>
                  <span className="gold-text font-display font-bold text-sm shrink-0">
                    {m.attempts > 0 ? `${m.score}%` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="flex flex-col gap-2.5">
            {NUMBERS.map((m) => {
              const stat = factFor(facts, selected, m);
              const attempts = (stat?.correct ?? 0) + (stat?.wrong ?? 0);
              const score = computeMastery(stat);
              const status = masteryStatus(score, attempts);
              return (
                <div
                  key={m}
                  className="rpg-panel rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  <ArtImage
                    src={`/assets/icons/knowledge/${status.file}.png`}
                    fallback={status.icon}
                    alt=""
                    className="w-6 h-6 object-contain flex items-center justify-center text-xl shrink-0"
                  />
                  <div className="flex-1 font-body text-sm text-violet-100">
                    {selected} × {m} = {selected * m}
                  </div>
                  <span className="text-xs text-white/60 shrink-0">
                    {attempts > 0 ? `${score}%` : status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
