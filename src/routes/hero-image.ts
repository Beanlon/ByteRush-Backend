import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { heroImageDb } from "../lib/hero-image-db.js";

const router = Router();

function asSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

const heroSelect = {
  id: true,
  imageUrl: true,
  alt: true,
  sortOrder: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

router.get("/", async (_req, res, next) => {
  try {
    const items = await heroImageDb.findMany({
      select: heroSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { imageUrl, alt, sortOrder, active } = (req.body ?? {}) as {
      imageUrl?: unknown;
      alt?: unknown;
      sortOrder?: unknown;
      active?: unknown;
    };

    if (typeof imageUrl !== "string" || !imageUrl.trim()) {
      return res.status(400).json({ error: "imageUrl is required" });
    }

    const data = {
      imageUrl: imageUrl.trim(),
      ...(typeof alt === "string" ? { alt: alt.trim() || null } : {}),
      ...(typeof sortOrder === "number" && Number.isFinite(sortOrder)
        ? { sortOrder: Math.floor(sortOrder) }
        : {}),
      ...(typeof active === "boolean" ? { active } : {}),
    };

    const created = await heroImageDb.create({
      data,
      select: heroSelect,
    });
    return res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = asSingleParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid hero image id" });
    }

    const { imageUrl, alt, sortOrder, active } = (req.body ?? {}) as {
      imageUrl?: unknown;
      alt?: unknown;
      sortOrder?: unknown;
      active?: unknown;
    };

    const patch: {
      imageUrl?: string;
      alt?: string | null;
      sortOrder?: number;
      active?: boolean;
    } = {};

    if (imageUrl !== undefined) {
      if (typeof imageUrl !== "string" || !imageUrl.trim()) {
        return res.status(400).json({ error: "imageUrl must be a non-empty string" });
      }
      patch.imageUrl = imageUrl.trim();
    }
    if (alt !== undefined) {
      if (alt !== null && typeof alt !== "string") {
        return res.status(400).json({ error: "alt must be a string or null" });
      }
      patch.alt = typeof alt === "string" ? alt.trim() || null : null;
    }
    if (sortOrder !== undefined) {
      if (typeof sortOrder !== "number" || !Number.isFinite(sortOrder)) {
        return res.status(400).json({ error: "sortOrder must be a number" });
      }
      patch.sortOrder = Math.floor(sortOrder);
    }
    if (active !== undefined) {
      if (typeof active !== "boolean") {
        return res.status(400).json({ error: "active must be a boolean" });
      }
      patch.active = active;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const updated = await heroImageDb.update({
      where: { id },
      data: patch,
      select: heroSelect,
    });
    return res.json(updated);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2025") {
      return res.status(404).json({ error: "Hero image not found" });
    }
    next(err);
  }
});

export default router;
