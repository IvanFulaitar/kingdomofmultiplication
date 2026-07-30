import { useEffect, useState, Suspense, lazy } from "react";
import { BADGES } from "./data/rewards.js";
import { LEVEL_META } from "./data/regions.js";
import { getWeakFacts } from "./game/generateQuestion.js";
import {
  loadProgress, saveProgress, ensureDaily, checkQuests,
  starsForMistakes, heroLevelFromXp,
} from "./game/progress.js";

// MenuScreen — перше, що бачить гравець, тому вантажиться одразу.
// Решта екранів — лениво (code-splitting), щоб на старті не тягнути
// JS усіх ігрових режимів, які людина, можливо, ще не відкриє.
import MenuScreen from "./screens/MenuScreen.jsx";
import BadgeToast from "./components/BadgeToast.jsx";
const ShopScreen = lazy(() => import("./screens/ShopScreen.jsx"));
const TrainingScreen = lazy(() => import("./screens/TrainingScreen.jsx"));
const MemoryScreen = lazy(() => import("./screens/MemoryScreen.jsx"));
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
  const [outcome, setOutcome] = useState(null);
  const [showBadges, setShowBadges] = useState(false);
  const [newBadge, setNewBadge] = useState(null);

  // localStorage читається синхронно, тому завантаження прогресу тут
  // не потребує async/await (на відміну від артефактної версії).
  useEffect(() => {
    setProgress(loadProgress());
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

  function buyAvatar(av) {
    const owned = progress.ownedAvatars.includes(av.id);
    if (!owned && progress.coins < av.cost) return;
    persist({
      ...progress,
      avatar: av.id,
      coins: owned ? progress.coins : progress.coins - av.cost,
      ownedAvatars: owned ? progress.ownedAvatars : [...progress.ownedAvatars, av.id],
    });
  }

  function recordFact(pair, correct, kind) {
    let p = ensureDaily(progress);
    if (kind !== "combined") {
      const existing = p.facts?.[pair] ?? { correct: 0, wrong: 0 };
      const key = correct ? "correct" : "wrong";
      p = { ...p, facts: { ...p.facts, [pair]: { ...existing, [key]: existing[key] + 1 } } };
    }
    if (correct) {
      p = { ...p, daily: { ...p.daily, correctToday: p.daily.correctToday + 1 } };
    }
    p = checkQuests(p);
    persist(p);
  }

  function rewardPractice(coinGain, xpGain) {
    let p = ensureDaily(progress);
    p = { ...p, coins: p.coins + coinGain, xp: (p.xp ?? 0) + xpGain };
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
    }
    next = checkQuests(next);
    const newHero = heroLevelFromXp(next.xp);

    persist(next);

    return {
      levelId, stars, newStars, mistakes, coinGain, xpGain,
      leveledUp: newHero.level > prevHero.level,
    };
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
        />
      )}
      <Suspense fallback={<LoadingGate />}>
        {screen === "shop" && (
          <ShopScreen progress={progress} onBuyAvatar={buyAvatar} onBack={() => setScreen("menu")} />
        )}
        {screen === "training" && <TrainingScreen onBack={() => setScreen("menu")} onSelect={(m) => setScreen(m)} />}
        {screen === "memory" && (
          <MemoryScreen
            onBack={() => setScreen("training")}
            onComplete={(coins, xp) => { rewardPractice(coins, xp); setScreen("training"); }}
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
    </main>
  );
}
