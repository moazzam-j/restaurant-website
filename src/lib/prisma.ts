import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildClient() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  // better-sqlite3 wants a plain filesystem path, not the "file:" prefix Prisma uses.
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl.replace(/^file:/, "") });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
