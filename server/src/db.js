import { PrismaClient } from "@prisma/client";

// Один спільний інстанс Prisma Client на весь застосунок — НЕ створювати
// новий у кожному роуті/запиті (швидко вичерпає пул з'єднань до Postgres).
// globalThis-кеш потрібен через "npm run dev" (node --watch): без нього
// кожен перезапуск файлу створював би ще один PrismaClient поверх
// попереднього, який ніхто не закрив.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
