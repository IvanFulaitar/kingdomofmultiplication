import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AVATARS } from "../data/cosmetics.js";
import { QUEST_POOL } from "../data/rewards.js";
import { heroLevelFromXp } from "../game/progress.js";
import { isSoundEnabled, setSoundEnabled } from "../game/sound.js";
import { isMusicEnabled, setMusicEnabled } from "../game/music.js";
import { useInstallFlow } from "../hooks/useInstallFlow.js";
import { playUiClick, playUiPrimary } from "../game/sfx.js";
import { APP_VERSION, LAST_UPDATE } from "../version.js";
import { SUPPORTED_LANGUAGES } from "../i18n/index.js";
import { AUTH_ENABLED } from "../config.js";
import StarIcon from "../components/StarIcon.jsx";
import ArtImage from "../components/ArtImage.jsx";
import LanguagePickerModal from "../components/LanguagePickerModal.jsx";
import IosInstallModal from "../components/IosInstallModal.jsx";
import OpenInSafariModal from "../components/OpenInSafariModal.jsx";
import SimpleToast from "../components/SimpleToast.jsx";

// Суто візуальний повзунок — сам не клікабельний (клік/aria-стан обробляє
// button-обгортка нижче, в попапі налаштувань). Раніше сам перемикач був
// окремою <button> лише 44×24px — на реальному тачскрін-екрані це занадто
// вузька ціль по вертикалі для дитини 10-12 років; тепер тапабельна вся
// смуга рядка (як інші рядки в цьому попапі — installGame/language).
function ToggleSwitch({ checked }) {
  return (
    <span
      aria-hidden="true"
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 ${checked ? "bg-emerald-500/90" : "bg-white/15"}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </span>
  );
}

// Компактна картка "прогрес зберігається на цьому пристрої" (auth-freeze-
// brief.md, розділ 2) — власний версійований ключ, окремо від прогресу й
// від токена, щоб не зачіпати migrateSave()/схему збереження заради
// одного прапорця "вже закрив". Версія в назві (_v1) — щоб для якогось
// майбутнього важливого оновлення повідомлення можна було завести новий
// ключ, а не випадково скинути вже зроблений вибір користувача.
const CLOUD_NOTICE_DISMISSED_KEY = "kingdom-multiplication-cloud-notice-dismissed-v1";

export default function MenuScreen({ progress, onPlay, onBadges, onShop, onTraining, onKnowledge, hasNewKnowledge, user, onAccount }) {
  const { t, i18n } = useTranslation(["menu", "quests", "common"]);
  const avatar = AVATARS.find((a) => a.id === progress.avatar) ?? AVATARS[0];
  const { level, into, need } = heroLevelFromXp(progress.xp);
  const [sfxOn, setSfxOn] = useState(() => isSoundEnabled());
  const [musicOn, setMusicOn] = useState(() => isMusicEnabled());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [languageToast, setLanguageToast] = useState(null);
  const [cloudNoticeDismissed, setCloudNoticeDismissed] = useState(() => {
    try { return localStorage.getItem(CLOUD_NOTICE_DISMISSED_KEY) === "1"; } catch { return true; }
  });
  const [saveInfoOpen, setSaveInfoOpen] = useState(false);
  const {
    canInstall, handleInstallClick: handleInstallFlowClick,
    iosInstallOpen, setIosInstallOpen, openInSafariOpen, setOpenInSafariOpen,
  } = useInstallFlow();
  const settingsRef = useRef(null);
  const settingsToggleRef = useRef(null);
  const xpPct = (into / need) * 100;
  // "math_hero27@gmail.com" -> "math_hero27" — під капотом акаунт і далі
  // працює через email (backend), але дитині показуємо лише зрозумілу
  // "логін"-подібну частину, без технічної адреси пошти на екрані.
  const displayName = user?.email ? user.email.split("@")[0] : "";
  const currentLanguageName = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)?.nativeName ?? "";

  // Компактна картка "прогрес зберігається на цьому пристрої" (auth-
  // freeze-brief.md, розділ 2) — інформаційна, а не заклик увійти (вхід
  // ще вимкнено через AUTH_ENABLED), тож не гейтиться прогресом і не
  // ховається лише для залогінених — показується один раз, поки не
  // закрита, потім запам'ятовується назавжди (окремий ключ у localStorage).
  const showCloudNotice = !AUTH_ENABLED && !cloudNoticeDismissed;

  // Акаунт (email/пароль) — необов'язкова фіча (frontend-backend-
  // integration-plan.md): лише щоб не втратити прогрес при зміні
  // телефону, гра й далі повністю грається без нього. Поки AUTH_ENABLED
  // вимкнено, кнопка веде на сторінку акаунта в стані "У розробці"
  // (AuthScreen.jsx сам показує цей стан) — жодних auth-запитів звідси.
  function handleAccountClick() {
    playUiClick();
    onAccount?.();
  }

  function dismissCloudNotice() {
    setCloudNoticeDismissed(true);
    try { localStorage.setItem(CLOUD_NOTICE_DISMISSED_KEY, "1"); } catch { /* немає localStorage — просто не запам'ятається між сесіями */ }
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

  // "Встановити гру" (launch-plan.md, розділ 14) — розгалуження "яку
  // модалку відкрити" живе в useInstallFlow(). Тут лишається тільки
  // SFX-обгортка.
  async function handleInstallClick() {
    if (sfxOn) playUiClick();
    await handleInstallFlowClick();
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
          aria-label={
            user
              ? t("menu:profileAriaAuthed", { name: displayName })
              : AUTH_ENABLED
                ? t("menu:profileAriaGuest")
                : t("menu:profileAriaComingSoon")
          }
          title={
            user
              ? t("menu:profileTitleAuthed", { name: displayName })
              : AUTH_ENABLED
                ? t("menu:profileTitleGuest")
                : t("menu:profileTitleComingSoon")
          }
          className="system-icon-button rpg-panel w-12 h-12 rounded-xl flex items-center justify-center relative"
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
              className="system-icon-glow w-8 h-8 object-contain flex items-center justify-center text-lg text-amber-100/90"
            />
          )}
          {!AUTH_ENABLED && !user && (
            <span
              aria-hidden="true"
              className="menu-nav-badge absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-display font-extrabold leading-none whitespace-nowrap"
            >
              {t("menu:profileBadgeSoon")}
            </span>
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
              className="system-icon-glow w-8 h-8 object-contain flex items-center justify-center text-lg"
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
                  className="w-8 h-8 object-contain flex items-center justify-center text-base shrink-0"
                />
                <span className="text-sm font-semibold text-white flex-1">{t("menu:language")}</span>
                <span className="text-xs text-violet-300/80">{currentLanguageName}</span>
                <span className="text-violet-300/60 text-xs" aria-hidden="true">›</span>
              </button>

              {canInstall && (
                <>
                  <div className="h-px bg-white/10 my-1.5" />
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="flex items-center gap-2.5 px-1.5 py-2 rounded-lg hover:bg-white/5 transition text-left"
                  >
                    <ArtImage
                      src="/assets/icons/ui/install.png"
                      fallback="📲"
                      alt=""
                      className="w-8 h-8 object-contain flex items-center justify-center text-base shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-white">{t("menu:installGame")}</span>
                      <span className="block text-[11px] text-violet-300/70 leading-snug mt-0.5">{t("menu:installTagline")}</span>
                    </span>
                  </button>
                </>
              )}

              <div className="h-px bg-white/10 my-1.5" />

              <button
                type="button"
                role="switch"
                aria-checked={musicOn}
                aria-label={t("menu:musicAriaLabel")}
                onClick={() => toggleMusic(!musicOn)}
                className="w-full flex items-center justify-between gap-3 px-1.5 py-2.5 rounded-lg hover:bg-white/5 transition text-left"
              >
                <span className="text-sm font-semibold text-white">{t("menu:music")}</span>
                <ToggleSwitch checked={musicOn} />
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={sfxOn}
                aria-label={t("menu:soundAriaLabel")}
                onClick={() => toggleSfx(!sfxOn)}
                className="w-full flex items-center justify-between gap-3 px-1.5 py-2.5 rounded-lg hover:bg-white/5 transition text-left"
              >
                <span className="text-sm font-semibold text-white">{t("menu:sound")}</span>
                <ToggleSwitch checked={sfxOn} />
              </button>

              {/* Постійний ненав'язливий статус (auth-freeze-brief.md, розділ
                  3) — не в центральному ігровому потоці, а тут, у
                  налаштуваннях; клік розгортає коротке пояснення інлайн,
                  без окремої модалки. */}
              <div className="h-px bg-white/10 my-1.5" />
              <button
                type="button"
                onClick={() => setSaveInfoOpen((o) => !o)}
                aria-expanded={saveInfoOpen}
                className="flex items-center gap-2.5 px-1.5 py-2 rounded-lg hover:bg-white/5 transition text-left"
              >
                <ArtImage
                  src="/assets/icons/ui/cloud.png"
                  fallback="☁️"
                  alt=""
                  className="w-8 h-8 object-contain flex items-center justify-center text-base shrink-0"
                />
                <span className="text-sm font-semibold text-white flex-1">{t("menu:localSaveStatus")}</span>
                <span className="text-violet-300/60 text-xs" aria-hidden="true">{saveInfoOpen ? "︿" : "﹀"}</span>
              </button>
              {saveInfoOpen && (
                <p className="px-1.5 pb-1 -mt-0.5 text-xs text-violet-200/75 leading-snug">
                  {t("menu:localSaveExplain")}
                </p>
              )}
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
      {iosInstallOpen && (
        <IosInstallModal onClose={() => setIosInstallOpen(false)} />
      )}
      {openInSafariOpen && (
        <OpenInSafariModal onClose={() => setOpenInSafariOpen(false)} />
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

        {/* Компактна картка "прогрес зберігається на цьому пристрої"
            (auth-freeze-brief.md, розділ 2/14) — чесне пояснення поточного
            стану збереження, а не заклик кудись увійти (форма входу ще
            вимкнена). Закривається назавжди (окремий версійований ключ у
            localStorage). Не модальна, не блокує гру, не перекриває
            "ГРАТИ" нижче. */}
        {showCloudNotice && (
          <div className="w-full rpg-panel rounded-2xl px-4 py-3.5 relative">
            <button
              onClick={dismissCloudNotice}
              aria-label={t("menu:cloudNoticeCloseAria")}
              className="absolute top-1 right-1 w-9 h-9 flex items-center justify-center text-violet-300/60 hover:text-white text-base leading-none transition"
            >
              ×
            </button>
            <div className="flex items-start gap-3 pr-6">
              <ArtImage
                src="/assets/icons/ui/cloud.png"
                fallback="☁️"
                alt=""
                className="w-8 h-8 object-contain flex items-center justify-center text-xl shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-display font-bold text-sm text-white">{t("menu:cloudNoticeTitle")}</span>
                  <span className="menu-nav-badge rounded-full px-2 py-0.5 text-[10px] font-display font-extrabold shrink-0">
                    {t("menu:cloudNoticeBadge")}
                  </span>
                </div>
                <p className="text-xs text-violet-200/80 leading-snug">{t("menu:cloudNoticeSubtitle")}</p>
                <p className="text-xs text-violet-300/60 leading-snug mt-1">{t("menu:cloudNoticeExtra")}</p>
                <button
                  onClick={handleAccountClick}
                  className="mt-2 text-xs font-display font-bold text-amber-300 hover:text-amber-200 transition"
                >
                  {t("menu:cloudNoticeAction")} ›
                </button>
              </div>
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

        {/* Обов'язкові сторінки перед публікацією (launch-plan.md, розділ
            11) — окремі статичні HTML-сторінки в public/ (стабільні
            публічні URL, не залежать від React-роутингу), відкриваються в
            новій вкладці. */}
        <nav aria-label={t("menu:legalNavAriaLabel")} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-2">
          <a href="/about.html" target="_blank" rel="noopener noreferrer" className="legal-footer-link">{t("menu:legalAbout")}</a>
          <span className="legal-footer-dot" aria-hidden="true">·</span>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="legal-footer-link">{t("menu:legalPrivacy")}</a>
          <span className="legal-footer-dot" aria-hidden="true">·</span>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="legal-footer-link">{t("menu:legalTerms")}</a>
          <span className="legal-footer-dot" aria-hidden="true">·</span>
          <a href="/contact.html" target="_blank" rel="noopener noreferrer" className="legal-footer-link">{t("menu:legalContact")}</a>
        </nav>
      </div>
    </div>
  );
}
