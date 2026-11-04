import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function isRetryableWriteConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1008", "P2028", "P2034"].includes(error.code);
  }
  return error instanceof Error && /write conflict|deadlock/i.test(error.message);
}

export async function withBedInventoryTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      });
    } catch (error) {
      if (attempt >= 4 || !isRetryableWriteConflict(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}
