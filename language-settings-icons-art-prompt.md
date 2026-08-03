# Промт для генерації іконок (налаштування/мова)

Локалізація (`src/i18n/`) додала перемикач мови в "Налаштування", а сама
кнопка налаштувань перейменована з "звук" на загальні налаштування —
обидва місця поки показують emoji як тимчасову заміну через `ArtImage`
(`src/components/ArtImage.jsx` сама підхопить PNG, щойно файл з'явиться за
потрібним шляхом, без жодних правок коду):

| Де використовується | Emoji зараз | Файл, який чекає компонент |
|---|---|---|
| Кнопка налаштувань (профіль/звук більше не пов'язані), `MenuScreen.jsx` | 🔊/🔇 | `public/assets/icons/ui/gear.png` |
| Рядок "Мова" в попапі налаштувань, `MenuScreen.jsx` | 🌐 | `public/assets/icons/ui/globe.png` |
| Кнопка мови на першому екрані onboarding, `OnboardingScreen.jsx` | 🌐 | той самий `public/assets/icons/ui/globe.png` |

Формат — той самий, що й у решти `icons/ui/`: квадрат, прозорий фон (PNG),
фінальний розмір ~128×128 (генерувати краще у вищій роздільності, напр.
512×512, і зменшити).

## Спільний стиль (обов'язково для обох)

Скопіювати в промт до кожної іконки нижче:

> Fantasy RPG game icon for a children's math game, painted/hand-illustrated
> style (NOT flat vector, NOT flat emoji, NOT line-art), warm soft lighting
> from the upper-left, thin engraved gold outline around the silhouette,
> subtle soft glow, deep indigo-violet base tones (#1e1338 / #312e81 family)
> with golden-amber accents (#f5b942 family), slightly rounded friendly
> shapes suitable for a 10–12 year old audience, centered composition with
> even padding on all sides, transparent background, square canvas, no
> text, no watermark, no background scenery — icon only.

Перед фінальним затвердженням — покласти новий файл поруч із вже наявними
(`star.png`, `book.png`, `user.png`) і звірити візуально: та сама товщина
золотої лінії, та сама "теплота" світіння, той самий рівень деталізації.

## 1. `gear.png` — загальні налаштування

> A stylized fantasy cog/gear symbol (like an enchanted clockwork rune, not
> a realistic mechanical gear), simple bold silhouette with 6-8 teeth, thin
> gold outline, painted style per the shared style description above.
> Reads clearly as "settings" at very small sizes (40×40px) — avoid fine
> mechanical detail, keep the outline bold and uncluttered.

## 2. `globe.png` — вибір мови

> A stylized magical globe/sphere symbol with faint painted continent
> shapes and 1-2 thin latitude/longitude lines, small warm golden glow on
> one side, painted style per the shared style description above. Must
> read as neutral/international "language" — NOT a flag of any specific
> country. Reads clearly as "language switch" at small sizes.

## Після генерації

1. Покласти файли в `public/assets/icons/ui/` під точними назвами вище.
2. Нічого в коді міняти не треба — `ArtImage` сам перестане показувати
   emoji, щойно знайде файл за шляхом `/assets/icons/ui/<назва>.png`.
3. Оновити `public/assets/README.md` (прибрати ці дві з "emoji-фолбек" і
   додати до списку `icons/ui/`).
