# Промт для генерації іконок (акаунт/профіль)

Зараз ці 4 місця в UI показують звичайні emoji як тимчасову заміну (через
`ArtImage`, `src/components/ArtImage.jsx` — компонент сам підхопить PNG,
щойно файл з'явиться за потрібним шляхом, без жодних правок коду):

| Де використовується | Emoji зараз | Файл, який чекає компонент |
|---|---|---|
| Кнопка профілю (гість), `MenuScreen.jsx` | 👤 | `public/assets/icons/ui/user.png` |
| Пароль видимий, `AuthScreen.jsx` | 👁 | `public/assets/icons/ui/eye_open.png` |
| Пароль прихований, `AuthScreen.jsx` | 🙈 | `public/assets/icons/ui/eye_closed.png` |
| Нагадування про акаунт, `MenuScreen.jsx` | ☁️ | `public/assets/icons/ui/cloud.png` |

Формат — той самий, що й у решти `icons/ui/` (`star.png`, `coin.png`,
`book.png` тощо): квадрат, прозорий фон (PNG), фінальний розмір ~128×128
(генерувати краще у вищій роздільності, напр. 512×512, і зменшити).

## Спільний стиль (обов'язково для всіх чотирьох)

Скопіювати в промт до кожної іконки нижче:

> Fantasy RPG game icon for a children's math game, painted/hand-illustrated
> style (NOT flat vector, NOT flat emoji, NOT line-art), warm soft lighting
> from the upper-left, thin engraved gold outline around the silhouette,
> subtle soft glow, deep indigo-violet base tones (#1e1338 / #312e81 family)
> with golden-amber accents (#f5b942 family), slightly rounded friendly
> shapes suitable for a 10–12 year old audience, centered composition with
> even padding on all sides, transparent background, square canvas, no
> text, no watermark, no background scenery — icon only.

Перед фінальним затвердженням — покласти новий файл поруч із вже
наявними (`star.png`, `book.png`, `coin.png`) і звірити візуально: та сама
товщина золотої лінії, та сама "теплота" світіння, той самий рівень
деталізації. Якщо новий значок випадає зі стилю решти, простіше
перегенерувати з трохи іншим текстом, ніж лишати неоднорідний набір.

## 1. `user.png` — узагальнений силует героя (профіль)

> A simple hooded adventurer's bust silhouette (generic fantasy hero, no
> specific class weapon or hat), shoulders and head only, facing forward,
> painted style per the shared style description above. Should read
> clearly as "a person / account" at very small sizes (40×40px), so keep
> the silhouette bold and uncluttered — avoid fine facial detail.

## 2. `eye_open.png` — пароль видимий

> A stylized magical eye symbol (like an enchanted rune-eye, not a
> realistic human eye), fully open, with a small warm violet-indigo iris
> glow in the center and a thin gold outline, painted style per the shared
> style description above. Reads clearly as "visible / show" at small
> sizes.

## 3. `eye_closed.png` — пароль прихований

> The same stylized magical eye symbol as eye_open.png (same outline
> weight, same palette, same framing) but shown closed — a single soft
> curved gold line where the eye would be, conveying "hidden / closed"
> rather than a realistic closed eyelid. Must clearly pair with
> eye_open.png as the same icon in two states, not a different design.

## 4. `cloud.png` — синхронізація/збереження між пристроями

> A small soft magical cloud shape with a faint golden sparkle or two
> near it (suggesting "save/sync"), painted style per the shared style
> description above, rounded and friendly, no rain, no lightning — just
> a calm cloud with a touch of gold shimmer.

## Після генерації

1. Покласти файли в `public/assets/icons/ui/` під точними назвами вище.
2. Нічого в коді міняти не треба — `ArtImage` сам перестане показувати
   emoji, щойно знайде файл за шляхом `/assets/icons/ui/<назва>.png`.
3. Оновити `public/assets/README.md` (прибрати ці чотири з "emoji-фолбек"
   і додати до списку `icons/ui/`).
