// launch-plan.md, розділ 5 "Перетворити тренування на справжню систему
// навчання" — статус засвоєння для кожної таблиці множення:
//   🔴 Потрібно потренувати
//   🟡 Майже засвоєно
//   🟢 Добре знаю
//   ⭐ Майстер
// Дивись src/screens/MyKnowledgeScreen.jsx (де це показується) і
// src/game/progress.js (де факти зберігаються — те саме поле facts, яким
// уже давно користується getWeakFacts()/generateQuestion.js).

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Один факт (наприклад "7×8") -> число 0..100. Формула навмисно проста й
// прозора (не ML): точність дає основну вагу, коротка серія поспіль —
// невеликий бонус, а мало спроб — применшує результат (щоб один вдалий
// здогад одразу не показував "Майстер").
export function computeMastery(stat) {
  if (!stat) return 0;
  const correct = stat.correct ?? 0;
  const wrong = stat.wrong ?? 0;
  const attempts = correct + wrong;
  if (attempts === 0) return 0;

  const accuracy = correct / attempts;
  const streakBonus = Math.min(stat.correctStreak ?? 0, 5) * 4; // до +20
  const confidence = Math.min(attempts / 5, 1); // <5 спроб — результат применшено

  const raw = clamp(accuracy * 80 + streakBonus, 0, 100);
  return Math.round(raw * (0.5 + 0.5 * confidence));
}

const TIERS = [
  { max: 0, tier: "untried", icon: "⚪", label: "Ще не пробували" },
  { max: 39, tier: "weak", icon: "🔴", label: "Потрібно потренувати" },
  { max: 69, tier: "almost", icon: "🟡", label: "Майже засвоєно" },
  { max: 89, tier: "good", icon: "🟢", label: "Добре знаю" },
  { max: 100, tier: "master", icon: "⭐", label: "Майстер" },
];

// attempts===0 -> окремий нейтральний статус "Ще не пробували" (не 🔴 —
// дитина ще навіть не бачила цю таблицю, немає сенсу казати "треба
// потренувати" те, з чим вона ще не стикалась).
export function masteryStatus(score, attempts = 0) {
  if (attempts === 0) return TIERS[0];
  if (score <= 39) return TIERS[1];
  if (score <= 69) return TIERS[2];
  if (score <= 89) return TIERS[3];
  return TIERS[4];
}

// Прогрес зберігає facts за буквальним pair ("7x8" АБО "8x7" — залежно від
// того, як приклад був згенерований, порядок множників не нормалізується
// при записі). Для екрана "Мої знання" агрегуємо ВСІ факти, де задане
// число — один із двох множників, байдуже, у якому порядку.
export function factsForTable(facts, number) {
  const result = [];
  for (const [pair, stat] of Object.entries(facts ?? {})) {
    const m = /^(\d+)x(\d+)$/.exec(pair);
    if (!m) continue; // не "combined"/"compare" — лише прості факти
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === number || b === number) result.push(stat);
  }
  return result;
}

// Агрегований статус для цілої таблиці (наприклад, усе, де множник — 7):
// зважене за кількістю спроб середнє з mastery кожного окремого факту.
export function tableMastery(facts, number) {
  const stats = factsForTable(facts, number);
  const totalAttempts = stats.reduce((s, st) => s + (st.correct ?? 0) + (st.wrong ?? 0), 0);
  if (totalAttempts === 0) return { score: 0, attempts: 0, ...masteryStatus(0, 0) };

  const weightedSum = stats.reduce((s, st) => {
    const attempts = (st.correct ?? 0) + (st.wrong ?? 0);
    return s + computeMastery(st) * attempts;
  }, 0);
  const score = Math.round(weightedSum / totalAttempts);
  return { score, attempts: totalAttempts, ...masteryStatus(score, totalAttempts) };
}
