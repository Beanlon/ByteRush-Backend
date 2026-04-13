import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

function asSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  sortOrder: true,
} as const;

router.get("/", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      select: categorySelect,
      orderBy: { name: "asc" }
    });

    return res.json(categories);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const categoryId = asSingleParam(req.params.id);
    if (!categoryId) {
      return res.status(400).json({ error: "Invalid category id" });
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: categorySelect
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    return res.json(category);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, slug, sortOrder } = req.body as {
      name?: unknown;
      slug?: unknown;
      sortOrder?: unknown;
    };

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    if (typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({ error: "slug is required" });
    }

    const sort =
      sortOrder === undefined
        ? undefined
        : typeof sortOrder === "number" && Number.isFinite(sortOrder)
          ? Math.trunc(sortOrder)
          : typeof sortOrder === "string" && sortOrder.trim() !== "" && Number.isFinite(Number(sortOrder))
            ? Math.trunc(Number(sortOrder))
            : null;
    if (sort === null) {
      return res.status(400).json({ error: "sortOrder must be a finite number when provided" });
    }

    const created = await prisma.category.create({
      data: {
        name: name.trim(),
        slug: slug.trim(),
        ...(sort !== undefined ? { sortOrder: sort } : {}),
      },
      select: categorySelect,
    });

    return res.status(201).json(created);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2002") {
      return res.status(409).json({ error: "Category slug already exists" });
    }

    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const categoryId = asSingleParam(req.params.id);
    if (!categoryId) {
      return res.status(400).json({ error: "Invalid category id" });
    }

    const { name, slug, sortOrder } = req.body as {
      name?: unknown;
      slug?: unknown;
      sortOrder?: unknown;
    };

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }

    if (slug !== undefined && (typeof slug !== "string" || !slug.trim())) {
      return res.status(400).json({ error: "slug must be a non-empty string" });
    }

    let sortPatch: { sortOrder: number } | Record<string, never> = {};
    if (sortOrder !== undefined) {
      const s =
        typeof sortOrder === "number" && Number.isFinite(sortOrder)
          ? Math.trunc(sortOrder)
          : typeof sortOrder === "string" && sortOrder.trim() !== "" && Number.isFinite(Number(sortOrder))
            ? Math.trunc(Number(sortOrder))
            : null;
      if (s === null) {
        return res.status(400).json({ error: "sortOrder must be a finite number when provided" });
      }
      sortPatch = { sortOrder: s };
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(slug !== undefined ? { slug: slug.trim() } : {}),
        ...sortPatch,
      },
      select: categorySelect,
    });

    return res.json(updated);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2002") {
      return res.status(409).json({ error: "Category slug already exists" });
    }

    if (prismaError?.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }

    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const categoryId = asSingleParam(req.params.id);
    if (!categoryId) {
      return res.status(400).json({ error: "Invalid category id" });
    }

    await prisma.category.delete({ where: { id: categoryId } });
    return res.status(204).send();
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }

    if (prismaError?.code === "P2003") {
      return res.status(409).json({ error: "Cannot delete category with existing dependencies" });
    }

    next(err);
  }
});

export default router;
