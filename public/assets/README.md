# Довідник по графіці й звуку

Усі файли нижче вже на місці — це радше довідник "що є і за що відповідає",
ніж список на майбутнє. Компонент `ArtImage` (`src/components/ArtImage.jsx`)
все одно тихо замінить будь-який файл на emoji, якщо його раптом не буде —
нічого не зламається, якщо колись знадобиться перегенерувати щось одне.

## avatars/ — портрет героя (квадрат, прозорий фон, ~256×256)
`wizard, knight, dragon, archer, sorceress, paladin, ninja, barbarian,
necromancer, monk, pirate, beastmaster, alchemist, samurai, fairy, golem` — 16 аватарів магазину.

## monsters/ — ілюстрація ворога на екрані бою (квадрат, ~256×256)
`1.png … 12.png` — номер = ID рівня (напр. `monsters/7.png` — Вартовий замку);
`2.png`/`4.png` також перевикористані як суперники в "Перегонах".

## backgrounds/ — фонові ілюстрації (широкі)
- `app_bg.png` — фон усього застосунку (позаду кожного екрана).
- `A.png`, `B.png`, `C.png`, `D.png` — фон регіону на карті (Ліс Новачків /
  Гори Хоробрих / Замок Майстра / Вежа Мудреця).

## frames/ — рамка профілю навколо аватара
Зарезервовано на майбутнє — зараз рамка малюється CSS (`.avatar-medallion`
в `index.css`), файлів тут поки немає.

## icons/ui/ — дрібні іконки інтерфейсу (квадрат, прозорий фон, ~128×128)
`star, coin, flame, lock, trophy, shop, target, chest, heart_full,
heart_empty, map_scroll, hint_lightbulb, book, user, eye_open, eye_closed,
cloud` — останні 4 для акаунта/профілю (`MenuScreen.jsx`/`AuthScreen.jsx`),
див. `account-icons-art-prompt.md`.

## icons/achievements/ — іконки бейджів досягнень
`medal, diamond, tree, mountains, castle, brain, crown, streak_fire`.

## icons/knowledge/ — статус засвоєння в "Моїх знаннях" (квадрат, ~128×128)
`knowledge_untried, knowledge_weak, knowledge_almost, knowledge_good,
knowledge_master` — 5 рівнів (⚪🔴🟡🟢⭐ емодзі-фолбек у mastery.js), кристал
змінює колір/сяйво від тьмяно-сірого до золотої зірки-майстра.

## icons/maze/ — об'єкти й позначки в режимі "Лабіринт"
`key, trap, portal, shield, lightning` — ключ/пастка/портал і два кутові
значки безпечного/ризикованого шляху на розвилках.

## audio/music/ — фонова тема
`main_theme.mp3` + `main_theme.ogg` (той самий трек у двох форматах для
сумісності) — безшовний луп ~77с через Web Audio (`src/game/music.js`).

## audio/sfx/ — бібліотека коротких звукових ефектів (36 файлів)
Повний список і призначення кожного — у `src/game/sfx.js` (група `CORE` +
`GROUPS.rewards/combat/maze/race/memory`). Приклади: `ui_click, ui_primary,
ui_back, answer_correct, answer_wrong, coin, star, xp_gain, level_up,
victory, defeat, card_flip, pair_match, maze_move, key_pickup, race_start,
race_finish` тощо.
