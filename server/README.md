# API — легкий бекенд (крок 2: автентифікація)

Дивись `../backend-mvp-plan.md` для повного плану. Готово: каркас,
Prisma-схема `User`, health-ендпоінт, і тепер register/login/me
(bcryptjs + JWT). Наступний крок — zod-валідація, rate-limit, CORS,
helmet (розділ 5 плану).

## Локальний запуск

Потрібен встановлений [Node.js](https://nodejs.org) (18+) і доступний
PostgreSQL (локально встановлений, через Docker, чи будь-який хмарний —
підійде будь-що, звідки є `DATABASE_URL`).

```bash
cd server
npm install
cp .env.example .env
# відкрити .env і вписати справжній DATABASE_URL свого Postgres
# і згенерувати JWT_SECRET, напр.:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

npx prisma migrate dev --name init   # створює таблицю users
npm run dev                           # старт на http://localhost:3000
```

## Перевірка (curl)

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
```

Якщо всі 8 відповідей збігаються з коментарями вище — автентифікація
працює коректно.

## Структура

```
server/
├── src/
│   ├── index.js               Express-застосунок, health, підключення роутів
│   ├── db.js                  спільний Prisma Client
│   ├── routes/
│   │   └── auth.js            POST /register, POST /login, GET /me
│   ├── middleware/
│   │   └── requireAuth.js     перевірка JWT з заголовка Authorization
│   └── utils/
│       ├── password.js        hash/verify через bcryptjs
│       └── jwt.js             sign/verify JWT
├── prisma/
│   └── schema.prisma          модель User
├── package.json
└── .env.example
```
