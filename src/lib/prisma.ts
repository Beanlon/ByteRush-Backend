import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaClient;

/**
 * Same as `prisma.itemType` at runtime (the `ItemType` model delegate).
 * Typed loosely so TS still compiles if `@prisma/client` was generated before `ItemType`
 * existed — run `npx prisma generate` from this package root to refresh typings.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- delegate comes from generated client
export const prismaItemType = (prismaClient as any).itemType;
