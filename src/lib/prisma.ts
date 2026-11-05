import { PrismaClient } from "@prisma/client";
import { runtimeDatabaseUrl } from "./database-url";

import { safeErrorMetadata } from "./database-errors";

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient; prismaReset?: Promise<void> };
const datasourceUrl = runtimeDatabaseUrl(process.env.DATABASE_URL);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : [],
});

globalForPrisma.prisma = prisma;
export async function resetPrismaConnection(): Promise<void> {
  if (!globalForPrisma.prismaReset) {
    globalForPrisma.prismaReset = prisma.$disconnect()
      .catch((error: unknown) => {
        console.error("[database] Prisma pool reset failed", safeErrorMetadata(error));
      })
      .finally(() => {
        globalForPrisma.prismaReset = undefined;
      });
  }
  await globalForPrisma.prismaReset;
}
