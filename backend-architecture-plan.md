# План серверної архітектури «Королівство Математики»

Рекомендація технологічного стеку для переходу від локального
(`localStorage`) прогресу до повноцінного серверного бекенду. Це —
довідковий архітектурний план на майбутнє: **бекенд не блокує перший
публічний реліз** (див. `launch-plan.md`, розділ 24, Етап 4 і далі —
спочатку публічна бета з надійним локальним збереженням, серверна
синхронізація підключається наступним великим оновленням).

## Моя рекомендація

| Частина | Технологія |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + TypeScript + NestJS |
| База даних | PostgreSQL |
| ORM | Prisma |
| Frontend hosting | Cloudflare Pages |
| Backend + БД | Railway |
| API-документація | Swagger/OpenAPI |
| Локальна розробка | Docker Compose |

## Чому саме так

NestJS дасть нормальну структуру серверної частини: модулі, контролери,
сервіси, dependency injection, guards і validation. Він працює на
Node.js, повністю підтримує TypeScript і може використовувати Express
або Fastify. Це хороший перехід від frontend до full-stack без зміни
мови.

PostgreSQL добре підходить для гри, бо тут багато пов'язаних даних:
профіль, прогрес рівнів, монети, покупки, аватари, досягнення,
статистика прикладів і результати перегонів. Транзакції потрібні, щоб,
наприклад, списання монет і видача аватара відбувалися разом або не
відбувалися взагалі. PostgreSQL також підтримує jsonb, що зручно для
гнучкої статистики та snapshot збереження.

Prisma рекомендована замість сирого SQL на старті: вона дає
типобезпечний клієнт, міграції та Prisma Studio для перегляду таблиць.
Пізніше складні запити можна писати через SQL.

## Як це буде виглядати

```
React + Vite PWA
        │
        │ HTTPS / JSON
        ▼
Node.js + NestJS API
        │
        │ Prisma
        ▼
PostgreSQL
```

Приблизна структура репозиторію:

```
kingdom-of-mathematics/
├── apps/
│   ├── web/                 # React + Vite
│   └── api/                 # NestJS
│
├── packages/
│   └── shared/              # Спільні TypeScript-типи
│
├── docker-compose.yml
├── package.json
└── README.md
```

У `shared` можна тримати:

- `UserProfile`
- `GameSave`
- `LevelProgress`
- `PurchaseRequest`
- `RaceResult`
- `SkillStatistics`
- `Achievement`
- `DailyQuest`

Так frontend і backend використовуватимуть однакові типи.

## Де запускати

### Frontend — Cloudflare Pages

Твій React/Vite-сайт добре підійде для Cloudflare Pages:

- підключаєш GitHub;
- кожен push автоматично збирає і публікує сайт;
- отримуєш preview для гілок;
- можна під'єднати свій домен;
- статичні ресурси роздаються через CDN.

Наприклад: `https://kingdom.frontstart.com.ua`

### Backend і PostgreSQL — Railway

На Railway можна розмістити NestJS API та PostgreSQL в одному проєкті.
Railway має окремі офіційні інструкції для NestJS і PostgreSQL та
автоматично визначає Node.js-застосунок під час деплою. Якщо API і БД
розташовані разом, між ними можна використовувати приватну мережу.

Наприклад: `https://api.kingdom.frontstart.com.ua`

Railway зараз має експериментальний безплатний рівень із невеликим
ресурсним кредитом і Hobby-план із мінімальним платежем близько $5 на
місяць, який зараховується в оплату використаних ресурсів. Для невеликої
публічної бети цього зазвичай достатньо.

## Які таблиці потрібні

Не потрібно одразу створювати 30 таблиць. Для першої серверної версії
достатньо такого ядра:

- `users`
- `profiles`
- `game_saves`
- `level_progress`
- `skill_statistics`
- `inventory`
- `coin_transactions`
- `achievements`
- `daily_quests`
- `race_results`

### `profiles`

- `id`
- `user_id`
- `hero_level`
- `xp`
- `coins`
- `stars`
- `streak`
- `selected_avatar_id`
- `created_at`
- `updated_at`

### `level_progress`

- `id`
- `profile_id`
- `level_id`
- `stars`
- `best_accuracy`
- `best_time`
- `attempts`
- `completed_at`

### `skill_statistics`

Окремий запис для кожної пари множення:

- `id`
- `profile_id`
- `first_factor`
- `second_factor`
- `attempts`
- `correct_answers`
- `incorrect_answers`
- `average_response_time`
- `mastery`
- `last_answered_at`

Наприклад, для 7 × 8: `attempts: 14`, `correct: 9`, `incorrect: 5`,
`mastery: 61`.

### `inventory`

- `id`
- `profile_id`
- `item_type`
- `item_id`
- `purchased_at`

### `coin_transactions`

- `id`
- `profile_id`
- `type`
- `amount`
- `balance_before`
- `balance_after`
- `source`
- `idempotency_key`
- `created_at`

Типи операцій: `level_reward`, `daily_reward`, `achievement_reward`,
`race_reward`, `avatar_purchase`, `admin_adjustment`.

### `game_saves`

Тут можна зберігати повний snapshot гри:

- `id`
- `profile_id`
- `save_version`
- `data_jsonb`
- `created_at`
- `updated_at`

Але монети, покупки та нагороди краще дублювати у нормалізованих
таблицях і перевіряти сервером.

## Що обов'язково рахувати на сервері

Не можна довіряти frontend значенням:

```json
{
  "coinsEarned": 10000,
  "xpEarned": 50000
}
```

Клієнт повинен передавати результат:

```json
{
  "levelId": "forest-01",
  "correctAnswers": 7,
  "mistakes": 1,
  "responseTimes": [2.1, 3.4, 1.8],
  "attemptId": "uuid"
}
```

А сервер сам визначає:

- скільки дати монет;
- скільки дати XP;
- скільки зірок;
- чи відкривати досягнення;
- чи виконане щоденне завдання;
- чи можна отримати нагороду повторно.

Купівля аватара повинна проходити в одній транзакції:

1. Перевірити баланс.
2. Перевірити, що аватар ще не придбано.
3. Списати монети.
4. Додати аватар в inventory.
5. Записати coin transaction.
6. Commit.

## Мінімальний API

```
POST   /api/guest
GET    /api/profile
GET    /api/save
PUT    /api/save
POST   /api/levels/:id/start
POST   /api/levels/:id/finish
GET    /api/shop/avatars
POST   /api/shop/avatars/:id/purchase
POST   /api/shop/avatars/:id/select
GET    /api/achievements
GET    /api/daily-quests
POST   /api/daily-quests/:id/claim
POST   /api/training/memory/finish
POST   /api/training/maze/finish
POST   /api/training/race/finish
GET    /api/statistics/skills
GET    /api/statistics/summary
```

NestJS має офіційну інтеграцію зі Swagger/OpenAPI, тому всі endpoints
можна одразу бачити й тестувати через `/api/docs`.

## Як переходити з localStorage

Не потрібно одразу видаляти поточне локальне збереження.

**Етап 1 — публічна бета**

Залишити: `localStorage` + backup + export/import JSON. Сайт уже можна
опублікувати на Cloudflare Pages і тестувати на дітях.

**Етап 2 — гостьовий серверний профіль**

При першому відкритті backend створює: `guestId`, `guestToken`,
`profileId`. Token зберігається локально, а прогрес синхронізується із
сервером. Дитині не потрібно вводити ім'я, email, пароль, дату
народження.

**Етап 3 — профіль дорослого**

Пізніше додати необов'язковий батьківський або вчительський акаунт:
прив'язати прогрес до акаунта. Тоді прогрес можна буде переносити між
телефоном, планшетом і комп'ютером.

## Чи варто використати Supabase

Supabase — хороша альтернатива для максимально швидкого MVP. Один
проєкт дає повноцінний PostgreSQL, Auth, Storage та TypeScript Edge
Functions.

Варіант:

```
React
  ├── Supabase Auth
  ├── Supabase PostgreSQL
  └── Supabase Edge Functions
```

Але для власного full-stack навчання краще все-таки NestJS + PostgreSQL,
тому що:

- це шлях до full-stack developer;
- сервер залишиться звичайним Node.js/TypeScript-проєктом;
- буде практика API, DTO, guards, services і migrations;
- буде простіше переносити backend між хостингами;
- не змішуватимуться NestJS і Supabase Edge Functions одночасно.

Supabase можна використати тільки як керовану PostgreSQL-базу або
залишити як запасний швидкий варіант.

## Що НЕ рекомендується

**MongoDB.** Для цієї гри не варто починати з MongoDB. Тут багато
пов'язаних сутностей і критичних операцій: баланс, покупки, нагороди,
інвентар, прогрес, щоденні завдання, досягнення. PostgreSQL тут
природніше й надійніше.

**Firebase як основна БД.** Firebase дозволить швидко стартувати, але
модель документа може ускладнити: історію транзакцій, агрегацію
статистики, зв'язки між профілем, інвентарем і прогресом, майбутню
аналітику для батьків і вчителів.

**Писати backend одразу на C#.** Node.js/TypeScript дасть швидший
результат для власного проєкту, бо frontend і backend матимуть одну
мову.

## Остаточний вибір

- **Frontend:** React + Vite + TypeScript, Cloudflare Pages.
- **Backend:** Node.js + TypeScript + NestJS, Railway.
- **Database:** PostgreSQL, Railway PostgreSQL.
- **ORM:** Prisma.
- **API docs:** Swagger.
- **Local development:** Docker Compose.
- **Progress:** localStorage як offline-кеш, PostgreSQL як основне
  серверне збереження.

## У якому порядку робити

1. Винести поточну роботу з localStorage у єдиний SaveService.
2. Додати `saveVersion`, backup та migrations.
3. Створити NestJS-проєкт.
4. Підключити PostgreSQL і Prisma.
5. Реалізувати гостьовий профіль.
6. Додати синхронізацію save.
7. Перенести на сервер покупки й нагороди.
8. Додати статистику прикладів.
9. Розгорнути API і PostgreSQL на Railway.
10. Розгорнути React/PWA на Cloudflare Pages.

**Для першого запуску backend не повинен блокувати реліз.** Спочатку
можна відкрити публічну бету з надійним локальним збереженням, а
серверну синхронізацію підключити наступним великим оновленням.

Кроки 1–2 цього списку буквально збігаються з пунктом P0 "Надійне
збереження" і Етапом 1 у `launch-plan.md` — їх можна й варто робити вже
зараз, ще до появи будь-якого сервера.
