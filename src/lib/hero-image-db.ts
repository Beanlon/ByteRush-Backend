import { prisma } from "./prisma.js";

/** Row shape returned when using the shared hero select object. */
export type HeroImageRow = {
  id: string;
  imageUrl: string;
  alt: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type HeroSelect = {
  id: true;
  imageUrl: true;
  alt: true;
  sortOrder: true;
  active: true;
  createdAt: true;
  updatedAt: true;
};

type HeroImageDelegate = {
  findMany(args: {
    select: HeroSelect;
    orderBy: Array<
      { sortOrder: "asc" | "desc" } | { createdAt: "asc" | "desc" }
    >;
  }): Promise<HeroImageRow[]>;
  create(args: {
    data: {
      imageUrl: string;
      alt?: string | null;
      sortOrder?: number;
      active?: boolean;
    };
    select: HeroSelect;
  }): Promise<HeroImageRow>;
  update(args: {
    where: { id: string };
    data: {
      imageUrl?: string;
      alt?: string | null;
      sortOrder?: number;
      active?: boolean;
    };
    select: HeroSelect;
  }): Promise<HeroImageRow>;
};

/**
 * Typed access to `prisma.heroImage`. Use this when `PrismaClient` typings are stale
 * (e.g. IDE has not picked up `prisma generate` yet); runtime always matches schema.
 */
export const heroImageDb: HeroImageDelegate = (
  prisma as unknown as { heroImage: HeroImageDelegate }
).heroImage;
