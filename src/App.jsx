import { useEffect, useState, Suspense, lazy } from "react";
import { BADGES } from "./data/rewards.js";
import { AVATARS } from "./data/cosmetics.js";
import { LEVEL_META } from "./data/regions.js";
import { getWeakFacts } from "./game/generateQuestion.js";
import { initMusic } from "./game/music.js";
import { preloadCoreSfx, playAchievementSfx } from "./game/sfx.js";
import {
  loadProgress, saveProgress, ensureDaily, checkQuests,
  starsForMistakes, heroLevelFromXp,
  recordRaceResult, todaysTrainingWins,
  takeLoadWarning, exportSaveFile, parseImportedSave,
} from "./game/progress.js";

// MenuScreen — перше, що бачить гравець, тому вантажиться одразу.
// Решта екранів — лениво (code-splitting), щоб на старті не тягнути
// JS усіх ігрових режимів, які людина, можливо, ще не відкриє.
import MenuScreen from "./screens/MenuScreen.jsx";
import BadgeToast from "./components/BadgeToast.jsx";
import SaveNoticeToast from "./components/SaveNoticeToast.jsx";
const ShopScreen = lazy(() => import("./screens/ShopScreen.jsx"));
const TrainingScreen = lazy(() => import("./screens/TrainingScreen.jsx"));
const MemoryScreen = lazy(() => import("./screens/MemoryScreen.jsx"));
const MazeScreen = lazy(() => import("./screens/MazeScreen.jsx"));
const RaceDifficultyScreen = lazy(() => import("./screens/RaceDifficultyScreen.jsx"));
const RaceScreen = lazy(() => import("./screens/RaceScreen.jsx"));
const MapScreen = lazy(() => import("./screens/MapScreen.jsx"));
const GameScreen = lazy(() => import("./screens/GameScreen.jsx"));
const ResultsScreen = lazy(() => import("./screens/ResultsScreen.jsx"));
const BadgesModal = lazy(() => import("./components/BadgesModal.jsx"));

function LoadingGate() {
  return (
    <div className="min-h-dvh bg-indigo-950 flex items-center justify-center">
      <div className="font-body text-amber-300 text-lg animate-pulse">Відчиняємо ворота королівства…</div>
    </div>
  );
}

export default function App() {
  const [progress, setProgress] = useState(null);
  const [screen, setScreen] = useState("menu");
  const [activeLevel, setActiveLevel] = useState(null);
  const [raceDifficulty, setRaceDifficulty] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [showBadges, setShowBadges] = useState(false);
  const [newBadge, setNewBadge] = useState(null);
  const [saveWarning, setSaveWarning] = useState(null);

  // localStorage читається синхронно, тому завантаження прогресу тут
  // не потребує async/await (на відміну від артефактної версії).
  useEffect(() => {
    setProgress(loadProgress());
    // Якщо loadProgress() довелося відновлювати з backup або скидати
    // через пошкоджений запис — показати про це один раз, одразу після
    // старту (див. src/game/progress.js).
    setSaveWarning(takeLoadWarning());
  }, []);

  // Фонова тема стартує один раз на весь час життя застосунку — вона не
  // перезапускається під час навігації між екранами (лише трохи змінює
  // гучність/темп, див. setMusicIntensity у GameScreen/MazeScreen/RaceScreen).
  useEffect(() => {
    initMusic();
    preloadCoreSfx();
  }, []);

  // Без цього перехід між екранами лишає стару прокрутку сторінки,
  // тому новий екран на мить "сіпається", підлаштовуючи скрол під
  // свою (іншу) висоту.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  function persist(next) {
    setProgress(next);
    saveProgress(next);
  }

  // Купівля й вибір аватара — окремі дії (щоб магазин міг спершу показати
  // модалку підтвердження, і лише після явного натискання "Придбати"
  // списати монети — випадковий тап більше не витрачає їх одразу).
  // Списання монет і додавання до ownedAvatars — один виклик persist(),
  // тож це завжди єдина атомарна операція, без проміжного "напівкупленого" стану.
  function purchaseAvatar(avatarId) {
    if (progress.ownedAvatars.includes(avatarId)) return true; // вже куплений — вважаємо успіхом, монети не чіпаємо
    const av = AVATARS.find((a) => a.id === avatarId);
    if (!av || progress.coins < av.cost) return false;
    persist({
      ...progress,
      coins: progress.coins - av.cost,
      ownedAvatars: [...progress.ownedAvatars, avatarId],
    });
    return true;
  }

  function selectAvatar(avatarId) {
    if (!progress.ownedAvatars.includes(avatarId)) return; // не можна обрати непридбаний
    persist({ ...progress, avatar: avatarId });
  }

  // "combined" (рівні 10-12, ланцюжки дій) і "compare" (порівняння двох
  // виразів, launch-plan.md розділ 7) не відповідають одному факту
  // множення "AxB" — pair у них має інший формат, тож ці kind виключені
  // з facts/table7/weakFixed. "missing" і "wordProblem" — той самий факт
  // у іншому вигляді, тому рахуються як завжди.
  const NON_FACT_KINDS = ["combined", "compare"];

  function recordFact(pair, correct, kind) {
    let p = ensureDaily(progress);
    let weakFixed = false;
    if (!NON_FACT_KINDS.includes(kind)) {
      const existing = p.facts?.[pair] ?? { correct: 0, wrong: 0 };
      // "Слабкий, і щойно виправлений" — фіксуємо ДО оновлення факту нижче,
      // інакше existing уже враховуватиме цю саму правильну відповідь.
      weakFixed = correct && existing.wrong > 0 && existing.wrong >= existing.correct;
      const key = correct ? "correct" : "wrong";
      p = { ...p, facts: { ...p.facts, [pair]: { ...existing, [key]: existing[key] + 1 } } };
    }
    if (correct) {
      p = { ...p, daily: { ...p.daily, correctToday: p.daily.correctToday + 1 } };
      // "pair" для класичних/missing/wordProblem прикладів завжди має
      // вигляд "AxB" — якщо один із множників 7, це відповідь із таблиці
      // на 7 (щоденне завдання table7x5).
      if (!NON_FACT_KINDS.includes(kind) && pair.split("x").includes("7")) {
        p = { ...p, daily: { ...p.daily, table7Today: (p.daily.table7Today ?? 0) + 1 } };
      }
      if (weakFixed) {
        p = { ...p, daily: { ...p.daily, weakFixedToday: (p.daily.weakFixedToday ?? 0) + 1 } };
      }
    }
    p = checkQuests(p);
    persist(p);
  }

  function rewardPractice(coinGain, xpGain, pairsFound = 0) {
    let p = ensureDaily(progress);
    p = {
      ...p,
      coins: p.coins + coinGain,
      xp: (p.xp ?? 0) + xpGain,
      daily: { ...p.daily, memoryPairsToday: (p.daily.memoryPairsToday ?? 0) + pairsFound },
    };
    p = checkQuests(p);
    persist(p);
  }

  // Окремо від rewardPractice — рахує ще й кількість пройдених лабіринтів,
  // щоб наступна спроба могла плавно підвищити складність (нові механіки
  // з'являються поступово, а не всі одразу). extra — скрині/таємний шлях
  // цього конкретного проходження, для щоденних завдань mazeChest1/mazeSecret1.
  function completeMaze(coinGain, xpGain, extra = {}) {
    const { chestsFound = 0, secretFound = false } = extra;
    let p = ensureDaily(progress);
    p = {
      ...p,
      coins: p.coins + coinGain,
      xp: (p.xp ?? 0) + xpGain,
      mazeCompletions: (p.mazeCompletions ?? 0) + 1,
      daily: {
        ...p.daily,
        mazeChestsToday: (p.daily.mazeChestsToday ?? 0) + chestsFound,
        mazeSecretToday: p.daily.mazeSecretToday || secretFound,
      },
    };
    p = checkQuests(p);
    persist(p);
  }

  // Складність тепер обирає сам гравець (RaceDifficultyScreen) — тут лише
  // нараховуємо нагороду й ведемо бухгалтерію: історію останніх 5 заїздів
  // (для рекомендації складності наступного разу), особисті рекорди на
  // кожній складності, розблокування чемпіонського заїзду, і лічильник
  // сьогоднішніх перемог тренувального заїзду (м'який захист від фарму).
  // Також рахує щоденні завдання raceTop2_1/raceBest1.
  function completeRace(coinGain, xpGain, meta) {
    let p = ensureDaily(progress);
    p = {
      ...p,
      coins: p.coins + coinGain,
      xp: (p.xp ?? 0) + xpGain,
      raceCompletions: (p.raceCompletions ?? 0) + 1,
    };
    if (meta) {
      const { p: nextP, isPersonalBest } = recordRaceResult(p, meta);
      p = nextP;
      p = {
        ...p,
        daily: {
          ...p.daily,
          raceTop2Today: meta.place <= 2 ? (p.daily.raceTop2Today ?? 0) + 1 : (p.daily.raceTop2Today ?? 0),
          raceBestToday: p.daily.raceBestToday || isPersonalBest,
        },
      };
    }
    p = checkQuests(p);
    persist(p);
  }

  // На відміну від інших дій, тут потрібно повернути короткий підсумок
  // (скільки зірок/монет/XP отримано, чи піднявся рівень героя), щоб
  // екран результатів міг одразу його показати й анімувати.
  function completeLevel(levelId, mistakes) {
    let p = ensureDaily(progress);
    const newStars = starsForMistakes(mistakes);
    const oldStars = p.levels[levelId]?.stars ?? 0;
    const stars = Math.max(oldStars, newStars);
    const coinGain = Math.max(0, newStars - oldStars) * 10;
    const xpGain = 15 + newStars * 10;
    const levels = { ...p.levels, [levelId]: { stars } };
    const totalStars = Object.values(levels).reduce((s, l) => s + l.stars, 0);
    const prevHero = heroLevelFromXp(p.xp ?? 0);

    let next = {
      ...p, levels, totalStars,
      coins: p.coins + coinGain,
      xp: (p.xp ?? 0) + xpGain,
      daily: { ...p.daily, levelsToday: p.daily.levelsToday + 1, perfectToday: p.daily.perfectToday || mistakes === 0 },
    };

    const earned = BADGES.filter((b) => !p.badges.includes(b.id) && b.check(next));
    if (earned.length) {
      next.badges = [...p.badges, ...earned.map((b) => b.id)];
      setNewBadge(earned[0]);
      playAchievementSfx();
    }
    next = checkQuests(next);
    const newHero = heroLevelFromXp(next.xp);

    persist(next);

    return {
      levelId, stars, newStars, mistakes, coinGain, xpGain,
      leveledUp: newHero.level > prevHero.level,
    };
  }

  // Експорт — просто скачує поточний progress як є, монет/помилок не
  // чіпає. Імпорт замінює ВЕСЬ прогрес, тож підтвердження запитує сам
  // виклик (MenuScreen), ще до звернення сюди; тут лише розбір + запис.
  function exportSave() {
    return exportSaveFile(progress);
  }

  function importSave(text) {
    const result = parseImportedSave(text);
    if (!result.ok) return false;
    persist(result.progress);
    return true;
  }

  function startNextChallenge(levelId) {
    if (levelId && LEVEL_META[levelId]) {
      setActiveLevel(levelId);
      setScreen("game");
    } else {
      setScreen("map");
    }
  }

  if (!progress) {
    return <LoadingGate />;
  }

  return (
    <main
      className="min-h-dvh bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 font-body text-white bg-cover bg-center"
      style={{ backgroundImage: "url(/assets/backgrounds/app_bg.png), linear-gradient(180deg, #1e1b4b, #312e81, #1e1b4b)" }}
    >
      {screen === "menu" && (
        <MenuScreen
          progress={progress}
          onPlay={() => setScreen("map")}
          onBadges={() => setShowBadges(true)}
          onShop={() => setScreen("shop")}
          onTraining={() => setScreen("training")}
          onExportSave={exportSave}
          onImportSave={importSave}
        />
      )}
      <Suspense fallback={<LoadingGate />}>
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
            onSelect={(m) => setScreen(m === "race" ? "raceDifficulty" : m)}
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
            onStart={(difficultyId) => { setRaceDifficulty(difficultyId); setScreen("race"); }}
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
    </main>
  );
}
