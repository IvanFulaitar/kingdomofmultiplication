import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AVATARS } from "../data/cosmetics.js";
import { QUEST_POOL } from "../data/rewards.js";
import { heroLevelFromXp } from "../game/progress.js";
import { isSoundEnabled, setSoundEnabled } from "../game/sound.js";
import { isMusicEnabled, setMusicEnabled } from "../game/music.js";
import { playUiClick, playUiPrimary } from "../game/sfx.js";
import { APP_VERSION, LAST_UPDATE } from "../version.js";
import { SUPPORTED_LANGUAGES } from "../i18n/index.js";
import StarIcon from "../components/StarIcon.jsx";
import ArtImage from "../components/ArtImage.jsx";
import LanguagePickerModal from "../components/LanguagePickerModal.jsx";
import SimpleToast from "../components/SimpleToast.jsx";

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 ${checked ? "bg-emerald-500/90" : "bg-white/15"}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

// Один раз показане ненав'язливе нагадування про акаунт (розділ 6 брифу) —
// власний ключ, окремо від прогресу й від токена, щоб не зачіпати
// migrateSave()/схему збереження заради одного прапорця "вже бачив".
const ACCOUNT_NUDGE_KEY = "kingdom-multiplication-account-nudge-dismissed";

export default function MenuScreen({ progress, onPlay, onBadges, onShop, onTraining, onKnowledge, hasNewKnowledge, user, onAccount }) {
  const { t, i18n } = useTranslation(["menu", "quests", "common"]);
  const avatar = AVATARS.find((a) => a.id === progress.avatar) ?? AVATARS[0];
  const { level, into, need } = heroLevelFromXp(progress.xp);
  const [sfxOn, setSfxOn] = useState(() => isSoundEnabled());
  const [musicOn, setMusicOn] = useState(() => isMusicEnabled());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [languageToast, setLanguageToast] = useState(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return localStorage.getItem(ACCOUNT_NUDGE_KEY) === "1"; } catch { return true; }
  });
  const settingsRef = useRef(null);
  const settingsToggleRef = useRef(null);
  const xpPct = (into / need) * 100;
  // "math_hero27@gmail.com" -> "math_hero27" — під капотом акаунт і далі
  // працює через email (backend), але дитині показуємо лише зрозумілу
  // "логін"-подібну частину, без технічної адреси пошти на екрані.
  const displayName = user?.email ? user.email.split("@")[0] : "";
  const currentLanguageName = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)?.nativeName ?? "";

  // Ненав'язливе нагадування (розділ 6 брифу) — лише коли є вже корисний
  // прогрес (не одразу після встановлення), і лише поки не залогінений і
  // ще не бачив/не закривав його раніше. Навмисно рахуємо з даних, які вже
  // й так є в progress — без нового лічильника відкриттів застосунку.
  const completedLevels = Object.values(progress.levels ?? {}).filter((l) => (l?.stars ?? 0) > 0).length;
  const boughtExtraAvatar = (progress.ownedAvatars?.length ?? 1) > 1;
  const hasMeaningfulProgress = completedLevels >= 3 || level >= 2 || boughtExtraAvatar;
  const showAccountNudge = !user && !nudgeDismissed && hasMeaningfulProgress;

  // Акаунт (email/пароль) — необов'язкова фіча (frontend-backend-
  // integration-plan.md): лише щоб не втратити прогрес при зміні
  // телефону, гра й далі повністю грається без нього.
  function handleAccountClick() {
    playUiClick();
    onAccount?.();
  }

  function dismissAccountNudge() {
    setNudgeDismissed(true);
    try { localStorage.setItem(ACCOUNT_NUDGE_KEY, "1"); } catch { /* немає localStorage — просто не запам'ятається між сесіями */ }
  }

  function handleNudgeLoginClick() {
    dismissAccountNudge();
    handleAccountClick();
  }

  function closeSettings(returnFocus) {
    setSettingsOpen(false);
    if (returnFocus) settingsToggleRef.current?.focus();
  }

  // Мова — окремий рядок у "Налаштуваннях" (розділ 1/2 брифу локалізації):
  // акаунт лишається виключно в кнопці профілю, сюди не додається. Спершу
  // закриваємо попап налаштувань, щоб модалка вибору мови не малювалась
  // поверх нього другим шаром.
  function openLanguagePicker() {
    playUiClick();
    closeSettings(false);
    setLangPickerOpen(true);
  }

  function handleLanguageChanged() {
    // Викликається ПІСЛЯ того, як i18n.changeLanguage() уже застосувався
    // (LanguagePickerModal чекає його проміс) — тому t() тут одразу
    // повертає текст новою мовою, а не попередньою.
    setLanguageToast(t("common:languageChanged"));
  }

  function toggleSfx(next) {
    setSfxOn(next);
    setSoundEnabled(next);
    if (next) playUiClick();
  }

  function toggleMusic(next) {
    setMusicOn(next);
    setMusicEnabled(next);
    if (sfxOn) playUiClick();
  }

  useEffect(() => {
    if (!settingsOpen) return;
    function onOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) closeSettings(false);
    }
    function onKey(e) {
      if (e.key === "Escape") closeSettings(true);
    }
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  return (
    <div className="relative overflow-hidden min-h-dvh screen-in">
      <div className="center-vignette" />

      {/* Профіль + звук — рядок із двох однакових системних кнопок у
          верхньому правому куті (розділ 2/5/8 брифу): однаковий розмір
          (48×48), форма, товщина рамки, вирівняні по одній осі. Профіль —
          компактна іконка/аватар, БЕЗ постійного тексту й БЕЗ золотої
          заливки, щоб не виглядати головною дією поруч із "ГРАТИ". */}
      <div
        className="absolute z-30 flex items-center gap-2.5"
        style={{ top: "max(1rem, env(safe-area-inset-top))", right: "max(1.25rem, env(safe-area-inset-right))" }}
      >
        <button
          onClick={handleAccountClick}
          aria-label={user ? t("menu:profileAriaAuthed", { name: displayName }) : t("menu:profileAriaGuest")}
          title={user ? t("menu:profileTitleAuthed", { name: displayName }) : t("menu:profileTitleGuest")}
          className="system-icon-button rpg-panel w-12 h-12 rounded-xl flex items-center justify-center"
        >
          {user ? (
            <span className="system-icon-glow relative inline-flex items-center justify-center w-8 h-8 rounded-full overflow-hidden">
              <ArtImage
                src={`/assets/avatars/${avatar.id}.png`}
                fallback={avatar.icon}
                alt=""
                className="w-8 h-8 rounded-full object-contain flex items-center justify-center text-base"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-indigo-950 shadow-[0_0_5px_rgba(52,211,153,0.9)]"
                aria-hidden="true"
              />
            </span>
          ) : (
            <ArtImage
              src="/assets/icons/ui/user.png"
              fallback="👤"
              alt=""
              className="system-icon-glow w-6 h-6 object-contain flex items-center justify-center text-lg text-amber-100/90"
            />
          )}
        </button>

        <div ref={settingsRef} className="relative">
          <button
            ref={settingsToggleRef}
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label={t("menu:settingsAriaLabel")}
            aria-expanded={settingsOpen}
            className="system-icon-button rpg-panel w-12 h-12 rounded-xl flex items-center justify-center text-lg"
          >
            <ArtImage
              src="/assets/icons/ui/gear.png"
              fallback={sfxOn || musicOn ? "🔊" : "🔇"}
              alt=""
              className="system-icon-glow w-6 h-6 object-contain flex items-center justify-center text-lg"
            />
          </button>
          {settingsOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-3 menu-panel rounded-2xl p-3.5 w-[240px] max-w-[calc(100vw-2rem)] flex flex-col gap-1 shadow-xl"
            >
              <span className="font-display font-bold text-amber-300 text-xs px-0.5 pb-1.5">
                {t("menu:settingsTitle")}
              </span>
              <button
                type="button"
                onClick={openLanguagePicker}
                className="flex items-center gap-2.5 px-1.5 py-2 rounded-lg hover:bg-white/5 transition text-left"
              >
                <ArtImage
                  src="/assets/icons/ui/globe.png"
                  fallback="🌐"
                  alt=""
                  className="w-5 h-5 object-contain flex items-center justify-center text-base shrink-0"
                />
                <span className="text-sm font-semibold text-white flex-1">{t("menu:language")}</span>
                <span className="text-xs text-violet-300/80">{currentLanguageName}</span>
                <span className="text-violet-300/60 text-xs" aria-hidden="true">›</span>
              </button>

              <div className="h-px bg-white/10 my-1.5" />

              <div className="flex items-center justify-between gap-3 px-1.5 py-1">
                <span className="text-sm font-semibold text-white">{t("menu:music")}</span>
                <ToggleSwitch checked={musicOn} onChange={toggleMusic} label={t("menu:musicAriaLabel")} />
              </div>
              <div className="flex items-center justify-between gap-3 px-1.5 py-1">
                <span className="text-sm font-semibold text-white">{t("menu:sound")}</span>
                <ToggleSwitch checked={sfxOn} onChange={toggleSfx} label={t("menu:soundAriaLabel")} />
              </div>
            </div>
          )}
        </div>
      </div>

      {langPickerOpen && (
        <LanguagePickerModal
          onClose={() => setLangPickerOpen(false)}
          onLanguageChanged={handleLanguageChanged}
        />
      )}
      {languageToast && (
        <SimpleToast message={languageToast} onClose={() => setLanguageToast(null)} />
      )}

      <span className="app-version-tag absolute top-4 left-4 z-20 select-none leading-tight" aria-hidden="true">
        v{APP_VERSION}<br />{LAST_UPDATE}
      </span>

      <div className="relative z-10 max-w-md mx-auto px-7 py-10 flex flex-col items-center gap-6 pb-14">
        <div className="text-center relative">
          <div className="staff-glow" />
          <ArtImage
            key={avatar.id}
            src={`/assets/avatars/${avatar.id}.png`}
            fallback={avatar.icon}
            alt={avatar.id}
            fetchPriority="high"
            className="relative w-56 sm:w-64 h-56 sm:h-64 mx-auto mb-1 object-contain flex items-center justify-center text-8xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
          />
          <h1 className="font-display gold-text text-4xl font-extrabold mt-2 tracking-wide">{t("common:appTitle")}</h1>
          <p className="text-violet-200 mt-1.5 text-base">{t("common:appSubtitle")}</p>
        </div>

        <div className="w-full grid grid-cols-3 gap-3">
          <div className="menu-resource-pill rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2">
            <StarIcon filled /> <span className="font-extrabold text-xl">{progress.totalStars}</span>
          </div>
          <div className="menu-resource-pill-gold rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2 text-indigo-950">
            <ArtImage src="/assets/icons/ui/coin.png" fallback="🪙" alt="монети" className="w-6 h-6 object-contain inline-flex items-center justify-center" />
            <span className="font-extrabold text-2xl">{progress.coins}</span>
          </div>
          <div className="menu-resource-pill rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2">
            <ArtImage src="/assets/icons/ui/flame.png" fallback="🔥" alt="стрік" className="w-6 h-6 object-contain inline-flex items-center justify-center" />
            <span className="font-extrabold text-xl">{progress.streak.current}</span>
          </div>
        </div>

        <div className="w-full menu-panel rounded-3xl px-5 py-4">
          <div className="flex items-center gap-3.5 mb-2">
            <div className="menu-level-badge w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-indigo-950 text-lg shrink-0">
              {level}
            </div>
            <span className="font-display font-bold text-lg flex-1">{t("menu:heroLevel", { level })}</span>
            <span className="text-sm text-violet-100 font-semibold">{into}/{need} XP</span>
          </div>
          <div className="h-5 menu-xp-track rounded-full relative">
            <div className="h-full menu-xp-fill rounded-full transition-all" style={{ width: `${xpPct}%` }} />
            <span className="menu-xp-glow-dot absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${xpPct}% - 5px)` }} aria-hidden="true" />
          </div>
          {/* Другий (не основний) вхід у "Мої знання" — компактне посилання
              прямо в панелі героя, поруч із досвідом, з яким прогрес
              природно асоціюється. Основний вхід — картка нижче. */}
          <button
            onClick={() => { playUiClick(); onKnowledge(); }}
            className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-violet-200 hover:text-white transition ml-auto"
          >
            <ArtImage src="/assets/icons/ui/book.png" fallback="📖" alt="" className="w-3.5 h-3.5 object-contain inline-flex items-center justify-center" />
            {t("menu:progressLink")}
          </button>
        </div>

        {/* Ненав'язливе нагадування про акаунт (розділ 6 брифу) — лише коли
            вже є користь, яку варто зберегти, ніколи одразу після старту;
            "Не зараз" ховає назавжди (окремий ключ у localStorage). Не
            модальне, не блокує гру, не перекриває "ГРАТИ" нижче. */}
        {showAccountNudge && (
          <div className="w-full rpg-panel rounded-2xl px-4 py-3.5 flex items-center gap-3">
            <ArtImage
              src="/assets/icons/ui/cloud.png"
              fallback="☁️"
              alt=""
              className="w-7 h-7 object-contain flex items-center justify-center text-xl shrink-0"
            />
            <p className="flex-1 text-sm text-violet-100">{t("menu:accountNudgeText")}</p>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button
                onClick={handleNudgeLoginClick}
                className="knowledge-secondary-button rounded-lg px-3 py-1.5 text-xs font-display font-bold"
              >
                {t("menu:accountNudgeLogin")}
              </button>
              <button
                onClick={dismissAccountNudge}
                className="text-[11px] text-violet-300/70 hover:text-white transition"
              >
                {t("menu:notNow")}
              </button>
            </div>
          </div>
        )}

        <div className="w-full menu-panel rounded-3xl pt-8 pb-4 px-4 relative">
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 menu-quest-banner px-8 py-1 whitespace-nowrap">
            <span className="font-display font-bold text-amber-300 text-xs">{t("menu:dailyQuestsBanner")}</span>
          </div>
          <div className="flex flex-col mt-2 divide-y divide-white/10">
            {(progress.daily.activeQuestIds ?? [])
              .map((id) => QUEST_POOL.find((q) => q.id === id))
              .filter(Boolean)
              .map((q) => {
              const p = q.progress(progress.daily);
              const done = progress.daily.claimed.includes(q.id) || p >= q.target;
              return (
                <div key={q.id} className={`flex items-center gap-3 text-sm py-2.5 px-1.5 -mx-1.5 rounded-lg ${done ? "" : "bg-white/[0.03]"}`}>
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 border ${done ? "bg-emerald-600/25 border-emerald-400/50 menu-quest-check-glow" : "bg-indigo-950/60 border-amber-400/30"}`}>
                    {done ? "✅" : q.icon}
                  </span>
                  <span className={`flex-1 ${done ? "text-violet-200/65 line-through decoration-1" : "text-white"}`}>{t(`quests:${q.labelKey}`)}</span>
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 border ${done ? "text-emerald-300 bg-emerald-600/20 border-emerald-400/40" : "text-white/80 menu-quest-badge-active"}`}>
                    {Math.min(p, q.target)}/{q.target}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative w-full">
          <button onClick={() => { playUiPrimary(); onPlay(); }} className="hero-play-button relative w-full min-h-[66px]">
            <span className="hero-play-shine" aria-hidden="true" />
            <span className="relative z-10 grid grid-cols-[1.5rem_1fr_1.5rem] items-center gap-2 px-8 h-full">
              <span className="hero-play-diamond justify-self-start" aria-hidden="true" />
              <span className="hero-play-text font-display font-extrabold text-4xl tracking-wide justify-self-center">{t("menu:play")}</span>
              <span className="hero-play-diamond justify-self-end" aria-hidden="true" />
            </span>
          </button>
          <span className="hero-play-sparkle hero-play-sparkle-tl" aria-hidden="true" />
          <span className="hero-play-sparkle hero-play-sparkle-tr" aria-hidden="true" />
          <span className="hero-play-sparkle hero-play-sparkle-bl" aria-hidden="true" />
          <span className="hero-play-sparkle hero-play-sparkle-br" aria-hidden="true" />
        </div>

        {/* 2×2: "Мої знання" — прогрес/статистика, а не ігровий режим, тож
            стоїть поруч із "Досягнення" (теж прогрес), окремо від
            "Тренування" (де раніше жила помилково, серед мінігор). */}
        <div className="w-full grid grid-cols-2 gap-3">
          <button onClick={() => { playUiClick(); onBadges(); }} className="menu-nav-button rounded-[20px] py-4 flex flex-col items-center gap-1.5">
            <ArtImage src="/assets/icons/ui/trophy.png" fallback="🏆" alt="" className="text-3xl w-9 h-9 object-contain flex items-center justify-center" />
            <span className="font-bold text-sm text-white">{t("menu:navAchievements")}</span>
            {/* Невидимий підпис-заповнювач — лише щоб рядок сітки мав ту
                саму висоту, що й картка "Мої знання" (у якої підпис видимий
                від sm і вище). Сам текст ніколи не бачать (invisible). */}
            <span className="hidden sm:block invisible text-[11px] -mt-1" aria-hidden="true">{t("menu:navKnowledgeSubtitle")}</span>
          </button>
          <button onClick={() => { playUiClick(); onKnowledge(); }} className="menu-nav-button rounded-[20px] py-4 relative flex flex-col items-center gap-1.5">
            {hasNewKnowledge && (
              <span className="menu-nav-badge absolute -top-1.5 -right-1.5 rounded-full px-2 py-0.5 text-[10px] font-display font-extrabold">
                {t("menu:navNewBadge")}
              </span>
            )}
            <ArtImage src="/assets/icons/ui/book.png" fallback="📖" alt="" className="text-3xl w-9 h-9 object-contain flex items-center justify-center" />
            <span className="font-bold text-sm text-white">{t("menu:navKnowledge")}</span>
            <span className="hidden sm:block text-[11px] text-violet-200/70 -mt-1">{t("menu:navKnowledgeSubtitle")}</span>
          </button>
          <button onClick={() => { playUiClick(); onShop(); }} className="menu-nav-button rounded-[20px] py-4 flex flex-col items-center gap-1.5">
            <ArtImage src="/assets/icons/ui/shop.png" fallback="🛍️" alt="" className="text-3xl w-9 h-9 object-contain flex items-center justify-center" />
            <span className="font-bold text-sm text-white">{t("menu:navShop")}</span>
            <span className="hidden sm:block invisible text-[11px] -mt-1" aria-hidden="true">{t("menu:navKnowledgeSubtitle")}</span>
          </button>
          <button onClick={() => { playUiClick(); onTraining(); }} className="menu-nav-button rounded-[20px] py-4 flex flex-col items-center gap-1.5">
            <ArtImage src="/assets/icons/ui/target.png" fallback="🎯" alt="" className="text-3xl w-9 h-9 object-contain flex items-center justify-center" />
            <span className="font-bold text-sm text-white">{t("menu:navTraining")}</span>
            <span className="hidden sm:block invisible text-[11px] -mt-1" aria-hidden="true">{t("menu:navKnowledgeSubtitle")}</span>
          </button>
        </div>

        <a
          className="creator-link"
          href="https://www.instagram.com/ivan_stepanowich"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram автора гри Ivan Stepanowich"
        >
          <span className="creator-link__icon" aria-hidden="true">◎</span>
          <span><span className="creator-link__label">{t("menu:creatorLabel")}</span><strong>@ivan_stepanowich</strong></span>
        </a>
      </div>
    </div>
  );
}
