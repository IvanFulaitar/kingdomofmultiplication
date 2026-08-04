import { useTranslation } from "react-i18next";
import TopBar from "../components/TopBar.jsx";
import { formatPercent, formatSeconds } from "../game/format.js";
import { overallMastery, recommendTable, weakestFacts } from "../game/mastery.js";
import { activitySummary, masteryScoreDaysAgo, overallAverageResponseTime } from "../game/parentStats.js";

// launch-plan.md, розділ 8 "Додати окремий режим для дорослого" — окремий
// екран для батьків/вчителя (не дитини): загальна точність, середній час
// відповіді, найсильніші/найслабші таблиці, заняття за тиждень, тренд
// засвоєння за 7/30 днів, рекомендація що повторити разом. Свідомо БЕЗ
// "Скинути прогрес" і БЕЗ ручного експорту/імпорту (launch-plan.md розділ
// 26 — прибрано навмисно, синхронізація прогресу піде через акаунт, коли
// AUTH_ENABLED увімкнеться, а не через файл).

function trendValue(t, current, past) {
  if (past === null) return null;
  const diff = Math.round(current - past);
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  return t("parent:trendValue", { sign, value: Math.abs(diff) });
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rpg-panel rounded-2xl px-4 py-3.5 flex-1 min-w-0">
      <div className="text-xs text-violet-200/70 font-semibold truncate">{label}</div>
      <div className="font-display font-extrabold text-xl gold-text mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-violet-200/60 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function TableChip({ t, entry }) {
  const status = { icon: entry.tier === "master" ? "⭐" : entry.tier === "good" ? "🟢" : entry.tier === "almost" ? "🟡" : entry.tier === "weak" ? "🔴" : "⚪" };
  return (
    <div className="knowledge-fact-row rounded-xl px-3 py-2 flex items-center gap-2.5">
      <span aria-hidden="true" className="text-lg shrink-0">{status.icon}</span>
      <span className="font-body text-sm text-violet-100 flex-1">{t("knowledge:tableName", { n: entry.number })}</span>
      <span className="font-display font-bold text-sm shrink-0">{entry.attempts > 0 ? formatPercent(entry.score) : "—"}</span>
    </div>
  );
}

export default function ParentScreen({ progress, onBack }) {
  const { t } = useTranslation(["parent", "knowledge", "common"]);
  const facts = progress.facts ?? {};
  const activityLog = progress.activityLog ?? [];
  const overall = overallMastery(facts);

  if (overall.attempts === 0) {
    return (
      <div className="relative overflow-hidden min-h-dvh screen-in">
        <div className="center-vignette" />
        <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 py-8 pb-16">
          <div className="mb-5">
            <TopBar onBack={onBack} title={t("parent:screenTitle")} />
          </div>
          <div className="rpg-panel rounded-2xl px-5 py-8 text-center">
            <div className="text-3xl mb-2" aria-hidden="true">📊</div>
            <div className="font-display font-bold text-base text-violet-100 mb-1.5">{t("parent:noDataTitle")}</div>
            <p className="text-sm text-violet-200/70">{t("parent:noDataBody")}</p>
          </div>
        </div>
      </div>
    );
  }

  const avgTimeMs = overallAverageResponseTime(facts);
  const week = activitySummary(activityLog, 7);
  const avgSessionMs = week.sessions > 0 ? week.activeMs / week.sessions : null;
  const scoreThen7 = masteryScoreDaysAgo(activityLog, 7);
  const scoreThen30 = masteryScoreDaysAgo(activityLog, 30);
  const trend7 = trendValue(t, overall.score, scoreThen7);
  const trend30 = trendValue(t, overall.score, scoreThen30);

  const engaged = overall.tables.filter((tb) => tb.attempts > 0);
  const strongest = [...engaged].sort((a, b) => b.score - a.score).slice(0, 2);
  const weakestTables = engaged.filter((tb) => tb.tier === "weak").sort((a, b) => a.score - b.score).slice(0, 2);

  const recommendation = recommendTable(facts);
  const toRepeat = weakestFacts(facts, { limit: 3 });

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />
      <div className="relative z-10 max-w-md sm:max-w-2xl mx-auto px-6 py-8 pb-16">
        <div className="mb-1.5">
          <TopBar onBack={onBack} title={t("parent:screenTitle")} />
        </div>
        <p className="text-violet-200/70 text-xs text-center mb-5">{t("parent:subtitle")}</p>

        <div className="flex gap-3 mb-5">
          <StatCard label={t("parent:accuracyLabel")} value={formatPercent(overall.score)} />
          <StatCard label={t("parent:avgTimeLabel")} value={formatSeconds(avgTimeMs)} />
        </div>

        <div className="rpg-panel rounded-2xl px-5 py-4 mb-5">
          <div className="font-display font-bold text-sm text-violet-100 mb-3">{t("parent:activityTitle")}</div>
          {week.sessions === 0 ? (
            <p className="text-xs text-violet-200/70">{t("parent:noActivityYet")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-xs text-violet-200/85">
              <span>{t("parent:sessionsCount", { count: week.sessions })}</span>
              <span className="text-right">{t("parent:activeTimeLabel", { value: Math.round(week.activeMs / 60000) })}</span>
              {avgSessionMs !== null && (
                <span className="col-span-2">{t("parent:avgSessionLabel", { value: Math.max(1, Math.round(avgSessionMs / 60000)) })}</span>
              )}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-1 text-xs text-violet-200/85">
            <div className="flex items-center justify-between">
              <span>{t("parent:trend7dLabel")}</span>
              <span className="font-semibold">{trend7 ?? t("parent:trendNotEnoughData")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("parent:trend30dLabel")}</span>
              <span className="font-semibold">{trend30 ?? t("parent:trendNotEnoughData")}</span>
            </div>
          </div>
        </div>

        <div className="rpg-panel rounded-2xl px-5 py-4 mb-5">
          <div className="font-display font-bold text-sm text-violet-100 mb-3">{t("parent:tablesTitle")}</div>
          <div className="mb-1.5 text-xs font-semibold text-emerald-300/90">{t("parent:strongestLabel")}</div>
          {strongest.length === 0 ? (
            <p className="text-xs text-violet-200/60 mb-3">{t("parent:noStrongYet")}</p>
          ) : (
            <div className="flex flex-col gap-1.5 mb-3">
              {strongest.map((tb) => <TableChip key={tb.number} t={t} entry={tb} />)}
            </div>
          )}
          <div className="mb-1.5 text-xs font-semibold text-rose-300/90">{t("parent:weakestLabel")}</div>
          {weakestTables.length === 0 ? (
            <p className="text-xs text-violet-200/60">{t("parent:noWeakYet")}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {weakestTables.map((tb) => <TableChip key={tb.number} t={t} entry={tb} />)}
            </div>
          )}
        </div>

        <div className="knowledge-recommend-banner rounded-2xl px-4 py-3.5">
          <div className="flex items-center gap-2 font-display font-bold text-sm mb-1.5">
            <span aria-hidden="true">💡</span>
            <span>{t("parent:recommendTitle")}</span>
          </div>
          {toRepeat.length > 0 ? (
            <p className="text-sm">
              {toRepeat.map((f) => `${f.a} × ${f.b}`).join(`, `)}
              {recommendation && ` — ${t("knowledge:tableName", { n: recommendation.number })}`}
            </p>
          ) : (
            <p className="text-sm">{t("parent:recommendAllGood")}</p>
          )}
        </div>

        <p className="text-center text-[11px] text-violet-200/50 mt-5">{t("parent:localOnlyNote")}</p>
      </div>
    </div>
  );
}
