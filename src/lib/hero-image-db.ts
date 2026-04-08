import { prisma } from "./prisma.js";

/** Row shape returned when using the shared hero select object. */
export type HeroImageRow = {
  id: string;
  linkUrl: string | null;
  imageMimeType: string;
  imageFileName: string | null;
  alt: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type HeroSelect = {
  id: true;
  linkUrl?: true;
  imageMimeType?: true;
  imageFileName?: true;
  imageData?: true;
  alt: true;
  sortOrder: true;
  active: true;
  createdAt: true;
  updatedAt: true;
};

type HeroImageBinaryRow = {
  imageData: Uint8Array;
  imageMimeType: string;
};

type HeroImageDelegate = {
  findMany(args: {
    select: HeroSelect;
    orderBy: Array<
      { sortOrder: "asc" | "desc" } | { createdAt: "asc" | "desc" }
    >;
  }): Promise<HeroImageRow[]>;
  findUnique(args: {
    where: { id: string };
    select: { imageData: true; imageMimeType: true };
  }): Promise<HeroImageBinaryRow | null>;
  create(args: {
    data: {
      imageData: Uint8Array;
      imageMimeType: string;
      imageFileName?: string | null;
      linkUrl?: string | null;
      alt?: string | null;
      sortOrder?: number;
      active?: boolean;
    };
    select: HeroSelect;
  }): Promise<HeroImageRow>;
  update(args: {
    where: { id: string };
    data: {
      alt?: string | null;
      sortOrder?: number;
      active?: boolean;
      linkUrl?: string | null;
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
