import { useState } from "react";
import TopBar from "../components/TopBar.jsx";
import ArtImage from "../components/ArtImage.jsx";
import WeakPracticeScreen from "./WeakPracticeScreen.jsx";
import { playUiPrimary, playUiClick, playUiBack } from "../game/sfx.js";
import { explainFromPair } from "../game/explainFact.js";
import { formatPercent, formatSeconds, formatAttempts, formatLastAnswered } from "../game/format.js";
import {
  MULTIPLIER_RANGE, tableFacts, tableMastery, overallMastery, computeMastery,
  masteryStatus, averageResponseTime, recommendTable, buildOverviewPracticePool,
  buildTablePracticePool,
} from "../game/mastery.js";

// Технічне завдання: "Мої знання" — три пов'язані екрани одного навчального
// сценарію ("побачив прогрес -> знайшов слабке -> потренував -> побачив
// покращення"), не окремі App.jsx screen, а внутрішні "режими" одного
// компонента — так повернення після тренування природно веде туди, звідки
// відкрили (огляд чи саме ця таблиця), без жодної додаткової маршрутизації.
//   overview  — усі 8 таблиць, зведення, рекомендація, сортування;
//   detail    — 8 окремих прикладів обраної таблиці, підсумок, поради;
//   practice  — WeakPracticeScreen.jsx (усі слабкі / одна таблиця / один факт).

// "Майже засвоєно" (60-79%) — це НЕ те саме, що "Потрібно повторити": дитину
// не можна називати слабкою за проміжний результат. weak/untried формулюють
// це прямо ("повторити"/"почати"), almost — м'якше ("покращити"), ніколи не
// повторює слово "повторити" (логічна неузгодженість №1 у технічному
// завданні: "Потрібно повторити: 0" одночасно з порадою "повторити" таблицю
// у статусі "Майже засвоєно").
const RECOMMEND_TEXT = {
  weak: (n) => `Радимо повторити таблицю на ${n}`,
  almost: (n) => `Радимо покращити таблицю на ${n}`,
  untried: (n) => `Радимо почати з таблиці на ${n}`,
};
const RECOMMEND_BADGE = { weak: "Повторити", almost: "Варто покращити", untried: "Рекомендуємо" };

// Текст головної кнопки тренування (розділ 2.7 + логічна неузгодженість №4):
// якщо серед прикладів є й такі, де даних ще замало, чесно про це кажемо —
// а не називаємо звичайною "Слабкі приклади", коли насправді туди
// потрапило й щось геть нове.
const PRACTICE_CTA = {
  weak: "Потренувати слабкі приклади",
  improve: "Покращити найслабші приклади",
  review: "Продовжити тренування",
};

// Скільки коротких завдань пропонуємо і скільки це триватиме — рахуємо з
// РЕАЛЬНОГО розміру пулу (той самий, що відкриє WeakPracticeScreen.jsx),
// щоб цифри тут і там завжди збігались (логічна неузгодженість №3).
function practiceBlurb(count) {
  const minutes = Math.max(1, Math.round((count * 15) / 60));
  return `${count} коротких завдань · приблизно ${minutes} ${minutes === 1 ? "хвилина" : "хвилини"}`;
}

// overallMastery() дає лише число (зважене середнє по 8 таблицях), без
// власного tier — для кольору зведеного прогрес-бару межі ті самі, що й
// masteryStatus() (без майстер-критеріїв: тут це один узагальнений
// відсоток, а не конкретний факт/таблиця). attempts===0 -> "untried"
// (сірий), а не "weak" (червоний, оманливо для "ще нічого не пробували").
function overallTier(overall) {
  if (overall.attempts === 0) return "untried";
  if (overall.score < 60) return "weak";
  if (overall.score < 80) return "almost";
  if (overall.score < 95) return "good";
  return "master";
}

function TierIcon({ status, className }) {
  return (
    <ArtImage
      src={`/assets/icons/knowledge/${status.file}.png`}
      fallback={status.icon}
      alt=""
      className={className}
    />
  );
}

function ProgressBar({ score, tier, className = "", large = false }) {
  return (
    <div className={`knowledge-progress-track ${large ? "knowledge-progress-track-lg" : ""} ${className}`}>
      <div
        className={`knowledge-progress-fill ${large ? "knowledge-progress-fill-lg knowledge-fill-animate" : ""} knowledge-fill-${tier}`}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}

export default function MyKnowledgeScreen({ progress, onBack, onAnswer, onReward }) {
  const facts = progress.facts ?? {};
  const [selected, setSelected] = useState(null); // номер обраної таблиці, або null (огляд)
  const [sortMode, setSortMode] = useState("number"); // "number" | "weakest"
  const [expandedFact, setExpandedFact] = useState(null); // m у межах обраної таблиці
  const [practiceScope, setPracticeScope] = useState(null); // null | {type:"all"|"table"|"fact", ...}
  const [practiceKey, setPracticeKey] = useState(0);

  function startPractice(scope) {
    playUiPrimary();
    setPracticeKey((k) => k + 1); // новий key -> WeakPracticeScreen монтується заново (свіжий "знімок ДО")
    setPracticeScope(scope);
  }

  // Тренування — окремий повноекранний "режим" цього самого компонента, не
  // App.jsx screen: по завершенні природно повертаємось туди ж (огляд,
  // саме ця таблиця, чи розгорнутий приклад), без жодної додаткової
  // маршрутизації.
  if (practiceScope !== null) {
    return (
      <WeakPracticeScreen
        key={practiceKey}
        progress={progress}
        tableNumber={practiceScope.type === "table" ? practiceScope.number : null}
        singleFact={practiceScope.type === "fact" ? { a: practiceScope.a, b: practiceScope.b } : null}
        onAnswer={onAnswer}
        onReward={onReward}
        onExit={() => setPracticeScope(null)}
        onReplay={() => setPracticeKey((k) => k + 1)}
      />
    );
  }

  // ============================== ОГЛЯД ==============================
  if (selected === null) {
    const overall = overallMastery(facts);
    const recommendation = recommendTable(facts);
    const { pool: overviewPool, mode: overviewMode } = buildOverviewPracticePool(facts);

    const numbers = [...MULTIPLIER_RANGE];
    if (sortMode === "weakest") {
      numbers.sort((a, b) => tableMastery(facts, a).score - tableMastery(facts, b).score);
    }

    return (
      <div className="relative overflow-hidden min-h-dvh screen-in">
        <div className="center-vignette" />
        <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 py-8 pb-16">
          <div className="mb-1.5">
            <TopBar onBack={onBack} title="Мої знання" />
          </div>
          <p className="text-violet-200/70 text-xs text-center mb-5">
            Переглядай прогрес і повторюй складні приклади
          </p>

          {/* Зведена панель (розділ 2.2) — головний інформаційний блок
              екрана: великий відсоток, товщий анімований прогрес-бар, три
              рядки розподілу по статусах, натискна рекомендація. */}
          <div className="rpg-panel rounded-2xl px-5 py-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-bold text-sm text-violet-100">Загальне засвоєння</span>
              <span className="font-display font-extrabold text-2xl gold-text">{formatPercent(overall.score)}</span>
            </div>
            <ProgressBar score={overall.score} tier={overallTier(overall)} className="mb-3.5" large />
            <div className="flex flex-col gap-1 text-xs text-violet-200/85 mb-3.5">
              <span>🟢 Добре знаю: {overall.goodCount} з 8</span>
              <span>🟡 Майже засвоєно: {overall.almostCount}</span>
              <span>🔴 Потрібно повторити: {overall.weakCount}</span>
            </div>
            {recommendation && (
              <button
                onClick={() => { playUiPrimary(); setSelected(recommendation.number); }}
                className="knowledge-recommend-banner knowledge-recommend-banner-tappable rounded-xl px-3.5 py-2.5 text-sm font-semibold flex items-center gap-2 w-full text-left"
              >
                <span aria-hidden="true">💡</span>
                <span className="flex-1">{RECOMMEND_TEXT[recommendation.reason](recommendation.number)}</span>
                <span className="knowledge-chevron shrink-0" aria-hidden="true">›</span>
              </button>
            )}
            {!recommendation && overall.attempts > 0 && (
              <div className="knowledge-recommend-banner-good rounded-xl px-3.5 py-2.5 text-sm font-semibold flex items-center gap-2">
                <span aria-hidden="true">🎉</span>
                <span>Усі таблиці добре засвоєні — чудова робота!</span>
              </div>
            )}
          </div>

          {/* Сортування (розділ 2.4) — компактний segmented control. */}
          <div className="knowledge-segmented mb-4" role="group" aria-label="Порядок сортування таблиць">
            <button
              onClick={() => { playUiClick(); setSortMode("number"); }}
              aria-pressed={sortMode === "number"}
              className={`knowledge-segmented-btn ${sortMode === "number" ? "knowledge-segmented-btn-active" : ""}`}
            >
              За номером
            </button>
            <button
              onClick={() => { playUiClick(); setSortMode("weakest"); }}
              aria-pressed={sortMode === "weakest"}
              className={`knowledge-segmented-btn ${sortMode === "weakest" ? "knowledge-segmented-btn-active" : ""}`}
            >
              Найслабші спочатку
            </button>
          </div>

          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
            {numbers.map((n) => {
              const m = tableMastery(facts, n);
              const isRecommended = recommendation?.number === n;
              return (
                <button
                  key={n}
                  onClick={() => { playUiPrimary(); setSelected(n); }}
                  aria-label={`Таблиця на ${n}, ${m.attempts > 0 ? `засвоєння ${m.score} відсотків, ${m.label.toLowerCase()}` : "ще не вивчалась"}`}
                  className={`knowledge-card knowledge-card-${m.tier} rounded-2xl px-4 py-3.5 min-h-[76px] flex items-center gap-4 text-left`}
                >
                  <TierIcon status={m} className="w-11 h-11 object-contain flex items-center justify-center text-2xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    {isRecommended && (
                      <span className="knowledge-badge-recommend inline-block mb-1">{RECOMMEND_BADGE[recommendation.reason]}</span>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-base truncate">Таблиця на {n}</span>
                      <span className="font-display font-bold text-sm shrink-0 ml-2">{m.attempts > 0 ? formatPercent(m.score) : "—"}</span>
                    </div>
                    <div className="text-xs text-white/60 mt-0.5 truncate">{m.label}</div>
                    <ProgressBar score={m.attempts > 0 ? m.score : 0} tier={m.tier} className="mt-1.5" />
                  </div>
                  <span className="knowledge-chevron knowledge-chevron-lg shrink-0" aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>

          {overviewMode !== "none" && (
            <div className="mt-6">
              <button
                onClick={() => startPractice({ type: "all" })}
                className="knowledge-cta-button w-full py-3.5 rounded-2xl font-display font-extrabold text-lg text-indigo-950"
              >
                {PRACTICE_CTA[overviewMode]}
              </button>
              <div className="text-center text-xs text-violet-200/70 mt-2">{practiceBlurb(overviewPool.length)}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================== ДЕТАЛІ ТАБЛИЦІ ==============================
  const entries = tableFacts(facts, selected);
  const tableSummary = tableMastery(facts, selected);
  const totalAttempts = entries.reduce((s, e) => s + (e.stat ? (e.stat.correct ?? 0) + (e.stat.wrong ?? 0) : 0), 0);
  const totalCorrect = entries.reduce((s, e) => s + (e.stat?.correct ?? 0), 0);
  const avgTimeMs = (() => {
    const withTime = entries.map((e) => e.stat).filter((s) => s && s.answeredCount);
    if (!withTime.length) return null;
    const totalMs = withTime.reduce((s, st) => s + st.totalResponseTimeMs, 0);
    const totalCount = withTime.reduce((s, st) => s + st.answeredCount, 0);
    return totalCount ? totalMs / totalCount : null;
  })();

  // Три найслабші приклади (розділ 3.3/3.4) — лише серед тих, що реально
  // мають проблему (weak/almost), щоб не позначати "Потренувати" вже добре
  // засвоєний приклад тільки тому, що він відносно найгірший серед восьми.
  const repeatBadgeMs = new Set(
    entries
      .filter((e) => e.stat && (e.stat.correct ?? 0) + (e.stat.wrong ?? 0) >= 3)
      .filter((e) => ["weak", "almost"].includes(masteryStatus(e.stat).tier))
      .sort((a, b) => computeMastery(a.stat) - computeMastery(b.stat))
      .slice(0, 3)
      .map((e) => e.m)
  );

  // Той самий пул-білдер, який реально запустить WeakPracticeScreen.jsx —
  // жодних розбіжностей у цифрах між "N коротких завдань" тут і фактичною
  // довжиною тренування (логічна неузгодженість №3).
  const tablePool = buildTablePracticePool(facts, selected);

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />
      <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 py-8 pb-16">
        <div className="mb-2">
          <TopBar onBack={() => { playUiBack(); setSelected(null); setExpandedFact(null); }} title={`Таблиця на ${selected}`} />
        </div>
        <p className="text-violet-200/85 text-sm text-center mb-5">
          <span className="sm:hidden">Перевір, що вже знаєш</span>
          <span className="hidden sm:inline">Переглянь, які приклади вже засвоєні, а які варто повторити</span>
        </p>

        {/* Компактний підсумок (розділ 3.2) — головне число більше, решта —
            другорядні деталі в окремому нижньому рядку, не притиснуті до
            країв (grid, не суцільний justify-between). */}
        <div className="rpg-panel rounded-2xl px-5 py-4 mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-display font-bold text-sm text-violet-100">Засвоєння</span>
            <span className="font-display font-extrabold text-2xl gold-text">{tableSummary.attempts > 0 ? formatPercent(tableSummary.score) : "—"}</span>
          </div>
          <ProgressBar score={tableSummary.attempts > 0 ? tableSummary.score : 0} tier={tableSummary.tier} className="mb-3.5" large />
          <div className="grid grid-cols-2 gap-3 text-xs text-violet-200/75">
            <span>Правильних: {totalCorrect} із {totalAttempts}</span>
            <span className="text-right">Середній час: {formatSeconds(avgTimeMs)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 mb-6">
          {entries.map(({ m, pair, stat }) => {
            const attempts = stat ? (stat.correct ?? 0) + (stat.wrong ?? 0) : 0;
            const insufficient = attempts < 3;
            const status = insufficient ? null : masteryStatus(stat);
            const isExpanded = expandedFact === m;
            const showRepeatBadge = repeatBadgeMs.has(m);

            return (
              <div key={m} className={`knowledge-fact-row rounded-xl overflow-hidden ${insufficient ? "knowledge-card-untried" : `knowledge-card-${status.tier}`}`}>
                <button
                  onClick={() => { playUiClick(); setExpandedFact(isExpanded ? null : m); }}
                  aria-expanded={isExpanded}
                  aria-label={`${selected} помножити на ${m}, ${insufficient ? "ще недостатньо даних" : `засвоєння ${computeMastery(stat)} відсотків, ${status.label.toLowerCase()}`}`}
                  className="w-full min-h-[72px] px-4 py-3 flex items-center gap-3 text-left"
                >
                  <TierIcon
                    status={insufficient ? { file: "knowledge_untried", icon: "⚪" } : status}
                    className="w-7 h-7 object-contain flex items-center justify-center text-xl shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-body text-sm text-violet-100">{selected} × {m} = {selected * m}</span>
                      {!insufficient && (
                        <span className="font-display font-bold text-sm shrink-0 ml-2">{formatPercent(computeMastery(stat))}</span>
                      )}
                    </div>
                    {insufficient ? (
                      <div className="text-xs text-white/50 mt-0.5">
                        <div>Ще недостатньо даних</div>
                        {attempts > 0 && <div>{formatAttempts(attempts)}</div>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-white/60 flex-1">{status.label}</span>
                        {showRepeatBadge && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); startPractice({ type: "fact", a: selected, b: m }); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); startPractice({ type: "fact", a: selected, b: m }); } }}
                            className="knowledge-badge-practice shrink-0"
                          >
                            Потренувати
                          </span>
                        )}
                      </div>
                    )}
                    {!insufficient && <ProgressBar score={computeMastery(stat)} tier={status.tier} className="mt-1.5" />}
                  </div>
                  <span className={`knowledge-chevron shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} aria-hidden="true">›</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3.5 pt-1 knowledge-fact-details">
                    {!insufficient && (
                      <div className="grid grid-cols-2 gap-2 text-xs text-violet-200/85 mb-2.5">
                        <span>Точність: {formatPercent(((stat.correct ?? 0) / attempts) * 100)}</span>
                        <span>Спроб: {attempts}</span>
                        <span>Середній час: {formatSeconds(averageResponseTime(stat))}</span>
                        <span>Востаннє: {formatLastAnswered(stat?.lastAnsweredAt)}</span>
                      </div>
                    )}
                    <p className="font-body text-xs text-amber-100/90 leading-snug rpg-panel rounded-lg px-3 py-2 mb-2.5">
                      {explainFromPair(pair)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); startPractice({ type: "fact", a: selected, b: m }); }}
                        className="knowledge-secondary-button flex-1 rounded-xl py-2.5 text-sm font-display font-bold"
                      >
                        Потренувати цей приклад
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedFact(null); }}
                        className="knowledge-secondary-button-muted px-4 rounded-xl py-2.5 text-sm font-display font-bold"
                      >
                        Закрити
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {tablePool.length > 0 && (
          <div>
            <button
              onClick={() => startPractice({ type: "table", number: selected })}
              className="knowledge-cta-button w-full py-3.5 rounded-2xl font-display font-extrabold text-lg text-indigo-950"
            >
              Потренувати таблицю на {selected}
            </button>
            <div className="text-center text-xs text-violet-200/70 mt-2">{practiceBlurb(tablePool.length)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
