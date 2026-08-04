import { useEffect, useRef, useState, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { LEVEL_META } from "./data/regions.js";
import { getWeakFacts } from "./game/generateQuestion.js";
import { hasNewMasteryActivity } from "./game/mastery.js";
import { initMusic } from "./game/music.js";
import { preloadCoreSfx, playAchievementSfx } from "./game/sfx.js";
import { initAnalytics, trackEvent } from "./game/analytics.js";
import { logout as authLogout, fetchMe } from "./game/auth.js";
import { AUTH_ENABLED } from "./config.js";
import {
  loadProgress, saveProgress, todaysTrainingWins,
  takeLoadWarning, recordActivity,
} from "./game/progress.js";
// Доменні редьюсери (обчислення "наступного progress") — чисті функції,
// винесені з App.jsx (roles-and-architecture-plan.md, розділ 22.3/40,
// крок 1). App.jsx лишає собі виклик + persist()/тости/звук/аналітику.
import * as reducers from "./game/reducers.js";

// MenuScreen — перше, що бачить гравець, тому вантажиться одразу.
// Решта екранів — лениво (code-splitting), щоб на старті не тягнути
// JS усіх ігрових режимів, які людина, можливо, ще не відкриє.
import MenuScreen from "./screens/MenuScreen.jsx";
import BadgeToast from "./components/BadgeToast.jsx";
import SaveNoticeToast from "./components/SaveNoticeToast.jsx";
import UpdateBanner from "./components/UpdateBanner.jsx";
const OnboardingScreen = lazy(() => import("./screens/OnboardingScreen.jsx"));
const MyKnowledgeScreen = lazy(() => import("./screens/MyKnowledgeScreen.jsx"));
const ParentScreen = lazy(() => import("./screens/ParentScreen.jsx"));
const ShopScreen = lazy(() => import("./screens/ShopScreen.jsx"));
const TrainingScreen = lazy(() => import("./screens/TrainingScreen.jsx"));
const MemoryScreen = lazy(() => import("./screens/MemoryScreen.jsx"));
const MazeScreen = lazy(() => import("./screens/MazeScreen.jsx"));
const RaceDifficultyScreen = lazy(() => import("./screens/RaceDifficultyScreen.jsx"));
const RaceScreen = lazy(() => import("./screens/RaceScreen.jsx"));
const MapScreen = lazy(() => import("./screens/MapScreen.jsx"));
const AuthScreen = lazy(() => import("./screens/AuthScreen.jsx"));
const GameScreen = lazy(() => import("./screens/GameScreen.jsx"));
const ResultsScreen = lazy(() => import("./screens/ResultsScreen.jsx"));
const BadgesModal = lazy(() => import("./components/BadgesModal.jsx"));

function LoadingGate() {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-dvh bg-indigo-950 flex items-center justify-center">
      <div className="font-body text-amber-300 text-lg animate-pulse">{t("openingGates")}</div>
    </div>
  );
}

export default function App() {
  const [progress, setProgress] = useState(null);
  const [screen, setScreen] = useState("menu");
  // Акаунт (email/пароль, frontend-backend-integration-plan.md) —
  // необов'язкова фіча: null означає гостя, гра й далі повністю грається
  // без входу. Відновлюється при старті нижче (useEffect із fetchMe()),
  // якщо AUTH_ENABLED.
  const [user, setUser] = useState(null);
  // roles-and-architecture-plan.md, розділ 40, крок 2 (Стадія A) —
  // frontend-backend-integration-plan.md, Крок 4: відновлення сесії при
  // старті через fetchMe() (функція в auth.js була написана давно, але
  // ніде не викликалась). Поки AUTH_ENABLED=false — жодного мережевого
  // виклику взагалі не відбувається, sessionChecked одразу true, тож
  // гість, що не користується акаунтом, нічого не помічає (нуль затримки).
  const [sessionChecked, setSessionChecked] = useState(!AUTH_ENABLED);
  const [activeLevel, setActiveLevel] = useState(null);
  const [raceDifficulty, setRaceDifficulty] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [showBadges, setShowBadges] = useState(false);
  const [newBadge, setNewBadge] = useState(null);
  const [saveWarning, setSaveWarning] = useState(null);
  const saveFailureShownRef = useRef(false);
  // "Мої знання" тепер відкривається з трьох різних місць (головна кнопка
  // навігації, кнопка "Прогрес" у панелі героя, другорядне посилання в
  // "Тренуванні") — знаємо, куди повертатись по "Назад", не прив'язуючи цей
  // екран назавжди лише до одного з них.
  const [knowledgeReturn, setKnowledgeReturn] = useState("menu");

  // localStorage читається синхронно, тому завантаження прогресу тут
  // не потребує async/await (на відміну від артефактної версії).
  useEffect(() => {
    const p = loadProgress();
    setProgress(p);
    // Якщо loadProgress() довелося відновлювати з backup або скидати
    // через пошкоджений запис — показати про це один раз, одразу після
    // старту (див. src/game/progress.js).
    setSaveWarning(takeLoadWarning());
    // Перший запуск нового гравця (launch-plan.md, розділ 4) — показуємо
    // онбординг замість головного екрана. Старі збереження мігрують з
    // onboardingComplete=true (progress.js), тож нинішні гравці цього не
    // побачать.
    if (!p.onboardingComplete) setScreen("onboarding");
  }, []);

  // Відновлення дорослої сесії при старті (Крок 4, див. коментар біля
  // sessionChecked вище) — якщо токен у localStorage ще дійсний, гравець
  // одразу залогінений без повторного вводу пароля; якщо прострочений/
  // недійсний, fetchMe() сама тихо чистить токен і повертає null (без
  // тривожних помилок дитині). Мережева помилка (сервер тимчасово
  // недоступний тощо) — токен НЕ чиститься, просто цього разу лишаємось
  // гостем поточного сеансу; наступний запуск спробує знову.
  useEffect(() => {
    if (!AUTH_ENABLED) return;
    let cancelled = false;
    fetchMe()
      .then((u) => { if (!cancelled) setUser(u); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSessionChecked(true); });
    return () => { cancelled = true; };
  }, []);

  // Фонова тема стартує один раз на весь час життя застосунку — вона не
  // перезапускається під час навігації між екранами (лише трохи змінює
  // гучність/темп, див. setMusicIntensity у GameScreen/MazeScreen/RaceScreen).
  useEffect(() => {
    initMusic();
    preloadCoreSfx();
    initAnalytics(); // no-op, поки ANALYTICS_ENABLED=false (src/config.js)
  }, []);

  // Без цього перехід між екранами лишає стару прокрутку сторінки,
  // тому новий екран на мить "сіпається", підлаштовуючи скрол під
  // свою (іншу) висоту.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  function persist(rawNext) {
    // launch-plan.md, розділ 8 — тут, а не в кожному окремому обробнику
    // (recordFact/completeLevel/completeMaze/...), бо persist() — єдина
    // точка, через яку проходить УСЯ ігрова активність. recordActivity сама
    // ідемпотентно оновлює "сьогоднішній" запис activityLog за розривом від
    // попереднього виклику (progress.js:SESSION_GAP_MS).
    const next = recordActivity(rawNext);
    setProgress(next);
    const ok = saveProgress(next);
    // Показуємо попередження про невдалий запис (напр. QuotaExceededError,
    // сховище переповнене) не більше одного разу за сеанс — інакше кожна
    // наступна дія (клік, покупка) знову й знову спливала б тим самим
    // тостом, поки місце на диску не звільниться. Сам прогрес у пам'яті не
    // втрачається, тож гра продовжується нормально навіть без диска.
    if (!ok && !saveFailureShownRef.current) {
      saveFailureShownRef.current = true;
      setSaveWarning("save-failed");
    }
  }

  // Показує тост+звук за нововідкриті бейджі (launch-plan.md, розділ 21) —
  // спільний хвостик для КОЖНОГО редьюсера, що може розблокувати бейдж
  // (рівень, лабіринт, перегони, "Мої знання"/тренування слабких
  // прикладів, покупка аватара). Сам розрахунок "що розблокувалось" —
  // чиста функція reducers.checkBadges(), викликана з тіла кожного
  // редьюсера нижче; тут лишається рівно побічний ефект (UI+звук).
  function showEarnedBadges(earnedBadges) {
    if (!earnedBadges.length) return;
    setNewBadge(earnedBadges[0]);
    playAchievementSfx();
  }

  // Купівля й вибір аватара — окремі дії (щоб магазин міг спершу показати
  // модалку підтвердження, і лише після явного натискання "Придбати"
  // списати монети — випадковий тап більше не витрачає їх одразу).
  // Списання монет і додавання до ownedAvatars — один виклик persist(),
  // тож це завжди єдина атомарна операція, без проміжного "напівкупленого" стану.
  function purchaseAvatar(avatarId) {
    const result = reducers.purchaseAvatar(progress, avatarId);
    showEarnedBadges(result.earnedBadges);
    if (result.changed) {
      persist(result.progress);
      trackEvent("avatar_purchased", { avatarId, cost: result.cost });
    }
    return result.success;
  }

  function selectAvatar(avatarId) {
    const next = reducers.selectAvatar(progress, avatarId);
    if (next !== progress) persist(next); // непридбаний аватар — reducers.selectAvatar повертає той самий progress, нічого не пишемо
  }

  function recordFact(pair, correct, kind, responseTimeMs) {
    const { progress: next, earnedBadges } = reducers.recordFact(progress, pair, correct, kind, responseTimeMs);
    showEarnedBadges(earnedBadges);
    persist(next);
  }

  function rewardPractice(coinGain, xpGain, pairsFound = 0) {
    const { progress: next, earnedBadges } = reducers.rewardPractice(progress, coinGain, xpGain, pairsFound);
    showEarnedBadges(earnedBadges);
    persist(next);
  }

  // Окремо від rewardPractice — рахує ще й кількість пройдених лабіринтів,
  // щоб наступна спроба могла плавно підвищити складність (нові механіки
  // з'являються поступово, а не всі одразу). extra — скрині/таємний шлях
  // цього конкретного проходження, для щоденних завдань mazeChest1/mazeSecret1.
  function completeMaze(coinGain, xpGain, extra = {}) {
    const { progress: next, earnedBadges } = reducers.completeMaze(progress, coinGain, xpGain, extra);
    showEarnedBadges(earnedBadges);
    persist(next);
  }

  // Складність тепер обирає сам гравець (RaceDifficultyScreen) — тут лише
  // нараховуємо нагороду й ведемо бухгалтерію: історію останніх заїздів
  // (для рекомендації складності наступного разу), особисті рекорди,
  // розблокування чемпіонського заїзду, лічильник сьогоднішніх перемог
  // тренувального заїзду (м'який захист від фарму) — усе в reducers.completeRace.
  function completeRace(coinGain, xpGain, meta) {
    const { progress: next, earnedBadges } = reducers.completeRace(progress, coinGain, xpGain, meta);
    showEarnedBadges(earnedBadges);
    persist(next);
    if (meta) trackEvent("race_finished", meta);
  }

  // Завершення онбордингу (launch-plan.md, розділ 4) — приходить рівно
  // один раз, від OnboardingScreen.jsx.
  function completeOnboarding({ facts, confidenceLevel }) {
    const next = reducers.completeOnboarding(progress, { facts, confidenceLevel });
    persist(next);
    setScreen("menu");
  }

  // На відміну від інших дій, тут потрібно повернути короткий підсумок
  // (скільки зірок/монет/XP отримано, чи піднявся рівень героя), щоб
  // екран результатів міг одразу його показати й анімувати.
  function completeLevel(levelId, mistakes) {
    const { progress: next, earnedBadges, result } = reducers.completeLevel(progress, levelId, mistakes);
    showEarnedBadges(earnedBadges);
    persist(next);
    trackEvent("level_completed", { levelId: result.levelId, stars: result.stars, mistakes: result.mistakes });
    return result;
  }

  // Розділ 21: фіксує "щойно програно рівень N" — completeLevel() вище
  // звіряє з цим при наступній перемозі для бейджа "Повернувся після
  // поразки й переміг". Окрема функція (не всередині onGameOver прямо),
  // бо це єдине місце, де програш узагалі торкається progress/persist —
  // досі onGameOver лише надсилав аналітику, нічого не зберігаючи.
  function recordLevelFailure(levelId) {
    persist(reducers.recordLevelFailure(progress, levelId));
  }

  // Відмічає, що гравець щойно бачив свій прогрес (лише для бейджа "Нове"
  // на головному екрані, див. hasNewMasteryActivity у mastery.js) — не
  // критична дія, тож немає сенсу писати таймстемп, якщо він уже свіжіший
  // (наприклад, повторний виклик з того самого рендера).
  function markKnowledgeSeen() {
    const next = reducers.markKnowledgeSeen(progress);
    if (next !== progress) persist(next);
  }

  function openKnowledge(returnTo) {
    markKnowledgeSeen();
    setKnowledgeReturn(returnTo);
    setScreen("knowledge");
  }

  function handleAuthenticated(authedUser) {
    setUser(authedUser);
    setScreen("menu");
  }

  function handleLogout() {
    authLogout();
    setUser(null);
  }

  function startNextChallenge(levelId) {
    if (levelId && LEVEL_META[levelId]) {
      setActiveLevel(levelId);
      setScreen("game");
    } else {
      setScreen("map");
    }
  }

  if (!progress || !sessionChecked) {
    return <LoadingGate />;
  }

  return (
    <main
      className="min-h-dvh bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 font-body text-white bg-cover bg-center bg-app-main"
    >
      {screen === "menu" && (
        <MenuScreen
          progress={progress}
          onPlay={() => setScreen("map")}
          onBadges={() => setShowBadges(true)}
          onShop={() => setScreen("shop")}
          onTraining={() => { trackEvent("training_started"); setScreen("training"); }}
          onKnowledge={() => openKnowledge("menu")}
          hasNewKnowledge={hasNewMasteryActivity(progress.facts, progress.knowledgeLastSeenAt ?? 0)}
          user={user}
          onAccount={() => setScreen("auth")}
          onParent={() => setScreen("parent")}
        />
      )}
      <Suspense fallback={<LoadingGate />}>
        {screen === "onboarding" && (
          <OnboardingScreen onComplete={completeOnboarding} />
        )}
        {screen === "parent" && (
          <ParentScreen progress={progress} onBack={() => setScreen("menu")} />
        )}
        {screen === "shop" && (
          <ShopScreen
            progress={progress}
            onPurchaseAvatar={purchaseAvatar}
            onSelectAvatar={selectAvatar}
            onBack={() => setScreen("menu")}
          />
        )}
        {screen === "training" && (
          <TrainingScreen
            onBack={() => setScreen("menu")}
            onSelect={(m) => {
              // "Мої знання" — не тренувальний режим (не веде через
              // спільний "Грати"-роутинг нижче), лише окреме посилання на
              // прогрес; onBack звідти має повернути саме в "Тренування".
              if (m === "knowledge") { openKnowledge("training"); return; }
              setScreen(m === "race" ? "raceDifficulty" : m);
            }}
          />
        )}
        {screen === "knowledge" && (
          <MyKnowledgeScreen
            progress={progress}
            onBack={() => setScreen(knowledgeReturn)}
            onAnswer={recordFact}
            onReward={rewardPractice}
          />
        )}
        {screen === "memory" && (
          <MemoryScreen
            onBack={() => setScreen("training")}
            onComplete={(coins, xp, pairsFound) => { rewardPractice(coins, xp, pairsFound); setScreen("training"); }}
          />
        )}
        {screen === "maze" && (
          <MazeScreen
            avatar={progress.avatar}
            completions={progress.mazeCompletions ?? 0}
            onBack={() => setScreen("training")}
            onComplete={(coins, xp, extra) => { completeMaze(coins, xp, extra); setScreen("training"); }}
          />
        )}
        {screen === "raceDifficulty" && (
          <RaceDifficultyScreen
            progress={progress}
            onBack={() => setScreen("training")}
            onStart={(difficultyId) => { trackEvent("race_difficulty_selected", { difficultyId }); setRaceDifficulty(difficultyId); setScreen("race"); }}
          />
        )}
        {screen === "race" && (
          <RaceScreen
            avatar={progress.avatar}
            difficulty={raceDifficulty}
            trainingWinsToday={todaysTrainingWins(progress)}
            bestScore={progress.raceBest?.[raceDifficulty] ?? 0}
            onBack={() => setScreen("training")}
            onComplete={(coins, xp, meta) => { completeRace(coins, xp, meta); setScreen("training"); }}
            onChangeDifficulty={() => setScreen("raceDifficulty")}
          />
        )}
        {screen === "auth" && (
          <AuthScreen
            user={user}
            avatarId={progress.avatar}
            onBack={() => setScreen("menu")}
            onAuthenticated={handleAuthenticated}
            onLogout={handleLogout}
          />
        )}
        {screen === "map" && (
          <MapScreen
            progress={progress}
            onBack={() => setScreen("menu")}
            onSelect={(id) => { setActiveLevel(id); setScreen("game"); }}
          />
        )}
        {screen === "game" && (
          <GameScreen
            levelId={activeLevel}
            avatar={progress.avatar}
            weakFacts={getWeakFacts(progress.facts)}
            onAnswer={recordFact}
            onExit={() => setScreen("map")}
            onFinish={(mistakes) => {
              const result = completeLevel(activeLevel, mistakes);
              setOutcome({ won: true, ...result });
              setScreen("results");
            }}
            onGameOver={(correctCount) => {
              recordLevelFailure(activeLevel);
              trackEvent("level_failed", { levelId: activeLevel, correctCount });
              setOutcome({ won: false, levelId: activeLevel, correctCount });
              setScreen("results");
            }}
          />
        )}
        {screen === "results" && (
          <ResultsScreen
            outcome={outcome}
            progress={progress}
            onNextChallenge={startNextChallenge}
            onRetry={() => setScreen("game")}
            onContinue={() => setScreen("map")}
          />
        )}
        {showBadges && <BadgesModal progress={progress} onClose={() => setShowBadges(false)} />}
      </Suspense>
      {newBadge && <BadgeToast badge={newBadge} onClose={() => setNewBadge(null)} />}
      {saveWarning && <SaveNoticeToast reason={saveWarning} onClose={() => setSaveWarning(null)} />}
      <UpdateBanner />
    </main>
  );
}
