import { Prisma, type PrismaClient } from "@/generated/prisma/client";

const STARTING_ORDER_NUMBER = 1001;

/**
 * Assigns the next order number and creates the order in one transaction,
 * retrying if a concurrent request grabbed the same number. App-generated
 * (not a DB autoincrement column) so the same logic works unchanged on
 * SQLite or Postgres.
 */
export async function createOrderWithNumber<T>(
  db: PrismaClient,
  buildOrder: (orderNumber: number) => Prisma.OrderCreateArgs
): Promise<T> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const last = await db.order.findFirst({
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const nextNumber = (last?.orderNumber ?? STARTING_ORDER_NUMBER - 1) + 1;
    try {
      return (await db.order.create(buildOrder(nextNumber))) as T;
    } catch (err) {
      const isUniqueConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isUniqueConflict || attempt === MAX_ATTEMPTS - 1) throw err;
    }
  }
  throw new Error("Could not assign an order number");
}
