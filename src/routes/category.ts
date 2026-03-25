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
  parentId: true
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
    const { name, slug, parentId } = req.body as { name?: unknown; slug?: unknown; parentId?: unknown };

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    if (typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({ error: "slug is required" });
    }

    if (parentId !== undefined && parentId !== null && (typeof parentId !== "string" || !parentId.trim())) {
      return res.status(400).json({ error: "parentId must be a non-empty string or null" });
    }

    const created = await prisma.category.create({
      data: {
        name: name.trim(),
        slug: slug.trim(),
        ...(parentId !== undefined ? { parentId: parentId === null ? null : (parentId as string).trim() } : {})
      },
      select: categorySelect
    });

    return res.status(201).json(created);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2002") {
      return res.status(409).json({ error: "Category slug already exists" });
    }

    if (prismaError?.code === "P2003") {
      return res.status(400).json({ error: "Invalid parentId" });
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

    const { name, slug, parentId } = req.body as { name?: unknown; slug?: unknown; parentId?: unknown };

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }

    if (slug !== undefined && (typeof slug !== "string" || !slug.trim())) {
      return res.status(400).json({ error: "slug must be a non-empty string" });
    }

    if (parentId !== undefined && parentId !== null && (typeof parentId !== "string" || !parentId.trim())) {
      return res.status(400).json({ error: "parentId must be a non-empty string or null" });
    }

    if (typeof parentId === "string" && parentId.trim() === categoryId) {
      return res.status(400).json({ error: "A category cannot be its own parent" });
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(slug !== undefined ? { slug: slug.trim() } : {}),
        ...(parentId !== undefined ? { parentId: parentId === null ? null : (parentId as string).trim() } : {})
      },
      select: categorySelect
    });

    return res.json(updated);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2002") {
      return res.status(409).json({ error: "Category slug already exists" });
    }

    if (prismaError?.code === "P2003") {
      return res.status(400).json({ error: "Invalid parentId" });
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
