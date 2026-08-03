import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("training");
  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />

      <div className="relative z-10 max-w-md mx-auto px-6 py-8 pb-16">
        <div className="mb-6">
          <TopBar onBack={onBack} title={t("title")} />
        </div>

        <div className="rpg-panel rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-violet-100 mb-6">
          <span className="text-amber-300">⭐</span>
          <span>{t("subtitle")}</span>
        </div>

        <div className="flex flex-col gap-3.5">
          <button
            onClick={() => { playUiPrimary(); onSelect("memory"); }}
            className="rpg-panel rpg-panel-gold hover:brightness-110 active:scale-[0.98] transition rounded-2xl p-4 flex items-center gap-4 text-left"
          >
            <ModeIcon active>🧠</ModeIcon>
            <div className="flex-1">
              <div className="font-display font-bold text-base">{t("memoryTitle")}</div>
              <div className="text-xs text-white/60 mt-0.5">{t("memoryDesc")}</div>
            </div>
            <span className="play-button rounded-xl px-4 py-2 text-sm font-display font-bold text-indigo-950 shrink-0">{t("play")}</span>
          </button>

          <button
            onClick={() => { playUiPrimary(); onSelect("maze"); }}
            className="rpg-panel rpg-panel-gold hover:brightness-110 active:scale-[0.98] transition rounded-2xl p-4 flex items-center gap-4 text-left"
          >
            <ModeIcon active>🌀</ModeIcon>
            <div className="flex-1">
              <div className="font-display font-bold text-base">{t("mazeTitle")}</div>
              <div className="text-xs text-white/60 mt-0.5">{t("mazeDesc")}</div>
            </div>
            <span className="play-button rounded-xl px-4 py-2 text-sm font-display font-bold text-indigo-950 shrink-0">{t("play")}</span>
          </button>

          <button
            onClick={() => { playUiPrimary(); onSelect("race"); }}
            className="rpg-panel rpg-panel-gold hover:brightness-110 active:scale-[0.98] transition rounded-2xl p-4 flex items-center gap-4 text-left"
          >
            <ModeIcon active>🏁</ModeIcon>
            <div className="flex-1">
              <div className="font-display font-bold text-base">{t("raceTitle")}</div>
              <div className="text-xs text-white/60 mt-0.5">{t("raceDesc")}</div>
            </div>
            <span className="play-button rounded-xl px-4 py-2 text-sm font-display font-bold text-indigo-950 shrink-0">{t("play")}</span>
          </button>
        </div>

        {/* Перехід до "Мої знання" — навмисно компактний і менш акцентний за
            картки режимів вище (без rpg-panel-gold/кнопки "Грати"): це не
            мінігра, а перехід до розділу прогресу. Головний, найпомітніший
            вхід лишається карткою на головному екрані. */}
        <button
          onClick={() => { playUiClick(); onSelect("knowledge"); }}
          aria-label={t("knowledgeLinkAria")}
          className="training-progress-card w-full min-h-[72px] rounded-2xl px-4 py-3 mt-5 flex items-center gap-3.5 text-left"
        >
          <span className="training-progress-icon w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
            <ArtImage
              src="/assets/icons/ui/book.png"
              fallback="📖"
              alt=""
              className="w-6 h-6 object-contain flex items-center justify-center text-lg"
            />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-sm text-violet-50 truncate">{t("knowledgeLinkTitle")}</div>
            <div className="text-xs text-violet-200/70 mt-0.5 truncate">{t("knowledgeLinkDesc")}</div>
          </div>
          <span className="training-progress-chevron shrink-0 text-lg" aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
