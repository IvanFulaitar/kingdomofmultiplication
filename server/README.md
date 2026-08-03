# API — легкий бекенд (крок 1: каркас + БД-схема)

Дивись `../backend-mvp-plan.md` для повного плану. Це поки лише каркас:
Express, Prisma-схема `User`, health-ендпоінт. Автентифікація
(register/login/me) — наступний крок.

## Локальний запуск

Потрібен встановлений [Node.js](https://nodejs.org) (18+) і доступний
PostgreSQL (локально встановлений, через Docker, чи будь-який хмарний —
підійде будь-що, звідки є `DATABASE_URL`).

```bash
cd server
npm install
cp .env.example .env
# відкрити .env і вписати справжній DATABASE_URL свого Postgres

npx prisma migrate dev --name init   # створює таблицю users
npm run dev                           # старт на http://localhost:3000
```

Перевірити, що все працює:

```bash
curl http://localhost:3000/api/health
# {"ok":true,"db":"connected"}
```

Якщо Postgres ще не піднятий/`DATABASE_URL` неправильний — ендпоінт
відповість `503 {"ok":false,"db":"unreachable",...}`, а не впаде мовчки.

## Структура

```
server/
├── src/
│   ├── index.js   Express-застосунок, health-ендпоінт
│   └── db.js       спільний Prisma Client
├── prisma/
│   └── schema.prisma   модель User
├── package.json
└── .env.example
```
