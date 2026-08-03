# API — легкий бекенд (крок 3: безпека, готово до Railway)

Дивись `../backend-mvp-plan.md` для повного плану. Готово: каркас,
Prisma-схема `User`, health-ендпоінт, register/login/me (bcryptjs +
JWT), і тепер zod-валідація, rate-limit, CORS, helmet, і `start`-скрипт,
готовий для Railway (прогонить міграції перед стартом). Наступний крок
— деплой (`../backend-mvp-plan.md`, розділ 7).

## Локальний запуск

Потрібен встановлений [Node.js](https://nodejs.org) (18+) і доступний
PostgreSQL (локально встановлений, через Docker, чи будь-який хмарний —
підійде будь-що, звідки є `DATABASE_URL`).

```bash
cd server
npm install
cp .env.example .env
# відкрити .env і вписати справжній DATABASE_URL свого Postgres,
# згенерувати JWT_SECRET:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# CORS_ORIGIN можна лишити http://localhost:5173 (адреса Vite dev-сервера)

npx prisma migrate dev --name init   # створює таблицю users
npm run dev                           # старт на http://localhost:3000
```

`npm run dev` не прогонить `prisma migrate deploy` (це робить лише
`npm start`, для Railway) — локально міграції створюються вручну через
`npx prisma migrate dev`, коли схема змінюється.

## Перевірка (curl)

CORS обмежує лише БРАУЗЕРНІ cross-origin запити — curl його не
торкається, усі тести нижче працюють як і раніше.

```bash
# 1. Health — сервер живий і БД відповідає
curl http://localhost:3000/api/health
# {"ok":true,"db":"connected"}

# 2. Реєстрація
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"supersecret123"}'
# 201 {"token":"...", "user":{"id":"...","email":"test@example.com","createdAt":"..."}}

# 3. Повторна реєстрація тим самим email — має впасти зрозуміло
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"supersecret123"}'
# 409 {"error":"Користувач із таким email вже існує"}

# 3b. Некоректний email — zod має відхилити ще до звернення до БД
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"supersecret123"}'
# 400 {"error":"Некоректний email"}

# 3c. Закороткий пароль
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"another@example.com","password":"short"}'
# 400 {"error":"Пароль має містити щонайменше 8 символів"}

# 4. Логін з правильним паролем
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"supersecret123"}'
# 200 {"token":"...", "user":{...}}   — скопіювати token для кроку 6

# 5. Логін з неправильним паролем
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'
# 401 {"error":"Неправильний email або пароль"}

# 6. /me з валідним токеном (підставити токен із кроку 4)
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer ВСТАВИТИ_ТОКЕН_СЮДИ"
# 200 {"user":{...}}

# 7. /me без токена
curl http://localhost:3000/api/auth/me
# 401 {"error":"Потрібен токен авторизації (Authorization: Bearer <token>)"}

# 8. /me з невалідним токеном
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer щось-не-те"
# 401 {"error":"Недійсний або прострочений токен"}

# 9. Rate-limit — 11-й запит на /login за 15 хв з того самого IP
# (повторити крок 5 одинадцять разів поспіль)
# 429 {"error":"Забагато спроб. Спробуй ще раз через кілька хвилин."}
```

Якщо всі відповіді збігаються з коментарями вище — крок 3 працює
коректно.

## Структура

```
server/
├── src/
│   ├── index.js                 Express-застосунок: helmet, CORS, health, роути, error-handler
│   ├── db.js                    спільний Prisma Client
│   ├── routes/
│   │   └── auth.js              POST /register, POST /login, GET /me
│   ├── middleware/
│   │   ├── requireAuth.js       перевірка JWT з заголовка Authorization
│   │   ├── validate.js          валідація req.body проти zod-схеми
│   │   └── authRateLimit.js     rate-limit для /register і /login
│   ├── schemas/
│   │   └── auth.js              zod-схеми register/login
│   └── utils/
│       ├── password.js          hash/verify через bcryptjs
│       └── jwt.js               sign/verify JWT
├── prisma/
│   └── schema.prisma            модель User
├── railway.json                 конфіг деплою (healthcheck, start command)
├── package.json
└── .env.example
```
