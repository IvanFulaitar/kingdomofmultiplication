import { useState } from "react";
import TopBar from "../components/TopBar.jsx";
import ArtImage from "../components/ArtImage.jsx";
import WeakPracticeScreen from "./WeakPracticeScreen.jsx";
import { playUiPrimary, playUiClick, playUiBack } from "../game/sfx.js";
import { explainFromPair } from "../game/explainFact.js";
import {
  MULTIPLIER_RANGE, tableFacts, tableMastery, overallMastery, computeMastery,
  masteryStatus, averageResponseTime, recommendTable, weakestFacts,
} from "../game/mastery.js";

// Технічне завдання (розділ 5 launch-plan.md + окремий детальний бриф на
// перебудову цього розділу): "Мої знання" — не список відсотків, а коротка
// навчальна панель. Два екрани в одному компоненті (внутрішній стан, не
// окремі App.jsx screen — простіше повертатись між ними):
//   overview — усі 8 таблиць, зведення, рекомендація, сортування;
//   detail   — 8 окремих прикладів обраної таблиці, підсумок, поради;
// і третій, тимчасовий "режим" — practiceScope, що підміняє обидва повним
// екраном WeakPracticeScreen.jsx (коротке тренування слабких прикладів).

const RECOMMEND_TEXT = {
  weak: (n) => `Радимо повторити таблицю на ${n}`,
  almost: (n) => `Радимо ще трохи потренувати таблицю на ${n}`,
  untried: (n) => `Радимо почати з таблиці на ${n}`,
};

// Українська множина: 1 спроба / 2-4 спроби / 5+ спроб.
function attemptsWord(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "спроба";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "спроби";
  return "спроб";
}

function formatAvgTime(ms) {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)} с`;
}

function formatLastAnswered(ts) {
  if (!ts) return "ще не відповідали";
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "щойно";
  if (diffMin < 60) return `${diffMin} хв тому`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} год тому`;
  return `${Math.floor(diffH / 24)} дн тому`;
}

// Скільки коротких завдань пропонуємо і скільки це триватиме — той самий
// пул, який реально відкриє WeakPracticeScreen.jsx (~15с на приклад).
function practiceBlurb(count) {
  const minutes = Math.max(1, Math.round((count * 15) / 60));
  return `${count} коротких завдань · приблизно ${minutes} хвилини`;
}

// overallMastery() дає лише число (зважене середнє по 8 таблицях), без
// власного tier — для кольору прогрес-бару зведеної панелі банди ті самі,
// що й masteryStatus() у mastery.js (без майстер-критеріїв: тут це один
// узагальнений відсоток, а не конкретний факт/таблиця, тому спрощено до
// простих меж). attempts===0 -> "untried" (сірий), а не "weak" (червоний,
// оманливо для "ще нічого не пробували").
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

function ProgressBar({ score, tier, className = "" }) {
  return (
    <div className={`knowledge-progress-track ${className}`}>
      <div className={`knowledge-progress-fill knowledge-fill-${tier}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
    </div>
  );
}

export default function MyKnowledgeScreen({ progress, onBack, onAnswer, onReward }) {
  const facts = progress.facts ?? {};
  const [selected, setSelected] = useState(null); // номер обраної таблиці, або null (огляд)
  const [sortMode, setSortMode] = useState("number"); // "number" | "weakest"
  const [expandedFact, setExpandedFact] = useState(null); // m у межах обраної таблиці
  const [practiceScope, setPracticeScope] = useState(null); // null | "all" | number
  const [practiceKey, setPracticeKey] = useState(0);

  function startPractice(scope) {
    playUiPrimary();
    setPracticeKey((k) => k + 1); // новий key -> WeakPracticeScreen монтується заново (свіжий "знімок ДО")
    setPracticeScope(scope);
  }

  // Тренування — окремий повноекранний "режим" цього самого компонента, не
  // App.jsx screen: по завершенні природно повертаємось туди ж (огляд чи
  // саме ця таблиця), без жодної додаткової маршрутизації.
  if (practiceScope !== null) {
    return (
      <WeakPracticeScreen
        key={practiceKey}
        progress={progress}
        tableNumber={practiceScope === "all" ? null : practiceScope}
        onAnswer={onAnswer}
        onReward={onReward}
        onExit={() => setPracticeScope(null)}
      />
    );
  }

  // ============================== ОГЛЯД ==============================
  if (selected === null) {
    const overall = overallMastery(facts);
    const recommendation = recommendTable(facts);
    const weakPool = weakestFacts(facts, { limit: 10 });

    const numbers = [...MULTIPLIER_RANGE];
    if (sortMode === "weakest") {
      numbers.sort((a, b) => tableMastery(facts, a).score - tableMastery(facts, b).score);
    }

    return (
      <div className="relative overflow-hidden min-h-dvh screen-in">
        <div className="center-vignette" />
        <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 py-8 pb-16">
          <div className="mb-6">
            <TopBar onBack={onBack} title="Мої знання" />
          </div>

          {/* Зведена панель (розділ 2): загальний відсоток, бар, кількість
              добре засвоєних/слабких таблиць, автоматична рекомендація. */}
          <div className="rpg-panel rounded-2xl px-5 py-4 mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-display font-bold text-sm text-violet-100">Загальне засвоєння</span>
              <span className="font-display font-extrabold text-lg gold-text">{overall.score}%</span>
            </div>
            <ProgressBar score={overall.score} tier={overallTier(overall)} className="mb-3" />
            <div className="flex items-center justify-between text-xs text-violet-200/85 mb-3">
              <span>🟢 Добре знаю: {overall.goodCount} з 8</span>
              <span>🔴 Потрібно повторити: {overall.weakCount}</span>
            </div>
            {recommendation && (
              <div className="knowledge-recommend-banner rounded-xl px-3.5 py-2.5 text-sm font-semibold flex items-center gap-2">
                <span aria-hidden="true">💡</span>
                <span>{RECOMMEND_TEXT[recommendation.reason](recommendation.number)}</span>
              </div>
            )}
            {!recommendation && overall.attempts > 0 && (
              <div className="knowledge-recommend-banner-good rounded-xl px-3.5 py-2.5 text-sm font-semibold flex items-center gap-2">
                <span aria-hidden="true">🎉</span>
                <span>Усі таблиці добре засвоєні — чудова робота!</span>
              </div>
            )}
          </div>

          {/* Сортування (розділ 4) — за замовчуванням за номером. */}
          <div className="flex items-center gap-2 mb-4" role="group" aria-label="Порядок сортування таблиць">
            <button
              onClick={() => { playUiClick(); setSortMode("number"); }}
              aria-pressed={sortMode === "number"}
              className={`knowledge-sort-btn ${sortMode === "number" ? "knowledge-sort-btn-active" : ""}`}
            >
              За номером
            </button>
            <button
              onClick={() => { playUiClick(); setSortMode("weakest"); }}
              aria-pressed={sortMode === "weakest"}
              className={`knowledge-sort-btn ${sortMode === "weakest" ? "knowledge-sort-btn-active" : ""}`}
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
                  className={`knowledge-card knowledge-card-${m.tier} rounded-2xl px-4 py-3.5 min-h-[76px] flex items-center gap-3.5 text-left relative`}
                >
                  <TierIcon status={m} className="w-11 h-11 object-contain flex items-center justify-center text-2xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-base truncate">Таблиця на {n}</span>
                      <span className="font-display font-bold text-sm shrink-0 ml-2">{m.attempts > 0 ? `${m.score}%` : "—"}</span>
                    </div>
                    <div className="text-xs text-white/60 mt-0.5 truncate">{m.label}</div>
                    <ProgressBar score={m.attempts > 0 ? m.score : 0} tier={m.tier} className="mt-1.5" />
                  </div>
                  <span className="knowledge-chevron shrink-0" aria-hidden="true">›</span>
                  {isRecommended && (
                    <span className="knowledge-badge-recommend absolute -top-2 left-4">Рекомендуємо повторити</span>
                  )}
                </button>
              );
            })}
          </div>

          {weakPool.length > 0 && (
            <div className="mt-6">
              <button onClick={() => startPractice("all")} className="next-challenge-button w-full py-4 rounded-2xl font-display font-extrabold text-lg">
                Потренувати слабкі приклади
              </button>
              <div className="text-center text-xs text-violet-200/70 mt-2">{practiceBlurb(weakPool.length)}</div>
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

  // Три найслабші приклади (розділ 7) — лише серед тих, що реально мають
  // проблему (weak/almost), щоб не позначати "Повторити" вже добре
  // засвоєний приклад тільки тому, що він відносно найгірший серед восьми.
  // Сортуємо за самим числом mastery (найнижчий бал — найслабший), а не за
  // назвою рівня — так у трійку завжди потрапляють дійсно гірші приклади.
  const repeatBadgeMs = new Set(
    entries
      .filter((e) => e.stat && (e.stat.correct ?? 0) + (e.stat.wrong ?? 0) >= 3)
      .filter((e) => ["weak", "almost"].includes(masteryStatus(e.stat).tier))
      .sort((a, b) => computeMastery(a.stat) - computeMastery(b.stat))
      .slice(0, 3)
      .map((e) => e.m)
  );

  const tablePool = weakestFacts(facts, { pairs: entries.filter((e) => e.stat).map((e) => e.pair), limit: 8 });

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />
      <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 py-8 pb-16">
        <div className="mb-2">
          <TopBar onBack={() => { playUiBack(); setSelected(null); setExpandedFact(null); }} title={`Таблиця на ${selected}`} />
        </div>
        <p className="text-violet-200/85 text-sm text-center mb-5">
          Переглянь, які приклади вже засвоєні, а які варто повторити
        </p>

        {/* Компактний підсумок (розділ 5) — головне число більше, решта —
            другорядні деталі, щоб не перевантажувати одразу купою цифр. */}
        <div className="rpg-panel rounded-2xl px-5 py-4 mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-display font-bold text-sm text-violet-100">Засвоєння</span>
            <span className="font-display font-extrabold text-2xl gold-text">{tableSummary.attempts > 0 ? `${tableSummary.score}%` : "—"}</span>
          </div>
          <ProgressBar score={tableSummary.attempts > 0 ? tableSummary.score : 0} tier={tableSummary.tier} className="mb-3" />
          <div className="flex items-center justify-between text-xs text-violet-200/75">
            <span>Правильних відповідей: {totalCorrect} із {totalAttempts}</span>
            <span>Середній час: {formatAvgTime(avgTimeMs)}</span>
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
                      <span className="font-display font-bold text-sm shrink-0 ml-2">
                        {insufficient ? "" : `${computeMastery(stat)}%`}
                      </span>
                    </div>
                    {insufficient ? (
                      <div className="text-xs text-white/50 mt-0.5">
                        {attempts === 0 ? "Ще недостатньо даних" : `${attempts} ${attemptsWord(attempts)}`}
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-white/60 mt-0.5">{status.label}</div>
                        <ProgressBar score={computeMastery(stat)} tier={status.tier} className="mt-1.5" />
                      </>
                    )}
                  </div>
                  {showRepeatBadge && <span className="knowledge-badge-repeat shrink-0">Повторити</span>}
                  <span className={`knowledge-chevron shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} aria-hidden="true">›</span>
                </button>

                {isExpanded && !insufficient && (
                  <div className="px-4 pb-3.5 pt-1 knowledge-fact-details">
                    <div className="grid grid-cols-2 gap-2 text-xs text-violet-200/85 mb-2.5">
                      <span>Точність: {Math.round(((stat.correct ?? 0) / attempts) * 100)}%</span>
                      <span>Спроб: {attempts}</span>
                      <span>Середній час: {formatAvgTime(averageResponseTime(stat))}</span>
                      <span>Востаннє: {formatLastAnswered(stat.lastAnsweredAt)}</span>
                    </div>
                    <p className="font-body text-xs text-amber-100/90 leading-snug rpg-panel rounded-lg px-3 py-2">
                      {explainFromPair(pair)}
                    </p>
                  </div>
                )}
                {isExpanded && insufficient && (
                  <div className="px-4 pb-3.5 pt-1 knowledge-fact-details">
                    <p className="font-body text-xs text-amber-100/90 leading-snug rpg-panel rounded-lg px-3 py-2">
                      {explainFromPair(pair)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {tablePool.length > 0 && (
          <div>
            <button onClick={() => startPractice(selected)} className="next-challenge-button w-full py-4 rounded-2xl font-display font-extrabold text-lg">
              Потренувати таблицю на {selected}
            </button>
            <div className="text-center text-xs text-violet-200/70 mt-2">{practiceBlurb(tablePool.length)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
