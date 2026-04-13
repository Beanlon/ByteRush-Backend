import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma, prismaItemType } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";

const router = Router();

function asSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

const itemTypeSelect = {
  id: true,
  categoryId: true,
  slug: true,
  name: true,
  sortOrder: true,
  createdAt: true,
} as const;

/** GET /item-types?categoryId= — list types for one category (public). */
router.get("/", async (req, res, next) => {
  try {
    const categoryId = asSingleParam(
      typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
    );
    if (!categoryId?.trim()) {
      return res.status(400).json({ error: "categoryId query parameter is required" });
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId.trim() },
      select: { id: true },
    });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const rows = await prismaItemType.findMany({
      where: { categoryId: categoryId.trim() },
      select: itemTypeSelect,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return res.json(rows);
  } catch (err) {
    next(err);
  }
});

/** GET /item-types/:id — single type (public). */
router.get("/:id", async (req, res, next) => {
  try {
    const id = asSingleParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid item type id" });
    }

    const row = await prismaItemType.findUnique({
      where: { id },
      select: itemTypeSelect,
    });
    if (!row) {
      return res.status(404).json({ error: "Item type not found" });
    }

    return res.json(row);
  } catch (err) {
    next(err);
  }
});

/** POST /item-types — admin; body: categoryId, slug, name, sortOrder? */
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { categoryId, slug, name, sortOrder } = req.body as {
      categoryId?: unknown;
      slug?: unknown;
      name?: unknown;
      sortOrder?: unknown;
    };

    if (typeof categoryId !== "string" || !categoryId.trim()) {
      return res.status(400).json({ error: "categoryId is required" });
    }
    if (typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({ error: "slug is required" });
    }
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    let sort: number | undefined;
    if (sortOrder !== undefined && sortOrder !== null && sortOrder !== "") {
      const n = typeof sortOrder === "number" ? sortOrder : Number(sortOrder);
      if (!Number.isInteger(n) || n < 0) {
        return res.status(400).json({ error: "sortOrder must be a non-negative integer" });
      }
      sort = n;
    }

    const created = await prismaItemType.create({
      data: {
        categoryId: categoryId.trim(),
        slug: slug.trim(),
        name: name.trim(),
        ...(sort !== undefined ? { sortOrder: sort } : {}),
      },
      select: itemTypeSelect,
    });

    return res.status(201).json(created);
  } catch (err: unknown) {
    const e = err as Prisma.PrismaClientKnownRequestError;
    if (e?.code === "P2002") {
      return res.status(409).json({ error: "An item type with this slug already exists for this category" });
    }
    if (e?.code === "P2003") {
      return res.status(400).json({ error: "Invalid categoryId" });
    }
    next(err);
  }
});

/** PATCH /item-types/:id — admin; body: slug?, name?, sortOrder? */
router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = asSingleParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid item type id" });
    }

    const { slug, name, sortOrder } = req.body as {
      slug?: unknown;
      name?: unknown;
      sortOrder?: unknown;
    };

    if (slug !== undefined && (typeof slug !== "string" || !slug.trim())) {
      return res.status(400).json({ error: "slug must be a non-empty string" });
    }
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }

    let sort: number | undefined;
    if (sortOrder !== undefined) {
      const n = typeof sortOrder === "number" ? sortOrder : Number(sortOrder);
      if (!Number.isInteger(n) || n < 0) {
        return res.status(400).json({ error: "sortOrder must be a non-negative integer" });
      }
      sort = n;
    }

    if (slug === undefined && name === undefined && sortOrder === undefined) {
      return res.status(400).json({ error: "Provide at least one of slug, name, sortOrder" });
    }

    const updated = await prismaItemType.update({
      where: { id },
      data: {
        ...(slug !== undefined ? { slug: slug.trim() } : {}),
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(sort !== undefined ? { sortOrder: sort } : {}),
      },
      select: itemTypeSelect,
    });

    return res.json(updated);
  } catch (err: unknown) {
    const e = err as Prisma.PrismaClientKnownRequestError;
    if (e?.code === "P2025") {
      return res.status(404).json({ error: "Item type not found" });
    }
    if (e?.code === "P2002") {
      return res.status(409).json({ error: "An item type with this slug already exists for this category" });
    }
    next(err);
  }
});

/** DELETE /item-types/:id — admin */
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = asSingleParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid item type id" });
    }

    await prismaItemType.delete({ where: { id } });
    return res.status(204).send();
  } catch (err: unknown) {
    const e = err as Prisma.PrismaClientKnownRequestError;
    if (e?.code === "P2025") {
      return res.status(404).json({ error: "Item type not found" });
    }
    if (e?.code === "P2003" || e?.code === "P2014") {
      return res.status(409).json({ error: "Cannot delete item type while products reference it" });
    }
    next(err);
  }
});

export default router;
